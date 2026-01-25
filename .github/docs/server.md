# Server Architecture

## Overview

The extension runs a dual HTTP/WebSocket server inside VS Code's Node.js environment.

```
┌─────────────────────────────────────────────────────────┐
│                    VS Code Extension                     │
│  ┌─────────────────┐    ┌─────────────────────────────┐ │
│  │   HTTP Server   │    │    WebSocket Server (ws)    │ │
│  │    (Node.js)    │    │    Real-time messaging      │ │
│  └────────┬────────┘    └──────────────┬──────────────┘ │
│           │                            │                 │
│           └────────────┬───────────────┘                │
│                        ▼                                 │
│              vscode.commands.executeCommand              │
│                        │                                 │
│                        ▼                                 │
│                  Copilot Chat                            │
└─────────────────────────────────────────────────────────┘
```

## HTTP Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | Serves mobile web UI |
| `/api/health` | GET | Health check + workspace info |
| `/api/prompt` | POST | Send prompt to chat |
| `/api/command` | POST | Execute VS Code command |
| `/api/context` | GET | Get workspace context |

## WebSocket Protocol

### Client → Server

```json
{ "type": "prompt", "content": "your prompt", "mode": "agent" }
{ "type": "command", "command": "workbench.action.files.save" }
```

### Server → Client

```json
{ "type": "history", "data": [...messages] }
{ "type": "status", "content": "Processing..." }
```

## Network Binding

Server binds to `0.0.0.0` to accept connections from any device on the local network:

```typescript
server.listen(port, '0.0.0.0', callback);
```

## IP Detection

Uses `os.networkInterfaces()` to find the Mac's local IP for QR code generation:

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
- `qrcode` - QR code generation (loaded via CDN in webview)

## State Management

Global state managed at module level:

```typescript
let server: http.Server | null = null;
let wss: WebSocketServer | null = null;
let clients: Set<WebSocket> = new Set();
let chatHistory: Array<{ role: string; content: string; timestamp: number }> = [];
```

## Lifecycle

1. **Activation**: Extension activates on `onStartupFinished`
2. **Auto-start**: Server starts if `copilotRemote.autoStart` is true
3. **Deactivation**: Server stops, WebSocket connections closed
