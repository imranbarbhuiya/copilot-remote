# Copilot Remote

A TanStack Start web application that provides a mobile-friendly interface to interact with GitHub Copilot Agent via the `@github/copilot-sdk`. Run it locally and chat with Copilot from any device on your network.

## Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/start) (React meta-framework with Vite)
- **Copilot**: [@github/copilot-sdk](https://www.npmjs.com/package/@github/copilot-sdk) + Copilot CLI
- **Styling**: Tailwind CSS v4
- **Routing**: TanStack Router

## Commands

| Task  | Command     |
| ----- | ----------- |
| Dev   | `bun dev`   |
| Build | `bun build` |
| Start | `bun start` |

## Prerequisites

1. Install Copilot CLI: `npm install -g @github/copilot`
2. Authenticate: `copilot login`

## Documentation

- [Copilot SDK Integration](.github/docs/copilot-sdk.md) - SDK setup and session management
- [Server Architecture](.github/docs/server.md) - Server routes and HTTP streaming
- [Mobile UI](.github/docs/mobile-ui.md) - React components and design
