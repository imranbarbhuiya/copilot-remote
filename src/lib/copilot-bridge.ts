import { exec } from 'node:child_process';
import { promisify } from 'node:util';

import { CopilotClient, CopilotSession } from '@github/copilot-sdk';

const execAsync = promisify(exec);

export interface StreamEvent {
	type: 'delta' | 'tool_call' | 'tool_result' | 'error' | 'idle' | 'thinking';
	content?: string;
	toolName?: string;
	toolParams?: unknown;
	toolResult?: unknown;
}

export interface SessionInfo {
	sessionId: string;
	createdAt?: string;
}

export interface HistoryMessage {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	timestamp: number;
}

interface CopilotSessionWrapper {
	id: string;
	session: CopilotSession;
	unsubscribers: (() => void)[];
}

let client: CopilotClient | null = null;
let clientStarted = false;
const activeSessions: Map<string, CopilotSessionWrapper> = new Map();

export async function checkCliInstalled(): Promise<{ installed: boolean; error?: string }> {
	try {
		const { stdout } = await execAsync('copilot --version');
		console.log(`[CopilotBridge] CLI version: ${stdout.trim()}`);
		return { installed: true };
	} catch {
		return {
			installed: false,
			error:
				'Copilot CLI not found. Install it from https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli',
		};
	}
}

let initPromise: Promise<{ success: boolean; error?: string }> | null = null;

export async function initClient(): Promise<{ success: boolean; error?: string }> {
	if (client && clientStarted) {
		console.log('[CopilotBridge] Client already initialized');
		return { success: true };
	}

	if (initPromise) return initPromise;

	initPromise = (async () => {
		const cliCheck = await checkCliInstalled();
		if (!cliCheck.installed) return { success: false, error: cliCheck.error };

		try {
			console.log('[CopilotBridge] Initializing CopilotClient...');
			const newClient = new CopilotClient();
			await newClient.start();
			client = newClient;
			clientStarted = true;
			console.log('[CopilotBridge] CopilotClient initialized and started successfully');
			return { success: true };
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			console.log(`[CopilotBridge] Failed to initialize client: ${msg}`);
			if (msg.toLowerCase().includes('auth') || msg.toLowerCase().includes('login')) {
				return { success: false, error: 'Copilot CLI not authenticated. Run "copilot login" to authenticate.' };
			}
			return { success: false, error: `Failed to initialize Copilot client: ${msg}` };
		} finally {
			initPromise = null;
		}
	})();

	return initPromise;
}

export function getWorkingDirectory(): string {
	return process.cwd();
}

function setupSessionEvents(session: CopilotSession, onEvent: (event: StreamEvent) => void): (() => void)[] {
	const unsubscribers: (() => void)[] = [];

	unsubscribers.push(
		session.on('assistant.message_delta', (event) => {
			onEvent({ type: 'delta', content: event.data.deltaContent });
		}),
	);

	unsubscribers.push(
		session.on('assistant.reasoning_delta', () => {
			onEvent({ type: 'thinking' });
		}),
	);

	unsubscribers.push(
		session.on('tool.execution_start', (event) => {
			onEvent({
				type: 'tool_call',
				toolName: event.data.toolName,
				toolParams: event.data.arguments,
			});
		}),
	);

	unsubscribers.push(
		session.on('tool.execution_complete', (event) => {
			onEvent({
				type: 'tool_result',
				toolName: event.data.toolCallId,
				toolResult:
					event.data.result?.content ?? (event.data.error?.message ? `Error: ${event.data.error.message}` : 'Done'),
			});
		}),
	);

	unsubscribers.push(
		session.on('session.idle', () => {
			onEvent({ type: 'idle' });
		}),
	);

	unsubscribers.push(
		session.on('session.error', (event) => {
			onEvent({ type: 'error', content: event.data.message || 'Unknown error' });
		}),
	);

	return unsubscribers;
}

