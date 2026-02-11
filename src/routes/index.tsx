import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { useState, useRef, useEffect, type SubmitEvent, type KeyboardEvent } from 'react';

import * as CopilotBridge from '../lib/copilot-bridge';

import type { HistoryMessage, ModelInfo, SessionInfo } from '../lib/copilot-bridge';

const checkCli = createServerFn({ method: 'GET' }).handler(async () => {
	const installed = await CopilotBridge.checkCliInstalled();
	if (!installed.installed) return { ready: false, error: installed.error };
	return { ready: true, cwd: CopilotBridge.getWorkingDirectory() };
});

const listSessionsFn = createServerFn({ method: 'GET' }).handler(async () => {
	return CopilotBridge.listSessions();
});

const deleteSessionFn = createServerFn({ method: 'POST' })
	.inputValidator((data: { sessionId: string }) => data)
	.handler(async ({ data }) => {
		return CopilotBridge.deleteSession(data.sessionId);
	});

const resumeSessionFn = createServerFn({ method: 'POST' })
	.inputValidator((data: { sessionId: string }) => data)
	.handler(async ({ data }): Promise<{ success: boolean; error?: string; messages?: HistoryMessage[] }> => {
		if (!CopilotBridge.getWorkingDirectory()) {
			await CopilotBridge.initClient();
		}
		const result = await CopilotBridge.resumeSession(data.sessionId, () => {});
		return result;
	});

const listModelsFn = createServerFn({ method: 'GET' }).handler(async () => {
	return CopilotBridge.listModels();
});

interface Message {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	timestamp: number;
}

interface ToolCall {
	id: string;
	type: 'tool_call' | 'tool_result';
	toolName: string;
	data: unknown;
	timestamp: number;
}

export const Route = createFileRoute('/')({
	component: ChatPage,
	head: () => ({
		meta: [{ title: 'Copilot Remote' }],
	}),
	loader: () => checkCli(),
});

