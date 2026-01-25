# Mobile UI

## Design Decisions

### Why Inline HTML?

The mobile UI is served as a string from `src/ui.ts` rather than static files because:

1. No build step needed
2. Single-file delivery
3. Extension bundles cleanly

### Mobile-First CSS

```css
:root {
	--safe-area-bottom: env(safe-area-inset-bottom, 0px);
}
```

Handles iPhone notch/home indicator with CSS environment variables.

### PWA-Ready Meta Tags

```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
```

Can be added to home screen for app-like experience.

## UI Components

### Workspace Selector

Dropdown in header to switch between connected VS Code workspaces. Remembers last selected workspace in localStorage.

### Model Selector

Dropdown to choose between available Copilot models. Models are fetched from `/api/models` endpoint. Selection persists in localStorage.

### Input Area

Auto-expanding textarea with send button. Enter to submit, Shift+Enter for newline.

### Chat History

Messages displayed with timestamps, user messages right-aligned, assistant left-aligned. History is workspace-specific.

### Workspace Modal

Full-screen modal showing all connected workspaces with status indicators. Tap to switch workspaces.

## WebSocket Reconnection

```javascript
ws.onclose = () => {
	statusDot.classList.remove('connected');
	setTimeout(connect, 2000); // Auto-reconnect after 2s
};
```

## Color Scheme

VS Code dark theme colors:

- Background: `#1e1e1e`
- Surface: `#252526`
- Primary: `#0078d4`
- Text: `#cccccc`
- Muted: `#808080`

## Animations

Slide-in animation for new messages:

```css
@keyframes slideIn {
	from {
		opacity: 0;
		transform: translateY(10px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}
```

## QR Code Webview

QR code is generated server-side using the `qrcode` npm package and rendered as SVG in a VS Code webview panel. The SVG is embedded directly in HTML with a white background for optimal scanning.