export interface ModelInfo {
	id: string;
	name: string;
}

export async function listModels(): Promise<{ models: ModelInfo[]; error?: string }> {
	if (!client) {
		const init = await initClient();
		if (!init.success) return { models: [], error: init.error };
	}

	try {
		const models = await client!.listModels();
		return { models: models.map((m) => ({ id: m.id, name: m.name })) };
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		return { models: [], error: msg };
	}
}

export async function listSessions(): Promise<{ sessions: SessionInfo[]; error?: string }> {
	if (!client) {
		const init = await initClient();
		if (!init.success) return { sessions: [], error: init.error };
	}

	try {
		const sessions = await client!.listSessions();
		return { sessions: sessions.map((s) => ({ sessionId: s.sessionId })) };
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		return { sessions: [], error: msg };
	}
}

export async function deleteSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
	if (!client) {
		const init = await initClient();
		if (!init.success) return init;
	}

	const existing = activeSessions.get(sessionId);
	if (existing) {
		for (const unsub of existing.unsubscribers) unsub();
		activeSessions.delete(sessionId);
	}

	try {
		await client!.deleteSession(sessionId);
		console.log(`[CopilotBridge] Session permanently deleted: ${sessionId}`);
		return { success: true };
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		console.log(`[CopilotBridge] Failed to delete session: ${msg}`);
		return { success: false, error: msg };
	}
}

export async function resumeSession(
	sessionId: string,
	onEvent: (event: StreamEvent) => void,
): Promise<{ success: boolean; error?: string; messages?: HistoryMessage[] }> {
	if (!client) {
		const init = await initClient();
		if (!init.success) return init;
	}

	if (activeSessions.has(sessionId)) {
		console.log(`[CopilotBridge] Session already active: ${sessionId}`);
		const existingSession = activeSessions.get(sessionId)!;
		const events = await existingSession.session.getMessages();
		const messages = extractMessagesFromEvents(events);
		return { success: true, messages };
	}

	try {
		console.log(`[CopilotBridge] Resuming session: ${sessionId}`);
		const session = await client!.resumeSession(sessionId);
		const unsubscribers = setupSessionEvents(session, onEvent);
		activeSessions.set(sessionId, { id: sessionId, session, unsubscribers });

		const events = await session.getMessages();
		const messages = extractMessagesFromEvents(events);

		console.log(`[CopilotBridge] Session resumed: ${sessionId}, loaded ${messages.length} messages`);
		return { success: true, messages };
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		console.log(`[CopilotBridge] Failed to resume session: ${msg}`);
		return { success: false, error: msg };
	}
}

function extractMessagesFromEvents(
	events: Array<{ type: string; timestamp: string; data: unknown }>,
): HistoryMessage[] {
	const messages: HistoryMessage[] = [];

	for (const event of events) {
		if (event.type === 'user.message') {
			const data = event.data as { content: string };
			messages.push({
				id: `msg-${Date.parse(event.timestamp)}`,
				role: 'user',
				content: data.content,
				timestamp: Date.parse(event.timestamp),
			});
		} else if (event.type === 'assistant.message') {
			const data = event.data as { content: string };
			if (data.content) {
				messages.push({
					id: `msg-${Date.parse(event.timestamp)}`,
					role: 'assistant',
					content: data.content,
					timestamp: Date.parse(event.timestamp),
				});
			}
		}
	}

	return messages;
}

export async function createSession(
	sessionId: string,
	model: string,
	onEvent: (event: StreamEvent) => void,
): Promise<{ success: boolean; error?: string }> {
	if (!client) {
		const init = await initClient();
		if (!init.success) return init;
	}

	if (activeSessions.has(sessionId)) {
		console.log(`[CopilotBridge] Reusing existing session: ${sessionId}`);
		return { success: true };
	}

	try {
		console.log(`[CopilotBridge] Creating session: ${sessionId} with model: ${model}`);
		const session = await client!.createSession({
			sessionId,
			model: model || 'gpt-4.1',
			streaming: true,
		});

		const unsubscribers = setupSessionEvents(session, onEvent);
		activeSessions.set(sessionId, { id: sessionId, session, unsubscribers });
		console.log(`[CopilotBridge] Session created: ${sessionId}`);
		return { success: true };
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		console.log(`[CopilotBridge] Failed to create session: ${msg}`);
		return { success: false, error: `Failed to create session: ${msg}` };
	}
}

