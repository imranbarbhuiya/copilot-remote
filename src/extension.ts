import * as http from 'node:http';
import * as os from 'node:os';

import * as QRCode from 'qrcode';
import * as vscode from 'vscode';
import { WebSocketServer, WebSocket } from 'ws';

import { getMobileUI } from './ui';

interface Workspace {
	id: string;
	name: string;
	uri: string;
}

interface ChatMessage {
	type: 'prompt' | 'response' | 'status' | 'history' | 'command' | 'workspaces' | 'register' | 'unregister' | 'execute';
	content?: string;
	command?: string;
	workspaceId?: string;
	workspace?: Workspace;
	data?: unknown;
	model?: string;
}

interface ChatHistoryEntry {
	role: 'user' | 'assistant';
	content: string;
	timestamp: number;
	workspaceId: string;
}

let server: http.Server | null = null;
let wss: WebSocketServer | null = null;
let clientWs: WebSocket | null = null;
let actualPort = 3_847;
let isHost = false;
const mobileClients: Set<WebSocket> = new Set();
const workspaceClients: Map<string, WebSocket> = new Map();
const workspaces: Map<string, Workspace> = new Map();
const chatHistories: Map<string, ChatHistoryEntry[]> = new Map();

const outputChannel = vscode.window.createOutputChannel('Copilot Remote');

function log(message: string) {
	const timestamp = new Date().toISOString();
	outputChannel.appendLine(`[${timestamp}] ${message}`);
}

function getLocalIP(): string {
	const interfaces = os.networkInterfaces();
	for (const name of Object.keys(interfaces))
		for (const iface of interfaces[name] ?? []) if (iface.family === 'IPv4' && !iface.internal) return iface.address;
	return '127.0.0.1';
}

function getWorkspaceId(): string {
	const folders = vscode.workspace.workspaceFolders;
	if (folders && folders.length > 0) return folders[0].uri.toString();
	return 'unknown-' + Date.now();
}

function getWorkspaceName(): string {
	return vscode.workspace.name ?? 'Unknown';
}

function getWorkspaceInfo(): Workspace {
	return {
		id: getWorkspaceId(),
		name: getWorkspaceName(),
		uri: vscode.workspace.workspaceFolders?.[0]?.uri.toString() ?? '',
	};
}

function broadcastToMobile(message: ChatMessage) {
	const data = JSON.stringify(message);
	for (const client of mobileClients) if (client.readyState === WebSocket.OPEN) client.send(data);
}

function broadcastWorkspaces() {
	broadcastToMobile({ type: 'workspaces', data: Array.from(workspaces.values()) });
}

function getChatHistory(workspaceId: string): ChatHistoryEntry[] {
	if (!chatHistories.has(workspaceId)) chatHistories.set(workspaceId, []);
	return chatHistories.get(workspaceId)!;
}

async function executeLocalChat(prompt: string, workspaceId: string, model?: string): Promise<void> {
	log(`executeLocalChat: prompt="${prompt.slice(0, 50)}..." for workspace=${workspaceId} model=${model}`);

	try {
		const options: Record<string, unknown> = {
			query: prompt,
			mode: 'agent',
		};

		if (model) options.modelSelector = { id: model };

		await vscode.commands.executeCommand('workbench.action.chat.open', options);
		log(`Chat opened successfully`);
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : 'Unknown error';
		log(`Error opening chat: ${errorMsg}`);
	}
}

function handlePromptOnHost(prompt: string, workspaceId: string, model?: string) {
	log(`handlePromptOnHost: workspaceId=${workspaceId} model=${model}`);

	const history = getChatHistory(workspaceId);
	history.push({ role: 'user', content: prompt, timestamp: Date.now(), workspaceId });
	broadcastToMobile({ type: 'history', data: history, workspaceId });
	broadcastToMobile({ type: 'status', content: 'Sending to Copilot...' });

	const myWorkspaceId = getWorkspaceId();

	if (workspaceId === myWorkspaceId) {
		log(`Prompt is for host workspace, executing locally`);
		void executeLocalChat(prompt, workspaceId, model);
		history.push({
			role: 'assistant',
			content: '📍 Responding in VS Code chat panel',
			timestamp: Date.now(),
			workspaceId,
		});
		broadcastToMobile({ type: 'history', data: history, workspaceId });
		broadcastToMobile({ type: 'status', content: 'Copilot is responding...' });
	} else {
		const clientWs = workspaceClients.get(workspaceId);
		if (clientWs?.readyState === WebSocket.OPEN) {
			log(`Forwarding prompt to client workspace: ${workspaceId}`);
			clientWs.send(JSON.stringify({ type: 'execute', content: prompt, workspaceId, model }));
			history.push({
				role: 'assistant',
				content: '📍 Responding in VS Code chat panel',
				timestamp: Date.now(),
				workspaceId,
			});
			broadcastToMobile({ type: 'history', data: history, workspaceId });
			broadcastToMobile({ type: 'status', content: 'Copilot is responding...' });
		} else {
			log(`No client found for workspace: ${workspaceId}`);
			broadcastToMobile({ type: 'status', content: 'Error: Workspace not connected' });
		}
	}
}

