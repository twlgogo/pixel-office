# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pixel Office is a pixel-art office monitoring dashboard for OpenClaw AI agents. It displays real-time agent status in a Phaser 3 game environment, with agent positions reflecting their current state (online, idle, offline, working, thinking).

**Tech Stack:**
- Frontend: Phaser 3 (game engine) + Vite + TypeScript
- Backend: Express + WebSocket + SQLite (via sql.js)
- Integration: OpenClaw CLI for agent state polling

## Development Commands

```bash
# Development mode (simultaneously starts backend server on 3456 and Vite dev server on 5173)
pnpm dev

# Type checking
npx tsc --noEmit

# Build for production
pnpm build

# Run production server
pnpm start
```

**Note:** Development mode uses Vite's proxy to forward `/api` and `/ws` requests to the backend server on port 3456. Production mode serves static files from `dist/server/public`.

## Architecture

### Backend (`src/server/`)

The backend is a monolithic Express server with WebSocket support:

- **`index.ts`** - Server entry point. Initializes Express, WebSocket server, and database (sql.js). Database initialization is async and must complete before starting services.
- **`gateway.ts`** - OpenClaw CLI client wrapper. Polls agent sessions via `openclaw sessions --json --all-agents --active 60` and tracks activity changes to trigger bubble notifications.
- **`agent-engine.ts`** - State inference engine. Processes session data from gateway to determine agent status (online/idle/offline/working/thinking) and updates database.
- **`db.ts`** - SQLite operations using sql.js. Database is in-memory and auto-saves to `data/pixel-office.db` every 30 seconds.
- **`routes.ts`** - REST API endpoints: `GET /api/agents`, `POST /api/agents/:id/message`, `GET /api/health`
- **`ws-server.ts`** - WebSocket server for real-time agent updates (`agent:list`, `agent:message` events)
- **`config.ts`** - Environment configuration (PORT, GATEWAY_URL, POLL_INTERVAL, NODE_ENV)

### Frontend (`src/client/`)

Phaser 3 game with DOM UI overlay:

- **`main.ts`** - Client entry. Initializes Phaser game, WebSocket client, and UI components. Uses global state to prevent HMR re-initialization issues.
- **`game/OfficeScene.ts`** - Main scene managing all AgentSprite entities, handling agent state updates and position transitions.
- **`game/PreloadScene.ts`** - Asset preloader for sprites and backgrounds.
- **`game/entities/AgentSprite.ts`** - Phaser sprite representing an agent. Position determined by status via `STATUS_POSITIONS`, with offset for multiple agents in same area via `AREA_OFFSETS`.
- **`game/systems/BubbleSystem.ts`** - Speech bubble system for displaying agent messages.
- **`ui/AgentList.ts`** - Sidebar list synchronized with OfficeScene. Clicking an agent opens ChatPanel.
- **`ui/ChatPanel.ts`** - Slide-in chat panel for sending messages to agents. Uses global callback `(window as any).__pixelOfficeOpenChat` for cross-component communication.
- **`ui/SettingsPanel.ts`** - Settings panel for configuration.

### Agent State System

Agent status is inferred from session activity:
- `online` - Active < 1 minute ago
- `idle` - Active 1-5 minutes ago
- `offline` - Active > 5 minutes ago or never active
- `working` - Currently processing (inferred from session state)
- `thinking` - Currently thinking (inferred from session state)

Positions in the office map (`AgentSprite.ts`):
- Work area (online): x:760, y:320
- Rest area (idle): x:620, y:180
- Research area (working/thinking): x:830, y:280
- Entrance (offline): x:640, y:550

## Critical Synchronization Requirements

### Known Agents List

When adding/removing agents, update **both** locations:

1. `src/server/gateway.ts` - `KNOWN_AGENTS` object
2. `src/client/game/OfficeScene.ts` - `KNOWN_AGENTS` object

Example:
```typescript
export const KNOWN_AGENTS: Record<string, { label: string; emoji: string }> = {
  'agent:main:main': { label: '蜂鸟 (主 Agent)', emoji: '🐦' },
  // ... other agents
};
```

### Agent Color Mapping

Update `src/client/game/entities/AgentSprite.ts` - `agentTints` when adding new agents:
```typescript
const agentTints: Record<string, number> = {
  '🐦': 0x4FC3F7,  // Blue
  '🦉': 0x8D6E63,  // Brown
  // ... add emoji -> color mappings here
};
```

## OpenClaw CLI Dependency

The project requires the `openclaw` CLI to be available in PATH. Key commands used:

```bash
# Get agent sessions
openclaw sessions --json --all-agents --active 60

# Send message to agent
openclaw agent chat --agent "agent:main:main" --message "test"
```

**tsconfig.json** has a path alias configured:
```json
"paths": {
  "openclaw": ["C:/Users/43938/AppData/Roaming/npm/node_modules/openclaw"]
}
```

If your openclaw installation path differs, update this alias.

## Build Output

Development: Vite serves from `src/client/` with proxy to backend
Production: `pnpm build` outputs to `dist/server/public` (served by Express)

Server TypeScript is compiled separately via `tsc -p tsconfig.server.json`

## Database Persistence

SQLite database (sql.js) runs in-memory and persists to `data/pixel-office.db` every 30 seconds. Database must be fully initialized before any server routes or WebSocket handlers can access it.

## WebSocket Events

**Server → Client:**
- `agent:list` - Full agent list update `{ agents: AgentState[] }`
- `agent:message` - Agent message notification `{ agentId, message }`
- `ping` - Heartbeat

**Client → Server:**
- `ping` / `pong` - Heartbeat

## Global Callbacks

ChatPanel uses a global callback for cross-component communication:
```typescript
(window as any).__pixelOfficeOpenChat = (agentId, agentName) => { /* ... */ };
```

This allows Phaser sprites to open the chat panel via click handlers.

## Environment Variables

Default values in `.env.example`:
- `PORT=3456` - Server port
- `GATEWAY_URL=ws://127.0.0.1:18789` - OpenClaw Gateway (currently unused, reserved for future)
- `POLL_INTERVAL=5000` - Agent status polling interval (ms)
- `NODE_ENV=development` - Environment

Copy `.env.example` to `.env` and adjust as needed.
