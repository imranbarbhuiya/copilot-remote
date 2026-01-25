export function getMobileUI(workspaceName: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
	<meta name="apple-mobile-web-app-capable" content="yes">
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
	<meta name="theme-color" content="#1e1e1e">
	<title>Copilot Remote</title>
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
			-webkit-tap-highlight-color: transparent;
		}

		:root {
			--bg: #1e1e1e;
			--surface: #252526;
			--surface-hover: #2d2d30;
			--primary: #0078d4;
			--primary-hover: #1084d8;
			--text: #cccccc;
			--text-muted: #808080;
			--border: #3c3c3c;
			--success: #4ec9b0;
			--error: #f14c4c;
			--radius: 12px;
			--safe-area-bottom: env(safe-area-inset-bottom, 0px);
		}

		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
			background: var(--bg);
			color: var(--text);
			min-height: 100vh;
			min-height: 100dvh;
			display: flex;
			flex-direction: column;
		}

		header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 16px 20px;
			border-bottom: 1px solid var(--border);
			background: var(--surface);
			position: sticky;
			top: 0;
			z-index: 10;
		}

		.header-left {
			display: flex;
			align-items: center;
			gap: 12px;
			flex: 1;
			min-width: 0;
		}

		.logo svg {
			width: 28px;
			height: 28px;
			flex-shrink: 0;
		}

		.workspace-selector {
			display: flex;
			align-items: center;
			gap: 6px;
			padding: 6px 10px;
			background: var(--bg);
			border: 1px solid var(--border);
			border-radius: 8px;
			cursor: pointer;
			transition: all 0.2s;
			min-width: 0;
			flex: 1;
			max-width: 200px;
		}

		.workspace-selector:active {
			background: var(--surface-hover);
		}

		.workspace-name {
			font-size: 14px;
			font-weight: 500;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.workspace-selector svg {
			width: 16px;
			height: 16px;
			flex-shrink: 0;
			opacity: 0.6;
		}

		.status {
			display: flex;
			align-items: center;
			gap: 6px;
			font-size: 13px;
			color: var(--text-muted);
			flex-shrink: 0;
		}

		.status-dot {
			width: 8px;
			height: 8px;
			border-radius: 50%;
			background: #f14c4c;
			transition: background 0.3s;
		}

		.status-dot.connected {
			background: var(--success);
		}

		main {
			flex: 1;
			display: flex;
			flex-direction: column;
			overflow: hidden;
		}

		.modal-overlay {
			position: fixed;
			inset: 0;
			background: rgba(0, 0, 0, 0.6);
			display: flex;
			align-items: center;
			justify-content: center;
			z-index: 100;
			opacity: 0;
			pointer-events: none;
			transition: opacity 0.2s;
			padding: 20px;
		}

		.modal-overlay.open {
			opacity: 1;
			pointer-events: auto;
		}

		.modal {
			background: var(--surface);
			border-radius: var(--radius);
			width: 100%;
			max-width: 400px;
			max-height: 80vh;
			overflow: hidden;
			transform: scale(0.95);
			transition: transform 0.2s;
		}

		.modal-overlay.open .modal {
			transform: scale(1);
		}

		.modal-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 16px 20px;
			border-bottom: 1px solid var(--border);
		}

		.modal-header h2 {
			font-size: 18px;
			font-weight: 600;
		}

		.modal-close {
			width: 32px;
			height: 32px;
			border: none;
			background: transparent;
			color: var(--text-muted);
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
			border-radius: 6px;
		}

		.modal-close:active {
			background: var(--surface-hover);
		}

		.modal-body {
			padding: 16px 20px;
			overflow-y: auto;
		}

		.server-list-header {
			font-size: 13px;
			color: var(--text-muted);
			margin-bottom: 10px;
		}

		.server-item {
			display: flex;
			align-items: center;
			gap: 12px;
			padding: 12px 14px;
			background: var(--bg);
			border: 1px solid var(--border);
			border-radius: 8px;
			margin-bottom: 8px;
			cursor: pointer;
			transition: all 0.2s;
		}

		.server-item:active {
			background: var(--surface-hover);
		}

		.server-item.active {
			border-color: var(--primary);
			background: rgba(0, 120, 212, 0.1);
		}

		.server-item.scanning {
			opacity: 0.6;
		}

		.server-icon {
			width: 36px;
			height: 36px;
			background: var(--surface);
			border-radius: 8px;
			display: flex;
			align-items: center;
			justify-content: center;
		}

		.server-icon svg {
			width: 20px;
			height: 20px;
		}

		.server-info {
			flex: 1;
			min-width: 0;
		}

		.server-workspace {
			font-weight: 500;
			font-size: 15px;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.server-url {
			font-size: 12px;
			color: var(--text-muted);
			margin-top: 2px;
		}

		.server-status {
			width: 8px;
			height: 8px;
			border-radius: 50%;
			background: var(--success);
			flex-shrink: 0;
		}

		.no-servers {
			text-align: center;
			color: var(--text-muted);
			font-size: 14px;
			padding: 20px;
		}

		.scanning-indicator {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 8px;
			padding: 12px;
			color: var(--text-muted);
			font-size: 14px;
		}

		.spinner {
			width: 16px;
			height: 16px;
			border: 2px solid var(--border);
			border-top-color: var(--primary);
			border-radius: 50%;
			animation: spin 0.8s linear infinite;
		}

		@keyframes spin {
			to { transform: rotate(360deg); }
		}

		.chat-container {
			flex: 1;
			overflow-y: auto;
			padding: 16px;
			-webkit-overflow-scrolling: touch;
		}

		.message {
			max-width: 85%;
			padding: 12px 16px;
			border-radius: var(--radius);
			margin-bottom: 12px;
			animation: slideIn 0.2s ease;
		}

		@keyframes slideIn {
			from { opacity: 0; transform: translateY(10px); }
			to { opacity: 1; transform: translateY(0); }
		}

		.message.user {
			background: var(--primary);
			color: white;
			margin-left: auto;
			border-bottom-right-radius: 4px;
		}

		.message.assistant {
			background: var(--surface);
			border: 1px solid var(--border);
			border-bottom-left-radius: 4px;
		}

		.message .time {
			font-size: 11px;
			opacity: 0.6;
			margin-top: 6px;
		}

		.empty-state {
			flex: 1;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			text-align: center;
			padding: 40px 20px;
			color: var(--text-muted);
		}

		.empty-state svg {
			width: 64px;
			height: 64px;
			margin-bottom: 16px;
			opacity: 0.5;
		}

		.input-area {
			padding: 12px 16px;
			padding-bottom: calc(12px + var(--safe-area-bottom));
			background: var(--surface);
			border-top: 1px solid var(--border);
		}

		.input-row {
			display: flex;
			gap: 10px;
			align-items: flex-end;
		}

		.input-wrapper {
			flex: 1;
			background: var(--bg);
			border: 1px solid var(--border);
			border-radius: var(--radius);
			overflow: hidden;
		}

		textarea {
			width: 100%;
			min-height: 44px;
			max-height: 120px;
			padding: 12px 16px;
			background: transparent;
			border: none;
			color: var(--text);
			font-size: 16px;
			font-family: inherit;
			resize: none;
			outline: none;
		}

		textarea::placeholder { color: var(--text-muted); }

		.send-btn {
			width: 44px;
			height: 44px;
			border-radius: 50%;
			border: none;
			background: var(--primary);
			color: white;
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
			transition: all 0.2s;
			flex-shrink: 0;
		}

		.send-btn:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}

		.send-btn:not(:disabled):active {
			transform: scale(0.95);
			background: var(--primary-hover);
		}

		.send-btn svg {
			width: 20px;
			height: 20px;
		}

		.toast {
			position: fixed;
			bottom: calc(100px + var(--safe-area-bottom));
			left: 50%;
			transform: translateX(-50%) translateY(100px);
			background: var(--surface);
			border: 1px solid var(--border);
			padding: 12px 20px;
			border-radius: var(--radius);
			font-size: 14px;
			opacity: 0;
			transition: all 0.3s;
			z-index: 100;
		}

		.toast.show {
			transform: translateX(-50%) translateY(0);
			opacity: 1;
		}

		.model-selector {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 8px 12px;
			background: var(--bg);
			border: 1px solid var(--border);
			border-radius: 8px;
			margin-right: 12px;
		}

		.model-selector select {
			background: transparent;
			border: none;
			color: var(--text);
			font-size: 13px;
			font-family: inherit;
			cursor: pointer;
			outline: none;
			padding-right: 4px;
		}

		.model-selector select option {
			background: var(--surface);
			color: var(--text);
		}

		.model-icon {
			width: 16px;
			height: 16px;
			flex-shrink: 0;
			opacity: 0.7;
		}
	</style>