function ChatPage() {
	const cliStatus = Route.useLoaderData();
	const [messages, setMessages] = useState<Message[]>([]);
	const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
	const [input, setInput] = useState('');
	const [isStreaming, setIsStreaming] = useState(false);
	const [streamingContent, setStreamingContent] = useState('');
	const [isThinking, setIsThinking] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [showSessionMenu, setShowSessionMenu] = useState(false);
	const [savedSessions, setSavedSessions] = useState<SessionInfo[]>([]);
	const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
	const [selectedModel, setSelectedModel] = useState('gpt-4.1');
	const [showModelPicker, setShowModelPicker] = useState(false);
	const [models, setModels] = useState<ModelInfo[]>([]);
	const chatContainerRef = useRef<HTMLDivElement>(null);
	const sessionIdRef = useRef(`session-${Date.now()}`);
	const abortControllerRef = useRef<AbortController | null>(null);
	const streamingContentRef = useRef('');

	const loadModels = async () => {
		const result = await listModelsFn();
		if (result.models) {
			setModels(result.models);
			if (result.models.length > 0 && !result.models.some((m) => m.id === selectedModel)) {
				setSelectedModel(result.models[0].id);
			}
		}
	};

	const loadSessions = async () => {
		const result = await listSessionsFn();
		if (result.sessions) {
			setSavedSessions(result.sessions);
		}
	};

	const resumeSession = async (sessionId: string) => {
		sessionIdRef.current = sessionId;
		setCurrentSessionId(sessionId);
		setMessages([]);
		setToolCalls([]);
		setShowSessionMenu(false);
		const result = await resumeSessionFn({ data: { sessionId } });
		if (!result.success) {
			setError(result.error ?? 'Failed to resume session');
		} else if (result.messages) {
			setMessages(result.messages);
		}
	};

	const deleteSession = async (sessionId: string) => {
		const result = await deleteSessionFn({ data: { sessionId } });
		if (result.success) {
			setSavedSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
		}
	};

	const startNewSession = () => {
		const newSessionId = `session-${Date.now()}`;
		sessionIdRef.current = newSessionId;
		setCurrentSessionId(newSessionId);
		setMessages([]);
		setToolCalls([]);
		setStreamingContent('');
		streamingContentRef.current = '';
		setError(null);
		setShowSessionMenu(false);
	};

	useEffect(() => {
		loadSessions();
		loadModels();
	}, []);

	useEffect(() => {
		if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
	}, [messages, streamingContent, toolCalls, isThinking]);

	const handleSubmit = async (e: SubmitEvent<HTMLFormElement> | KeyboardEvent<HTMLTextAreaElement>) => {
		e.preventDefault();
		if (!input.trim() || isStreaming) return;

		const userMessage: Message = {
			id: `msg-${Date.now()}`,
			role: 'user',
			content: input.trim(),
			timestamp: Date.now(),
		};
		setMessages((prev) => [...prev, userMessage]);
		setToolCalls([]);
		setError(null);
		setIsStreaming(true);
		setStreamingContent('');
		streamingContentRef.current = '';

		const prompt = input.trim();
		setInput('');

		abortControllerRef.current = new AbortController();

		try {
			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId: sessionIdRef.current,
					prompt,
					model: selectedModel,
				}),
				signal: abortControllerRef.current.signal,
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}

			const reader = response.body?.getReader();
			if (!reader) throw new Error('No response body');

			const decoder = new TextDecoder();
			let buffer = '';

			const processLine = (line: string) => {
				if (!line.startsWith('data: ')) return;
				try {
					const data = JSON.parse(line.slice(6)) as {
						type: string;
						content?: string;
						toolName?: string;
						toolParams?: unknown;
						toolResult?: unknown;
					};

					if (data.type === 'delta') {
						setIsThinking(false);
						streamingContentRef.current += data.content ?? '';
						setStreamingContent(streamingContentRef.current);
					} else if (data.type === 'thinking') {
						setIsThinking(true);
					} else if (data.type === 'tool_call') {
						setIsThinking(false);
						setToolCalls((prev) => [
							...prev,
							{
								id: `tool-${Date.now()}`,
								type: 'tool_call',
								toolName: data.toolName ?? 'unknown',
								data: data.toolParams,
								timestamp: Date.now(),
							},
						]);
					} else if (data.type === 'tool_result') {
						setToolCalls((prev) => [
							...prev,
							{
								id: `result-${Date.now()}`,
								type: 'tool_result',
								toolName: data.toolName ?? 'tool',
								data: data.toolResult,
								timestamp: Date.now(),
							},
						]);
					} else if (data.type === 'error') {
						setError(data.content ?? 'Unknown error');
					}
				} catch {}
			};

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() ?? '';

				for (const line of lines) {
					processLine(line);
				}
			}

			if (buffer.trim()) {
				processLine(buffer);
			}

			const finalContent = streamingContentRef.current;
			if (finalContent) {
				setMessages((prev) => [
					...prev,
					{
						id: `msg-${Date.now()}`,
						role: 'assistant',
						content: finalContent,
						timestamp: Date.now(),
					},
				]);
			}
			setIsStreaming(false);
			setStreamingContent('');
			streamingContentRef.current = '';
			setIsThinking(false);
		} catch (err) {
			if (err instanceof Error && err.name === 'AbortError') return;
			setError(err instanceof Error ? err.message : 'Request failed');
			setIsStreaming(false);
			setIsThinking(false);
		}
	};
	if (!cliStatus.ready) {
		return (
			<div className="flex min-h-screen flex-col items-center justify-center p-4">
				<div className="max-w-md rounded-xl bg-surface p-8 text-center">
					<h1 className="mb-4 text-2xl font-semibold">Setup Required</h1>
					<p className="mb-6 text-text-muted">{cliStatus.error}</p>
					<div className="mb-4">
						<code className="block rounded-lg bg-bg p-3 font-mono">npm install -g @github/copilot</code>
					</div>
					<button
						className="cursor-pointer rounded-lg bg-primary px-6 py-3 text-white"
						onClick={() => window.location.reload()}
						type="button"
					>
						Retry
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-screen flex-col">
			<header className="flex flex-col gap-2 border-b border-border bg-surface px-5 py-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<svg className="size-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
							<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
						</svg>
						<h1 className="text-lg font-semibold">Copilot Remote</h1>
					</div>
					<div className="relative flex items-center gap-3">
						<div className="relative">
							<button
								className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-text-muted hover:bg-surface"
								onClick={() => {
									setShowModelPicker(!showModelPicker);
									setShowSessionMenu(false);
								}}
								type="button"
							>
								<svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
									<path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
								</svg>
								{models.find((m) => m.id === selectedModel)?.name ?? selectedModel}
							</button>
							{showModelPicker && (
								<div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border border-border bg-surface shadow-lg">
									<div className="p-2">
										{models.map((model) => (
											<button
												className={`flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-bg ${
													selectedModel === model.id ? 'bg-primary/10 text-primary' : ''
												}`}
												key={model.id}
												onClick={() => {
													setSelectedModel(model.id);
													setShowModelPicker(false);
												}}
												type="button"
											>
												{selectedModel === model.id && (
													<svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
														<path d="M5 13l4 4L19 7" />
													</svg>
												)}
												<span className={selectedModel === model.id ? '' : 'ml-6'}>{model.name}</span>
											</button>
										))}
									</div>
								</div>
							)}
						</div>
						<button
							className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-text-muted hover:bg-surface"
							onClick={() => {
								loadSessions();
								setShowSessionMenu(!showSessionMenu);
								setShowModelPicker(false);
							}}
							type="button"
						>
							<svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
								<path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
							</svg>
							Sessions
						</button>
						{showSessionMenu && (
							<div className="absolute right-0 top-full z-10 mt-1 w-64 rounded-lg border border-border bg-surface shadow-lg">
								<div className="border-b border-border p-2">
									<button
										className="flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-bg"
										onClick={startNewSession}
										type="button"
									>
										<svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
											<path d="M12 4v16m8-8H4" />
										</svg>
										New Session
									</button>
								</div>
								<div className="max-h-60 overflow-y-auto p-2">
									{savedSessions.length === 0 ? (
										<p className="px-3 py-2 text-sm text-text-muted">No saved sessions</p>
									) : (
										savedSessions.map((session) => (
											<div
												className="flex items-center justify-between gap-2 rounded px-3 py-2 hover:bg-bg"
												key={session.sessionId}
											>
												<button
													className="flex-1 cursor-pointer truncate text-left text-sm"
													onClick={() => resumeSession(session.sessionId)}
													type="button"
												>
													{session.sessionId}
												</button>
												<button
													className="shrink-0 cursor-pointer rounded p-1 text-error hover:bg-error/10"
													onClick={() => deleteSession(session.sessionId)}
													title="Delete session permanently"
													type="button"
												>
													<svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
														<path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
													</svg>
												</button>
											</div>
										))
									)}
								</div>
							</div>
						)}
					</div>
				</div>
				<div className="flex items-center gap-1.5 text-xs text-text-muted">
					<svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
						<path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
					</svg>
					<span className="truncate" title={cliStatus.cwd}>
						{cliStatus.cwd}
					</span>
					{currentSessionId && (
						<>
							<span className="text-border">•</span>
							<span className="truncate" title={currentSessionId}>
								{currentSessionId}
							</span>
						</>
					)}
				</div>
			</header>
			<main className="flex flex-1 flex-col overflow-hidden">
				<div className="flex-1 overflow-y-auto p-4" ref={chatContainerRef}>
					{messages.length === 0 && !isStreaming && !isThinking && (
						<div className="flex h-full flex-col items-center justify-center text-center text-text-muted">
							<svg
								className="mb-4 size-16 opacity-50"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.5"
								viewBox="0 0 24 24"
							>
								<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
							</svg>
							<p>Send a prompt to Copilot Agent</p>
						</div>
					)}
					{messages.map((msg) => (
						<div
							className={`mb-3 max-w-[85%] rounded-xl border px-4 py-3 ${
								msg.role === 'user'
									? 'ml-auto rounded-br-sm border-transparent bg-primary text-white'
									: 'rounded-bl-sm border-border bg-surface'
							}`}
							key={msg.id}
						>
							<div className="wrap-break-word whitespace-pre-wrap">{msg.content}</div>
							<div className="mt-1.5 text-xs opacity-60">
								{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
							</div>
						</div>
					))}
					{toolCalls.map((tc) => (
						<div
							className={`my-2 rounded-lg border p-3 text-sm ${
								tc.type === 'tool_call' ? 'border-success bg-success/10' : 'border-primary bg-primary/10'
							}`}
							key={tc.id}
						>
							<div
								className={`mb-1.5 flex items-center gap-2 font-medium ${
									tc.type === 'tool_call' ? 'text-success' : 'text-primary'
								}`}
							>
								<svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
									{tc.type === 'tool_call' ? (
										<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
									) : (
										<>
											<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
											<polyline points="22 4 12 14.01 9 11.01" />
										</>
									)}
								</svg>
								<span>
									{tc.type === 'tool_call' ? 'Tool' : 'Result'}: {tc.toolName}
								</span>
							</div>
							{tc.data ? (
								<pre className="overflow-auto rounded bg-bg p-2 font-mono text-xs wrap-break-word whitespace-pre-wrap text-text-muted">
									{typeof tc.data === 'string' ? tc.data : JSON.stringify(tc.data, null, 2).slice(0, 500)}
								</pre>
							) : null}
						</div>
					))}
					{isThinking && (
						<div className="flex items-center gap-2 py-2 text-sm text-text-muted">
							<div className="flex gap-1">
								<span className="size-1.5 animate-[thinking_1.4s_infinite] rounded-full bg-text-muted" />
								<span className="size-1.5 animate-[thinking_1.4s_infinite_0.2s] rounded-full bg-text-muted" />
								<span className="size-1.5 animate-[thinking_1.4s_infinite_0.4s] rounded-full bg-text-muted" />
							</div>
							<span>Thinking...</span>
						</div>
					)}
					{isStreaming && streamingContent && (
						<div className="mb-3 max-w-[85%] rounded-xl rounded-bl-sm border border-border bg-surface px-4 py-3">
							<div className="wrap-break-word whitespace-pre-wrap">{streamingContent}</div>
							<span className="ml-0.5 inline-block size-2 animate-[blink_1s_infinite] bg-primary align-text-bottom" />
						</div>
					)}
					{error && (
						<div className="rounded-xl border border-error bg-error/10 px-4 py-3 text-error">
							<strong>Error:</strong> {error}
						</div>
					)}
				</div>
				<form
					className="border-t border-border bg-surface px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
					onSubmit={handleSubmit}
				>
					<div className="flex items-end gap-2.5">
						<div className="flex-1 overflow-hidden rounded-xl border border-border bg-bg">
							<textarea
								className="w-full resize-none bg-transparent px-4 py-3 text-base text-text outline-none"
								onChange={(e) => setInput(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' && !e.shiftKey) {
										e.preventDefault();
										handleSubmit(e);
									}
								}}
								placeholder="Ask Copilot Agent..."
								rows={1}
								style={{ minHeight: 44, maxHeight: 120 }}
								value={input}
							/>
						</div>
						<button
							className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-primary text-white disabled:opacity-50"
							disabled={isStreaming || !input.trim()}
							type="submit"
						>
							<svg className="size-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
								<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
							</svg>
						</button>
					</div>
				</form>
			</main>
		</div>
	);
}
