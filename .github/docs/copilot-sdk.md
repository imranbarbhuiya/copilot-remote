# Copilot SDK Integration

## Overview

The app uses `@github/copilot-sdk` to communicate with GitHub Copilot Agent through the Copilot CLI. The SDK provides session-based streaming chat with tool execution support.

## Prerequisites

1. Install Copilot CLI globally:
   ```bash
   npm install -g @github/copilot
   ```
2. Authenticate with GitHub:
   ```bash
   copilot login
   ```

## Architecture

```
Browser ──HTTP/SSE──▶ TanStack Start Server ──SDK──▶ Copilot CLI ──▶ GitHub Copilot
```

## CopilotBridge Module

Located at `src/lib/copilot-bridge.ts`, this module wraps the SDK:

### Client Lifecycle

```typescript
import { CopilotClient, CopilotSession } from '@github/copilot-sdk';

const client = new CopilotClient();
await client.start();
await client.stop();
```

### Session Management

Sessions are long-lived and maintain conversation context:

```typescript
const session = await client.createSession({
	sessionId: 'unique-id',
	model: 'gpt-4.1',
	streaming: true,
});

await session.sendAndWait({ prompt: 'Hello' });
await session.destroy();
```

### Event Streams

The SDK emits events during message processing:

| Event                       | Purpose                   |
| --------------------------- | ------------------------- |
| `assistant.message_delta`   | Streaming text chunks     |
| `assistant.reasoning_delta` | Model thinking indicator  |
| `tool.execution_start`      | Tool call initiated       |
| `tool.execution_complete`   | Tool finished with result |
| `session.idle`              | Response complete         |
| `session.error`             | Error occurred            |

### StreamEvent Interface

```typescript
interface StreamEvent {
	type: 'delta' | 'tool_call' | 'tool_result' | 'error' | 'idle' | 'thinking';
	content?: string;
	toolName?: string;
	toolParams?: unknown;
	toolResult?: unknown;
}
```

## CLI Detection

Before initializing, the bridge checks if Copilot CLI is installed:

```typescript
const { stdout } = await execAsync('copilot --version');
```

If not found, the UI displays setup instructions.

## Error Handling

The SDK surfaces authentication errors when the CLI isn't logged in. The bridge detects these and returns user-friendly messages:

```typescript
if (msg.toLowerCase().includes('auth') || msg.toLowerCase().includes('login')) {
	return { success: false, error: 'Copilot CLI not authenticated. Run "copilot login".' };
}
```

## Models

The default model is `gpt-4.1`. Models can be specified per-session during creation.

## References

- [@github/copilot-sdk on npm](https://www.npmjs.com/package/@github/copilot-sdk)
- [Copilot CLI Installation](https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli)