export async function sendMessage(
	sessionId: string,
	prompt: string,
	model?: string,
	onEvent?: (event: StreamEvent) => void,
): Promise<{ success: boolean; error?: string }> {
	let copilotSession = activeSessions.get(sessionId);

	if (!copilotSession && onEvent) {
		const result = await createSession(sessionId, model ?? 'gpt-4.1', onEvent);
		if (!result.success) return result;
		copilotSession = activeSessions.get(sessionId);
	}

	if (!copilotSession) return { success: false, error: 'Session not found' };

	try {
		console.log(`[CopilotBridge] Sending message in session ${sessionId}: ${prompt.slice(0, 50)}...`);
		await copilotSession.session.sendAndWait({ prompt });
		console.log(`[CopilotBridge] Message completed in session ${sessionId}`);
		return { success: true };
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		console.log(`[CopilotBridge] Error sending message: ${msg}`);
		return { success: false, error: msg };
	}
}

export function sendMessageStream(sessionId: string, prompt: string, model?: string): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();

	return new ReadableStream<Uint8Array>({
		async start(controller) {
			const onEvent = (event: StreamEvent) => {
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
			};

			let copilotSession = activeSessions.get(sessionId);

			if (!copilotSession) {
				const result = await createSession(sessionId, model ?? 'gpt-4.1', onEvent);
				if (!result.success) {
					controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', content: result.error })}\n\n`));
					controller.close();
					return;
				}
				copilotSession = activeSessions.get(sessionId);
			} else {
				const existing = copilotSession;
				for (const unsub of existing.unsubscribers) unsub();
				const unsubscribers = setupSessionEvents(existing.session, onEvent);
				activeSessions.set(sessionId, { ...existing, unsubscribers });
				copilotSession = activeSessions.get(sessionId);
			}

			if (!copilotSession) {
				controller.enqueue(
					encoder.encode(`data: ${JSON.stringify({ type: 'error', content: 'Session not found' })}\n\n`),
				);
				controller.close();
				return;
			}

			try {
				console.log(`[CopilotBridge] Sending message in session ${sessionId}: ${prompt.slice(0, 50)}...`);
				await copilotSession.session.sendAndWait({ prompt });
				console.log(`[CopilotBridge] Message completed in session ${sessionId}`);
			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error);
				console.log(`[CopilotBridge] Error sending message: ${msg}`);
				controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', content: msg })}\n\n`));
			}

			controller.close();
		},
	});
}

export async function closeSession(sessionId: string) {
	const copilotSession = activeSessions.get(sessionId);
	if (copilotSession) {
		console.log(`[CopilotBridge] Closing session: ${sessionId}`);
		for (const unsub of copilotSession.unsubscribers) unsub();
		try {
			await copilotSession.session.destroy();
		} catch (error) {
			console.log(`[CopilotBridge] Error destroying session: ${error}`);
		}
		activeSessions.delete(sessionId);
	}
}

export async function stopClient() {
	console.log('[CopilotBridge] Stopping CopilotClient...');
	for (const [id] of activeSessions) await closeSession(id);
	activeSessions.clear();

	const currentClient = client;
	if (currentClient) {
		client = null;
		clientStarted = false;
		try {
			await currentClient.stop();
		} catch (error) {
			console.log(`[CopilotBridge] Error stopping client: ${error}`);
		}
	}
	console.log('[CopilotBridge] CopilotClient stopped');
}
