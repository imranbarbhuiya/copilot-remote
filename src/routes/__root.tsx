import { Outlet, createRootRoute, HeadContent, Scripts } from '@tanstack/react-router';

import type { ReactNode } from 'react';
import '../styles.css';

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: 'utf8' },
			{ name: 'viewport', content: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no' },
			{ name: 'apple-mobile-web-app-capable', content: 'yes' },
			{ name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
			{ name: 'theme-color', content: '#1e1e1e' },
		],
		links: [{ rel: 'icon', href: '/favicon.ico' }],
	}),
	component: RootComponent,
	notFoundComponent: NotFoundComponent,
});

function NotFoundComponent() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
			<h1 className="mb-4 text-4xl font-bold">404</h1>
			<p className="mb-6 text-text-muted">Page not found</p>
			<a className="rounded-lg bg-primary px-6 py-3 text-white" href="/">
				Go Home
			</a>
		</div>
	);
}

function RootComponent() {
	return (
		<RootDocument>
			<Outlet />
		</RootDocument>
	);
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}