function startAsHost(port: number): void {
	log(`Starting as HOST on port ${port}`);
	isHost = true;

	server = http.createServer((req, res) => {
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
		res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

		if (req.method === 'OPTIONS') {
			res.writeHead(204);
			res.end();
			return;
		}

		if (req.url === '/' && req.method === 'GET') {
			res.writeHead(200, { 'Content-Type': 'text/html' });
			res.end(getMobileUI(getWorkspaceName()));
			return;
		}

		if (req.url === '/api/health' && req.method === 'GET') {
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({ status: 'ok', workspace: getWorkspaceName() }));
			return;
		}

		if (req.url === '/api/workspaces' && req.method === 'GET') {
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify(Array.from(workspaces.values())));
			return;
		}

		res.writeHead(404);
		res.end('Not found');
	});

	wss = new WebSocketServer({ server });

	wss.on('connection', (ws, req) => {
		const isWorkspaceClient = req.url === '/workspace';

		if (isWorkspaceClient) {
			log(`Workspace client connected`);

			ws.on('message', (data: Buffer) => {
				try {
					const message: ChatMessage = JSON.parse(String(data));

					if (message.type === 'register' && message.workspace) {
						log(`Registering workspace: ${message.workspace.name} (${message.workspace.id})`);
						workspaces.set(message.workspace.id, message.workspace);
						workspaceClients.set(message.workspace.id, ws);
						broadcastWorkspaces();
					} else if (message.type === 'unregister' && message.workspaceId) {
						log(`Unregistering workspace: ${message.workspaceId}`);
						workspaces.delete(message.workspaceId);
						workspaceClients.delete(message.workspaceId);
						broadcastWorkspaces();
					}
				} catch (error) {
					log(`Error processing workspace client message: ${error}`);
				}
			});

			ws.on('close', () => {
				log(`Workspace client disconnected`);
				for (const [id, client] of workspaceClients.entries()) {
					if (client === ws) {
						workspaces.delete(id);
						workspaceClients.delete(id);
						broadcastWorkspaces();
						break;
					}
				}
			});
		} else {
			log(`Mobile client connected`);
			mobileClients.add(ws);

			ws.send(JSON.stringify({ type: 'workspaces', data: Array.from(workspaces.values()) }));
			ws.send(JSON.stringify({ type: 'status', content: 'Connected to VS Code' }));

			ws.on('message', async (data: Buffer) => {
				try {
					const message: ChatMessage = JSON.parse(String(data));

					if (message.type === 'prompt' && message.content) {
						const wsId = message.workspaceId ?? getWorkspaceId();
						handlePromptOnHost(message.content, wsId, message.model);
					}
				} catch (error) {
					log(`Error processing mobile client message: ${error}`);
				}
			});

			ws.on('close', () => {
				log(`Mobile client disconnected`);
				mobileClients.delete(ws);
			});
		}
	});

	server.listen(port, '0.0.0.0', () => {
		log(`Server listening on port ${port}`);
		actualPort = port;

		const wsInfo = getWorkspaceInfo();
		workspaces.set(wsInfo.id, wsInfo);
		log(`Registered host workspace: ${wsInfo.name}`);

		const ip = getLocalIP();
		const url = `http://${ip}:${port}`;

		void vscode.window
			.showInformationMessage(`Copilot Remote started at ${url}`, 'Open in Browser', 'Show QR')
			// eslint-disable-next-line promise/prefer-await-to-then
			.then((selection) => {
				if (selection === 'Open in Browser') void vscode.env.openExternal(vscode.Uri.parse(url));
				else if (selection === 'Show QR') void vscode.commands.executeCommand('copilot-remote.showQR');
			});
	});
}

function startAsClient(port: number): void {
	log(`Starting as CLIENT, connecting to port ${port}`);
	isHost = false;

	const wsUrl = `ws://127.0.0.1:${port}/workspace`;
	log(`Connecting to: ${wsUrl}`);

	clientWs = new WebSocket(wsUrl);

	clientWs.on('open', () => {
		log(`Connected to host server`);
		const wsInfo = getWorkspaceInfo();
		clientWs!.send(JSON.stringify({ type: 'register', workspace: wsInfo }));
		log(`Registered with host: ${wsInfo.name}`);

		actualPort = port;
		vscode.window.showInformationMessage(`Copilot Remote: Connected to existing server (workspace: ${wsInfo.name})`);
	});

	clientWs.on('message', (data: Buffer) => {
		try {
			const message: ChatMessage = JSON.parse(String(data));

			if (message.type === 'execute' && message.content) {
				log(`Received execute command: ${message.content.slice(0, 50)}...`);
				void executeLocalChat(message.content, message.workspaceId ?? getWorkspaceId(), message.model);
			}
		} catch (error) {
			log(`Error processing message from host: ${error}`);
		}
	});

	clientWs.on('close', () => {
		log(`Disconnected from host server`);
		clientWs = null;
		setTimeout(() => {
			if (!clientWs && !server) {
				log(`Attempting to reconnect...`);
				startServer();
			}
		}, 2_000);
	});

	clientWs.on('error', (error) => {
		log(`WebSocket error: ${error.message}`);
	});
}

