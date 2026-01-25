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
	type: 'prompt' | 'response' | 'status' | 'history' | 'command' | 'workspaces';
	content?: string;
	command?: string;
	workspaceId?: string;
	data?: unknown;
}

interface ChatHistoryEntry {
	role: 'user' | 'assistant';
	content: string;
	timestamp: number;
	workspaceId: string;
}

let server: http.Server | null = null;
let wss: WebSocketServer | null = null;
let actualPort = 3_847;
const clients: Set<WebSocket> = new Set();
const workspaces: Map<string, Workspace> = new Map();
const chatHistories: Map<string, ChatHistoryEntry[]> = new Map();

function getLocalIP(): string {
	const interfaces = os.networkInterfaces();
	for (const name of Object.keys(interfaces))
		for (const iface of interfaces[name] ?? []) if (iface.family === 'IPv4' && !iface.internal) return iface.address;

	return '127.0.0.1';
}

function broadcast(message: ChatMessage) {
	const data = JSON.stringify(message);
	for (const client of clients) if (client.readyState === WebSocket.OPEN) client.send(data);
}

function broadcastWorkspaces() {
	broadcast({ type: 'workspaces', data: Array.from(workspaces.values()) });
}

function getWorkspaceId(): string {
	const folders = vscode.workspace.workspaceFolders;
	if (folders && folders.length > 0) return folders[0].uri.toString();
	return 'unknown-' + Date.now();
}

function getWorkspaceName(): string {
	return vscode.workspace.name ?? 'Unknown';
}

function getChatHistory(workspaceId: string): ChatHistoryEntry[] {
	if (!chatHistories.has(workspaceId)) chatHistories.set(workspaceId, []);
	return chatHistories.get(workspaceId)!;
}

async function executeChat(prompt: string, workspaceId: string): Promise<void> {
	const history = getChatHistory(workspaceId);
	history.push({ role: 'user', content: prompt, timestamp: Date.now(), workspaceId });
	broadcast({ type: 'history', data: history, workspaceId });
	broadcast({ type: 'status', content: 'Processing...' });

	try {
		await vscode.commands.executeCommand('workbench.action.chat.open', {
			query: prompt,
			mode: 'agent',
		});

		broadcast({ type: 'status', content: 'Prompt sent to Copilot Chat' });

		setTimeout(() => {
			history.push({
				role: 'assistant',
				content: '[Response visible in VS Code - check the chat panel]',
				timestamp: Date.now(),
				workspaceId,
			});
			broadcast({ type: 'history', data: history, workspaceId });
		}, 1_000);
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : 'Unknown error';
		broadcast({ type: 'status', content: `Error: ${errorMsg}` });
	}
}

async function executeCommand(command: string, args?: unknown[]): Promise<void> {
	try {
		await vscode.commands.executeCommand(command, ...(args ?? []));
		broadcast({ type: 'status', content: `Executed: ${command}` });
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : 'Unknown error';
		broadcast({ type: 'status', content: `Command error: ${errorMsg}` });
	}
}

function registerWorkspace() {
	const id = getWorkspaceId();
	const name = getWorkspaceName();
	const uri = vscode.workspace.workspaceFolders?.[0]?.uri.toString() ?? '';

	workspaces.set(id, { id, name, uri });
	broadcastWorkspaces();

	return id;
}

function unregisterWorkspace() {
	const id = getWorkspaceId();
	workspaces.delete(id);
	broadcastWorkspaces();
}

function startServer(): void {
	if (server) {
		registerWorkspace();
		return;
	}

	const config = vscode.workspace.getConfiguration('copilotRemote');
	const basePort = config.get<number>('port', 3_847);

	tryStartServer(basePort, basePort + 10);
}

function tryStartServer(port: number, maxPort: number): void {
	if (port > maxPort) {
		vscode.window.showErrorMessage('Could not find an available port in range 3847-3857');
		return;
	}

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

		if (req.url === '/api/prompt' && req.method === 'POST') {
			let body = '';
			req.on('data', (chunk) => (body += chunk));
			req.on('end', async () => {
				try {
					const { prompt, workspaceId } = JSON.parse(body);
					await executeChat(prompt, workspaceId ?? getWorkspaceId());
					res.writeHead(200, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify({ success: true }));
				} catch {
					res.writeHead(400, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify({ error: 'Invalid request' }));
				}
			});
			return;
		}

		res.writeHead(404);
		res.end('Not found');
	});

	wss = new WebSocketServer({ server });

	wss.on('connection', (ws) => {
		clients.add(ws);

		ws.send(JSON.stringify({ type: 'workspaces', data: Array.from(workspaces.values()) }));
		ws.send(JSON.stringify({ type: 'status', content: 'Connected to VS Code' }));

		ws.on('message', async (data) => {
			try {
				// eslint-disable-next-line @typescript-eslint/no-base-to-string
				const message: ChatMessage = JSON.parse(data.toString());

				if (message.type === 'prompt' && message.content) {
					const wsId = message.workspaceId ?? getWorkspaceId();
					await executeChat(message.content, wsId);
				} else if (message.type === 'command' && message.command) await executeCommand(message.command);
			} catch (error) {
				console.error('WebSocket message error:', error);
			}
		});

		ws.on('close', () => {
			clients.delete(ws);
		});
	});

	server.once('error', (err: NodeJS.ErrnoException) => {
		if (err.code === 'EADDRINUSE') {
			server = null;
			wss = null;
			tryStartServer(port + 1, maxPort);
		} else {
			server = null;
			wss = null;
			vscode.window.showErrorMessage(`Server error: ${err.message}`);
		}
	});

	server.listen(port, '0.0.0.0', () => {
		actualPort = port;
		registerWorkspace();

		const ip = getLocalIP();
		const url = `http://${ip}:${port}`;

		vscode.window
			.showInformationMessage(`Copilot Remote started at ${url}`, 'Open in Browser', 'Show QR')
			// eslint-disable-next-line promise/prefer-await-to-then
			.then((selection) => {
				if (selection === 'Open in Browser') vscode.env.openExternal(vscode.Uri.parse(url));
				else if (selection === 'Show QR') vscode.commands.executeCommand('copilot-remote.showQR');
			});
	});
}

function stopServer(): void {
	unregisterWorkspace();

	if (workspaces.size > 0) {
		vscode.window.showInformationMessage('Workspace unregistered. Server still running for other workspaces.');
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
	clients.clear();
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
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.command = 'copilot-remote.showQR';
	statusBarItem.text = `$(broadcast) Remote`;
	statusBarItem.tooltip = 'Copilot Remote - Click to show QR';
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);

	context.subscriptions.push(
		vscode.commands.registerCommand('copilot-remote.start', startServer),
		vscode.commands.registerCommand('copilot-remote.stop', stopServer),
		vscode.commands.registerCommand('copilot-remote.showQR', showQRCode),
	);

	const config = vscode.workspace.getConfiguration('copilotRemote');
	if (config.get<boolean>('autoStart', true)) startServer();
}

export function deactivate() {
	unregisterWorkspace();
	if (workspaces.size === 0) {
		if (wss) wss.close();
		if (server) server.close();
	}
}
