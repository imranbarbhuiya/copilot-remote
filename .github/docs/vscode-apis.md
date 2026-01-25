# VS Code APIs Used

## Core Discovery: Chat Open Command

The key API that makes this extension work:

```typescript
vscode.commands.executeCommand('workbench.action.chat.open', {
  query: string,           // The prompt text
  mode: 'agent' | 'ask' | 'edit',  // Chat mode
  blockOnResponse?: boolean,       // Wait for completion (optional)
  isPartialQuery?: boolean,        // Don't auto-submit
  toolIds?: string[],              // Attach tools
  attachFiles?: URI[],             // Attach files as context
  attachScreenshot?: boolean,      // Capture screen
  modelSelector?: { id: string, vendor: string }, // Pick model
});
```

**Source**: Found in [VS Code source - chatActions.ts](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/chat/browser/actions/chatActions.ts)

### IChatViewOpenOptions Interface (Full)

```typescript
interface IChatViewOpenOptions {
  query: string;
  isPartialQuery?: boolean;
  toolIds?: string[];
  previousRequests?: IChatViewOpenRequestEntry[];
  attachScreenshot?: boolean;
  attachFiles?: (URI | { uri: URI; range: IRange })[];
  attachHistoryItemChanges?: { uri: URI; historyItemId: string }[];
  attachHistoryItemChangeRanges?: {
    start: { uri: URI; historyItemId: string };
    end: { uri: URI; historyItemId: string };
  }[];
  mode?: ChatModeKind | string;
  modelSelector?: ILanguageModelChatSelector;
  blockOnResponse?: boolean;
}
```

## Other Useful Commands

| Command | Purpose |
|---------|---------|
| `vscode.editorChat.start` | Opens inline chat in editor |
| `workbench.action.chat.newChat` | Starts fresh chat session |
| `workbench.action.chat.open` | Opens chat with options |

## Inline Chat API

```typescript
vscode.commands.executeCommand('vscode.editorChat.start', {
  autoSend: true,
  message: string,
});
```

Requires an active text editor.

## What Doesn't Work (Research Dead Ends)

1. **No direct response capture** - VS Code doesn't expose chat responses programmatically. The `blockOnResponse` option waits for completion but doesn't return the text.

2. **No copilot-sdk repo** - GitHub returns 404 for `microsoft/copilot-sdk`. The extension APIs are in VS Code core.

3. **Chat Participant API** - This is for creating new `@participants`, not for controlling existing ones like `@workspace`.

## Extension Manifest Requirements

```json
{
  "activationEvents": ["onStartupFinished"],
  "contributes": {
    "commands": [...],
    "configuration": {
      "properties": {
        "copilotRemote.port": { "type": "number", "default": 3847 },
        "copilotRemote.autoStart": { "type": "boolean", "default": true }
      }
    }
  }
}
```

## References

- [VS Code Chat Extension Guide](https://code.visualstudio.com/api/extension-guides/chat)
- [VS Code Built-in Commands](https://code.visualstudio.com/api/references/commands)
- [Chat Actions Source](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/chat/browser/actions/chatActions.ts)
