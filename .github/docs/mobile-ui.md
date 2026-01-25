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
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
```

Can be added to home screen for app-like experience.

## UI Components

### Mode Selector
Horizontal scrolling buttons for `agent`, `ask`, `edit` modes.

### Quick Actions
Pre-filled prompt buttons:
- Explain
- Fix Error
- Tests  
- Refactor

### Input Area
Auto-expanding textarea with send button. Enter to submit, Shift+Enter for newline.

### Chat History
Messages displayed with timestamps, user messages right-aligned, assistant left-aligned.

## WebSocket Reconnection

```javascript
ws.onclose = () => {
  statusDot.classList.remove('connected');
  setTimeout(connect, 2000);  // Auto-reconnect after 2s
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
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
```

## QR Code Webview

Uses CDN-loaded qrcode.js library in VS Code webview panel:

```html
<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
```

Renders to canvas element with white background for scanning.
