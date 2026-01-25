# Copilot Remote Control

Control VS Code's Copilot Chat from your phone. Send prompts and commands to your Mac's VS Code agents while away from your keyboard.

## Features

- 📱 Mobile-friendly web interface
- 🔄 Real-time WebSocket connection
- 💬 Send prompts to Agent, Ask, or Edit mode
- ⚡ Quick action buttons
- 📊 Chat history sync
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

1. Make sure your phone is on the same WiFi as your Mac
2. Run "Copilot Remote: Show QR Code for Phone"
3. Scan the QR with your phone camera
4. Or manually open `http://<your-mac-ip>:3847`

## Usage

### From Phone:

1. Select mode (Agent, Ask, Edit) at the top
2. Type your prompt or use quick action buttons
3. Hit send - the prompt goes to VS Code's Copilot Chat
4. Check VS Code on your Mac for the response

### Quick Actions:

- **Explain** - Explain selected code
- **Fix Error** - Fix the current error
- **Tests** - Generate tests
- **Refactor** - Clean up code

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

| Endpoint      | Method | Description          |
| ------------- | ------ | -------------------- |
| `/`           | GET    | Mobile web interface |
| `/api/health` | GET    | Server status check  |
| `/api/prompt` | POST   | Send prompt to chat  |

### WebSocket Messages

Send:

```json
{ "type": "prompt", "content": "your prompt" }
```

Receive:

```json
{ "type": "history", "data": [...] }
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
2. Check Mac firewall allows incoming connections on port 3847
3. Try the IP address shown in the QR code panel

### Server won't start

1. Check if port 3847 is already in use
2. Change port in settings: `copilotRemote.port`

## License

MIT
