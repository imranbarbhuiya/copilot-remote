# Copilot Remote Control

Control VS Code's Copilot Chat from your phone. Send prompts and commands to your VS Code agents while away from your keyboard.

## Features

- 📱 Mobile-friendly web interface
- 🔄 Real-time WebSocket connection
- 💬 Send prompts directly to Copilot Agent
- 🪟 Multi-workspace support (manage multiple VS Code windows)
- 🤖 Model selection (choose between available Copilot models)
- 📊 Chat history sync per workspace
- 🔗 QR code for easy phone setup

## Setup

### 1. Install Dependencies

```bash
cd copilot-remote
bun install
```

### 2. Compile

```bash
bun run compile
```

### 3. Install in VS Code

- Open VS Code
- Press `Cmd+Shift+P` → "Developer: Install Extension from Location..."
- Select the `copilot-remote` folder
- OR: Copy the folder to `~/.vscode/extensions/copilot-remote`

### 4. Start the Server

The server auto-starts when VS Code opens. You can also:

- `Cmd+Shift+P` → "Copilot Remote: Start Remote Server"
- Click the `$(broadcast) Remote: 3847` status bar item

### 5. Connect from Phone

1. Make sure your phone is on the same WiFi as your computer
2. Run "Copilot Remote: Show QR Code for Phone"
3. Scan the QR with your phone camera
4. Or manually open `http://<your-ip>:3847`

## Usage

### From Phone:

1. Select workspace from the dropdown (if multiple VS Code windows are open)
2. Choose a Copilot model from the model selector
3. Type your prompt in the input field
4. Hit send - the prompt goes to VS Code's Copilot Chat
5. Check VS Code on your computer for the response

### Multi-Workspace Support:

When you have multiple VS Code windows open:

- First window becomes the **host** server
- Additional windows connect as **clients**
- Switch between workspaces from your phone
- Each workspace maintains separate chat history

## Configuration

In VS Code settings:

```json
{
	"copilotRemote.port": 3847,
	"copilotRemote.autoStart": true
}
```

## Security

⚠️ This extension exposes an HTTP server on your local network. Only devices on the same WiFi can access it. Do not use on public networks.

## API

### HTTP Endpoints

| Endpoint          | Method | Description                   |
| ----------------- | ------ | ----------------------------- |
| `/`               | GET    | Mobile web interface          |
| `/api/health`     | GET    | Server status check           |
| `/api/workspaces` | GET    | List connected workspaces     |
| `/api/models`     | GET    | List available Copilot models |

### WebSocket Messages

Send:

```json
{ "type": "prompt", "content": "your prompt", "workspaceId": "...", "model": "gpt-4o" }
```

Receive:

```json
{ "type": "workspaces", "data": [{"id": "...", "name": "..."}] }
{ "type": "history", "data": [...], "workspaceId": "..." }
{ "type": "status", "content": "message" }
```

## Development

```bash
# Watch mode
bun run watch

# Compile
bun run compile
```

## Troubleshooting

### Phone can't connect

1. Check both devices are on same WiFi
2. Check your firewall allows incoming connections on port 3847
3. Try the IP address shown in the QR code panel

### Server won't start

1. Check if port 3847 is already in use
2. Change port in settings: `copilotRemote.port`

## License

MIT
