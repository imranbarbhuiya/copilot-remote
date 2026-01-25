# Server Architecture

## Overview

The extension runs a dual HTTP/WebSocket server inside VS Code's Node.js environment. Since each VS Code window runs in an isolated process with separate memory, the extension uses a host/client architecture to support multiple windows.

## Host/Client Model

```
Mobile Device ──HTTP/WS──▶ Host Window (port 3847)
                              │
                              ├── Host's own workspace
                              │
                              └──WS──▶ Client Window 1 (/workspace)
                              └──WS──▶ Client Window 2 (/workspace)
```

1. **First window (Host)**: Starts HTTP server on port 3847, serves mobile UI, manages all workspace connections
2. **Additional windows (Clients)**: Detect port in use, connect to host via WebSocket at `/workspace`, register their workspace

### Key Components

- `startAsHost(port)`: Creates HTTP server + WebSocket server, registers own workspace
- `startAsClient(port)`: Connects to existing host, registers workspace via WebSocket
- `tryStartServer(port)`: Tests if port available; if EADDRINUSE, becomes client instead
- `workspaceClients`: Map of workspace ID → WebSocket connection (for forwarding prompts)
- `mobileClients`: Set of mobile device WebSocket connections

## HTTP Endpoints

| Endpoint          | Method | Purpose                       |
| ----------------- | ------ | ----------------------------- |
| `/`               | GET    | Serves mobile web UI          |
| `/api/health`     | GET    | Health check + workspace      |
| `/api/workspaces` | GET    | List connected workspaces     |
| `/api/models`     | GET    | List available Copilot models |

## WebSocket Protocol

### Message Types

| Type         | Direction     | Purpose                                |
| ------------ | ------------- | -------------------------------------- |
| `register`   | Client → Host | Register workspace with host           |
| `unregister` | Client → Host | Remove workspace on disconnect         |
| `workspaces` | Host → Mobile | List of all connected workspaces       |
| `prompt`     | Mobile → Host | Send prompt to specific workspace      |
| `execute`    | Host → Client | Forward prompt to client for execution |
| `history`    | Host → Mobile | Chat history for workspace             |
| `status`     | Host → Mobile | Status updates                         |

### Mobile → Host

```json
{ "type": "prompt", "content": "your prompt", "workspaceId": "file:///path/to/workspace", "model": "gpt-4o" }
```

### Host → Mobile

```json
{ "type": "workspaces", "data": [{ "id": "...", "name": "...", "uri": "..." }] }
{ "type": "history", "data": [...], "workspaceId": "..." }
{ "type": "status", "content": "Processing..." }
```

### Host ↔ Client

```json
{ "type": "register", "workspace": { "id": "...", "name": "...", "uri": "..." } }
{ "type": "execute", "content": "prompt text", "workspaceId": "..." }
```

## Network Binding

Server binds to `0.0.0.0` to accept connections from any device on the local network:

```typescript
server.listen(port, '0.0.0.0', callback);
```

## IP Detection

Uses `os.networkInterfaces()` to find the local IP for QR code generation:

```typescript
function getLocalIP(): string {
	const interfaces = os.networkInterfaces();
	for (const name of Object.keys(interfaces)) {
		for (const iface of interfaces[name] || []) {
			if (iface.family === 'IPv4' && !iface.internal) {
				return iface.address;
			}
		}
	}
	return '127.0.0.1';
}
```

## Dependencies

- `ws` - WebSocket server implementation
- `qrcode` - QR code generation

## State Management

Global state managed at module level:

```typescript
let server: http.Server | null = null;
let wss: WebSocketServer | null = null;
let clientWs: WebSocket | null = null;
let isHost = false;
const mobileClients: Set<WebSocket> = new Set();
const workspaceClients: Map<string, WebSocket> = new Map();
const workspaces: Map<string, Workspace> = new Map();
const chatHistories: Map<string, ChatHistoryEntry[]> = new Map();
```

## Lifecycle

1. **Activation**: Extension activates on `onStartupFinished`
2. **Auto-start**: Server starts if `copilotRemote.autoStart` is true
3. **Port check**: If port 3847 in use, becomes client instead of host
4. **Deactivation**: Server/client stops, WebSocket connections closed