function tryStartServer(port: number, maxPort: number): void {
	const wsName = getWorkspaceName();
	log(`tryStartServer port=${port} for workspace: ${wsName}`);

	if (port > maxPort) {
		log(`Exceeded max port range, giving up`);
		vscode.window.showErrorMessage('Could not start Copilot Remote');
		return;
	}

	const testServer = http.createServer();

	testServer.once('error', (err: NodeJS.ErrnoException) => {
		if (err.code === 'EADDRINUSE') {
			log(`Port ${port} in use, connecting as client`);
			testServer.close();
			startAsClient(port);
		} else {
			log(`Server error: ${err.message}`);
			testServer.close();
			tryStartServer(port + 1, maxPort);
		}
	});

	testServer.once('listening', () => {
		log(`Port ${port} is available`);
		testServer.close(() => {
			startAsHost(port);
		});
	});

	testServer.listen(port, '0.0.0.0');
}

function startServer(): void {
	const wsName = getWorkspaceName();
	log(`startServer called from workspace: ${wsName}`);

	if (server || clientWs) {
		log(`Already running (server=${Boolean(server)}, clientWs=${Boolean(clientWs)})`);
		return;
	}

	const config = vscode.workspace.getConfiguration('copilotRemote');
	const basePort = config.get<number>('port', 3_847);

	tryStartServer(basePort, basePort + 10);
}

function stopServer(): void {
	log(`stopServer called`);

	if (clientWs) {
		const wsInfo = getWorkspaceInfo();
		clientWs.send(JSON.stringify({ type: 'unregister', workspaceId: wsInfo.id }));
		clientWs.close();
		clientWs = null;
		vscode.window.showInformationMessage('Copilot Remote: Disconnected');
		return;
	}

	if (wss) {
		wss.close();
		wss = null;
	}
	if (server) {
		server.close();
		server = null;
	}
	mobileClients.clear();
	workspaceClients.clear();
	workspaces.clear();
	isHost = false;
	vscode.window.showInformationMessage('Copilot Remote server stopped');
}

async function showQRCode(): Promise<void> {
	const ip = getLocalIP();
	const url = `http://${ip}:${actualPort}`;

	// eslint-disable-next-line @typescript-eslint/no-base-to-string
	const qrSvg = await QRCode.toString(url, { type: 'svg', width: 256, margin: 2 });

	const panel = vscode.window.createWebviewPanel('copilotRemoteQR', 'Copilot Remote - Scan QR', vscode.ViewColumn.One, {
		enableScripts: false,
	});

	panel.webview.html = `
		<!DOCTYPE html>
		<html>
		<head>
			<style>
				body {
					display: flex;
					flex-direction: column;
					align-items: center;
					justify-content: center;
					min-height: 100vh;
					margin: 0;
					background: var(--vscode-editor-background);
					color: var(--vscode-foreground);
					font-family: var(--vscode-font-family);
				}
				h1 { font-size: 1.5rem; margin-bottom: 1rem; }
				.qr { margin: 2rem; padding: 1rem; background: white; border-radius: 8px; }
				.url {
					font-family: var(--vscode-editor-font-family);
					font-size: 1.2rem;
					padding: 0.5rem 1rem;
					background: var(--vscode-input-background);
					border-radius: 4px;
					margin-top: 1rem;
				}
				p { color: var(--vscode-descriptionForeground); margin-top: 1rem; }
			</style>
		</head>
		<body>
			<h1>Scan with your phone</h1>
			<div class="qr">${qrSvg}</div>
			<div class="url">${url}</div>
			<p>Make sure your phone is on the same WiFi network.</p>
		</body>
		</html>
	`;
}

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
	const wsName = getWorkspaceName();
	const wsId = getWorkspaceId();
	log(`========== ACTIVATE ==========`);
	log(`Workspace name: ${wsName}`);
	log(`Workspace ID: ${wsId}`);

	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.command = 'copilot-remote.showQR';
	statusBarItem.text = `$(broadcast) Remote`;
	statusBarItem.tooltip = 'Copilot Remote - Click to show QR';
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);
	context.subscriptions.push(outputChannel);

	context.subscriptions.push(
		vscode.commands.registerCommand('copilot-remote.start', startServer),
		vscode.commands.registerCommand('copilot-remote.stop', stopServer),
		vscode.commands.registerCommand('copilot-remote.showQR', showQRCode),
	);

	const config = vscode.workspace.getConfiguration('copilotRemote');
	if (config.get<boolean>('autoStart', true)) {
		log(`autoStart enabled, calling startServer`);
		startServer();
	}
}

export function deactivate() {
	log(`========== DEACTIVATE ==========`);
	stopServer();
}
