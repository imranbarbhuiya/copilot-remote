# Mobile UI

## Tech Stack

- **React 19** - UI library
- **TanStack Router** - File-based routing with type-safe navigation
- **Tailwind CSS v4** - Utility-first styling

## Project Structure

```
src/
├── routes/
│   ├── __root.tsx      # Root layout with <html>, <head>, <body>
│   ├── index.tsx       # Main chat page
│   └── api/-ws.ts      # WebSocket endpoint
├── lib/
│   └── copilot-bridge.ts   # Copilot SDK wrapper
└── styles.css          # Tailwind imports and custom CSS
```

## Route Definitions

Routes use TanStack Router's `createFileRoute`:

```typescript
export const Route = createFileRoute('/')({
	component: ChatPage,
	head: () => ({ meta: [{ title: 'Copilot Remote' }] }),
	loader: () => checkCli(),
});
```

The loader checks CLI status before rendering, displaying setup instructions if needed.

## Mobile-First Design

### PWA Meta Tags

```typescript
head: () => ({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
    { name: 'theme-color', content: '#1e1e1e' },
  ],
}),
```

### Safe Area Handling

Input area respects iPhone notch/home indicator:

```css
padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));
```

## UI Components

### Chat Container

Scrollable message list with auto-scroll on new messages. Uses `useRef` to track container and scroll to bottom on updates.

### Message Bubbles

- User messages: Right-aligned, primary color background
- Assistant messages: Left-aligned, surface color with border

### Tool Call Cards

Distinct styling for tool execution:

- Tool calls: Green border with tool icon
- Tool results: Blue border with checkmark

### Streaming Indicator

Blinking cursor during streaming, thinking dots during reasoning.

## State Management

React hooks manage all client state:

```typescript
const [messages, setMessages] = useState<Message[]>([]);
const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
const [isStreaming, setIsStreaming] = useState(false);
const [streamingContent, setStreamingContent] = useState('');
const [isThinking, setIsThinking] = useState(false);
```

## WebSocket Connection

Established on component mount, reconnects automatically:

```typescript
useEffect(() => {
	const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
	const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
	wsRef.current = ws;
	// ...event handlers
	return () => ws.close();
}, []);
```

## Color Scheme

VS Code dark theme inspired:

| Variable       | Value     | Usage           |
| -------------- | --------- | --------------- |
| `--bg`         | `#1e1e1e` | Background      |
| `--surface`    | `#252526` | Cards, header   |
| `--primary`    | `#0078d4` | Buttons, accent |
| `--text`       | `#cccccc` | Primary text    |
| `--text-muted` | `#808080` | Secondary text  |

## Animations

Defined in CSS with Tailwind's `animate-` utilities:

- `thinking` - Bouncing dots for thinking state
- `blink` - Cursor blink during streaming