</head>
<body>
	<header>
		<div class="header-left">
			<div class="logo">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
				</svg>
			</div>
			<div class="workspace-selector" id="workspaceSelector">
				<span class="workspace-name" id="workspaceName">${workspaceName || 'Unknown'}</span>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M6 9l6 6 6-6"/>
				</svg>
			</div>
		</div>
		<div class="model-selector">
			<svg class="model-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/>
				<path d="M12 12v10"/>
				<path d="M8 18h8"/>
			</svg>
			<select id="modelSelect">
				<option value="claude-opus-4.5">Claude Opus 4.5</option>
				<option value="gpt-5.2-codex">GPT-5.2 Codex</option>
			</select>
		</div>
		<div class="status">
			<div class="status-dot" id="statusDot"></div>
			<span id="statusText">Connecting...</span>
		</div>
	</header>

	<div class="modal-overlay" id="windowModal">
		<div class="modal">
			<div class="modal-header">
				<h2>Select Workspace</h2>
				<button class="modal-close" id="modalClose">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
						<path d="M18 6L6 18M6 6l12 12"/>
					</svg>
				</button>
			</div>
			<div class="modal-body">
				<div class="server-list" id="serverList">
					<div class="server-list-header">Open Workspaces</div>
					<div id="serverItems"></div>
				</div>
			</div>
		</div>
	</div>

	<main>
		<div class="chat-container" id="chatContainer">
			<div class="empty-state" id="emptyState">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
				</svg>
				<p>Send a prompt to Copilot Agent on your computer</p>
			</div>
		</div>

		<div class="input-area">
			<div class="input-row">
				<div class="input-wrapper">
					<textarea id="promptInput" placeholder="Ask Copilot Agent..." rows="1"></textarea>
				</div>
				<button class="send-btn" id="sendBtn">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
					</svg>
				</button>
			</div>
		</div>
	</main>

	<div class="toast" id="toast"></div>

	<script>
		const chatContainer = document.getElementById('chatContainer');
		const emptyState = document.getElementById('emptyState');
		const promptInput = document.getElementById('promptInput');
		const sendBtn = document.getElementById('sendBtn');
		const statusDot = document.getElementById('statusDot');
		const statusText = document.getElementById('statusText');
		const toast = document.getElementById('toast');
		const workspaceSelector = document.getElementById('workspaceSelector');
		const workspaceNameEl = document.getElementById('workspaceName');
		const windowModal = document.getElementById('windowModal');
		const modalClose = document.getElementById('modalClose');
		const serverItems = document.getElementById('serverItems');
		const modelSelect = document.getElementById('modelSelect');

		let ws = null;
		let messages = [];
		let workspaces = [];
		let currentWorkspace = null;
		let selectedModel = 'claude-opus-4.5';

		function loadSavedModel() {
			try {
				const saved = localStorage.getItem('copilotRemoteModel');
				if (saved) {
					selectedModel = saved;
					modelSelect.value = saved;
				}
			} catch (e) {}
		}

		function saveModel() {
			try {
				localStorage.setItem('copilotRemoteModel', selectedModel);
			} catch (e) {}
		}

		modelSelect.addEventListener('change', function(e) {
			selectedModel = e.target.value;
			saveModel();
			showToast('Model: ' + (selectedModel === 'claude-opus-4.5' ? 'Claude Opus 4.5' : 'GPT-5.2 Codex'));
		});

		function loadSavedWorkspace() {
			try {
				const saved = localStorage.getItem('copilotRemoteWorkspace');
				if (saved) currentWorkspace = JSON.parse(saved);
			} catch (e) {}
		}

		function saveWorkspace() {
			try {
				if (currentWorkspace) localStorage.setItem('copilotRemoteWorkspace', JSON.stringify(currentWorkspace));
			} catch (e) {}
		}

		function renderWorkspaceList() {
			if (workspaces.length === 0) {
				serverItems.innerHTML = '<div class="no-servers">No workspaces open in VS Code.</div>';
				return;
			}

			serverItems.innerHTML = workspaces.map(ws => {
				const isActive = currentWorkspace && ws.id === currentWorkspace.id;
				return '<div class="server-item' + (isActive ? ' active' : '') + '" data-id="' + escapeHtml(ws.id) + '">' +
					'<div class="server-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg></div>' +
					'<div class="server-info">' +
					'<div class="server-workspace">' + escapeHtml(ws.name) + '</div>' +
					'</div>' +
					(isActive ? '<div class="server-status"></div>' : '') +
					'</div>';
			}).join('');

			serverItems.querySelectorAll('.server-item').forEach(item => {
				item.addEventListener('click', () => {
					const id = item.dataset.id;
					selectWorkspace(id);
				});
			});
		}

		function selectWorkspace(id) {
			const ws = workspaces.find(w => w.id === id);
			if (!ws) return;

			currentWorkspace = ws;
			saveWorkspace();
			workspaceNameEl.textContent = ws.name;
			messages = [];
			renderMessages();
			closeModal();
			showToast('Switched to ' + ws.name);
		}

		function openModal() {
			windowModal.classList.add('open');
			renderWorkspaceList();
		}

		function closeModal() {
			windowModal.classList.remove('open');
		}

		workspaceSelector.addEventListener('click', openModal);
		modalClose.addEventListener('click', closeModal);
		windowModal.addEventListener('click', (e) => {
			if (e.target === windowModal) closeModal();
		});

		function connect() {
			const wsUrl = 'ws://' + location.host;
			ws = new WebSocket(wsUrl);

			ws.onopen = () => {
				statusDot.classList.add('connected');
				statusText.textContent = 'Connected';
			};

			ws.onclose = () => {
				statusDot.classList.remove('connected');
				statusText.textContent = 'Disconnected';
				setTimeout(connect, 2000);
			};

			ws.onmessage = (event) => {
				const data = JSON.parse(event.data);

				if (data.type === 'workspaces') {
					workspaces = data.data || [];
					if (!currentWorkspace && workspaces.length > 0) {
						currentWorkspace = workspaces[0];
						workspaceNameEl.textContent = currentWorkspace.name;
						saveWorkspace();
					} else if (currentWorkspace) {
						const stillExists = workspaces.find(w => w.id === currentWorkspace.id);
						if (!stillExists && workspaces.length > 0) {
							currentWorkspace = workspaces[0];
							workspaceNameEl.textContent = currentWorkspace.name;
							saveWorkspace();
							showToast('Workspace closed, switched to ' + currentWorkspace.name);
						}
					}
					renderWorkspaceList();
				} else if (data.type === 'history') {
					if (!data.workspaceId || (currentWorkspace && data.workspaceId === currentWorkspace.id)) {
						messages = data.data || [];
						renderMessages();
					}
				} else if (data.type === 'status') {
					showToast(data.content);
				}
			};
		}

		function renderMessages() {
			if (messages.length === 0) {
				emptyState.style.display = 'flex';
				return;
			}

			emptyState.style.display = 'none';
			const html = messages.map(msg => {
				const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
				return '<div class="message ' + msg.role + '">' +
					'<div class="content">' + escapeHtml(msg.content) + '</div>' +
					'<div class="time">' + time + '</div>' +
					'</div>';
			}).join('');

			const wasAtBottom = chatContainer.scrollHeight - chatContainer.scrollTop <= chatContainer.clientHeight + 50;
			chatContainer.innerHTML = html;
			if (wasAtBottom) {
				chatContainer.scrollTop = chatContainer.scrollHeight;
			}
		}

		function escapeHtml(text) {
			const div = document.createElement('div');
			div.textContent = text;
			return div.innerHTML;
		}

		function showToast(message) {
			toast.textContent = message;
			toast.classList.add('show');
			setTimeout(() => toast.classList.remove('show'), 3000);
		}

		function sendPrompt() {
			const prompt = promptInput.value.trim();
			if (!prompt || !ws || ws.readyState !== WebSocket.OPEN || !currentWorkspace) return;

			const currentModel = modelSelect.value;
			ws.send(JSON.stringify({
				type: 'prompt',
				content: prompt,
				workspaceId: currentWorkspace.id,
				model: currentModel
			}));

			promptInput.value = '';
			promptInput.style.height = 'auto';
		}

		promptInput.addEventListener('input', function() {
			this.style.height = 'auto';
			this.style.height = Math.min(this.scrollHeight, 120) + 'px';
		});

		promptInput.addEventListener('keydown', function(e) {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				sendPrompt();
			}
		});

		sendBtn.addEventListener('click', sendPrompt);

		loadSavedWorkspace();
		loadSavedModel();
		connect();
	</script>
</body>
</html>`;
}
