# Server Architecture

## Overview

The app runs on TanStack Start with Vite as the build tool. Server functions and server routes provide the API layer, with HTTP streaming (SSE) for real-time Copilot responses.

## Architecture

```
Browser ──HTTP/SSE──▶ TanStack Start Server (port 3000)
                              │
                              └──▶ CopilotBridge ──▶ Copilot SDK ──▶ CLI
```

## Server Routes

API routes are defined using TanStack Start's server routes. The chat endpoint is at `src/routes/api/chat.ts`.

### Streaming Chat Handler

```typescript
import { createFileRoute } from '@tanstack/react-router';
import * as CopilotBridge from '~/lib/copilot-bridge';

export const Route = createFileRoute('/api/chat')({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const body = await request.json();
				const stream = CopilotBridge.sendMessageStream(body.sessionId, body.prompt, body.model);

				return new Response(stream, {
					headers: {
						'Content-Type': 'text/event-stream',
						'Cache-Control': 'no-cache',
						Connection: 'keep-alive',
					},
				});
			},
		},
	},
});
```

## HTTP Streaming Protocol

### Client → Server (POST /api/chat)

```json
{
	"sessionId": "session-123",
	"prompt": "your prompt",
	"model": "gpt-4.1"
}
```

### Server → Client (SSE Stream)

Stream events are sent as Server-Sent Events:

```
data: {"type":"delta","content":"streaming text..."}

data: {"type":"thinking"}

data: {"type":"tool_call","toolName":"read_file","toolParams":{...}}

data: {"type":"tool_result","toolName":"read_file","toolResult":"..."}

data: {"type":"idle"}

data: {"type":"error","content":"error message"}
```

## Server Functions

TanStack Start uses `createServerFn` for server-side logic that can be called from React components:

```typescript
const listSessionsFn = createServerFn({ method: 'GET' }).handler(async () => {
	return CopilotBridge.listSessions();
});

const deleteSessionFn = createServerFn({ method: 'POST' })
	.validator((data: { sessionId: string }) => data)
	.handler(async ({ data }) => {
		return CopilotBridge.deleteSession(data.sessionId);
	});
```

These are called directly from components for session management operations.

## Network Binding

The Vite dev server binds to `0.0.0.0` to accept connections from any device on the local network:

```typescript
export default defineConfig({
	server: {
		port: 3000,
		host: '0.0.0.0',
	},
});
```

## Session Management

Each browser tab creates a unique session ID (`session-{timestamp}`). Sessions persist across multiple messages and can be resumed from disk using the Copilot SDK's persistence features.

## Dependencies

- `@tanstack/react-start` - Meta-framework with SSR, server routes, and server functions
- `@github/copilot-sdk` - Copilot integration
- `vite` - Build tool and dev server
