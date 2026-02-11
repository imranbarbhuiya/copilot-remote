import { createFileRoute } from '@tanstack/react-router';

import * as CopilotBridge from '~/lib/copilot-bridge';

export const Route = createFileRoute('/api/chat')({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const body = (await request.json()) as {
					sessionId: string;
					prompt: string;
					model?: string;
				};

				const stream = CopilotBridge.sendMessageStream(body.sessionId, body.prompt, body.model);

				return new Response(stream, {
					headers: {
						'Content-Type': 'text/event-stream',
						'Cache-Control': 'no-cache',
						Connection: 'keep-alive',
					},
				});
			},
		},
	},
});
