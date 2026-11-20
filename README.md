# Dungerra

A multiplayer dungeon exploration game built with TypeScript, React, and HTML5 Canvas.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Start development server:

```bash
npm run dev
```

3. Build for production:

```bash
npm run build
```

## Development

The game uses TypeScript, React, and HTML5 Canvas for rendering. The main components are:

### Frontend Architecture

- **React Router**: Handles client-side routing between screens
- **Components**:
  - `LoginScreen`: sign-in; shows the providers the server enables (`GET /auth/providers`): Google, and/or local username + password accounts (sign in / create account)
  - `LeaderboardScreen`: the lobby, with a Sessions tab and a Leaderboard tab
  - `GameScreen`: Main game canvas wrapper
  - `LegendScreen`: Game instructions and tutorial
- **Game Engine**:
  - `src/utils/Game.ts`: Main game loop and initialization
  - `src/entities/`: Game entities (Player, Enemy, Bonus, etc.)
  - `src/config.ts`: Game configuration

### Routes

- `/`: Login screen (redirects to `/sessions` once signed in)
- `/sessions`: Lobby, Sessions tab: join, create, or delete a game session
- `/leaderboard`: Lobby, Leaderboard tab
- `/legend`: Game instructions
- `/:sessionId`: Active game session

In production the app is served under `/dungerra/` on GitHub Pages. Every push to `main` builds it and publishes `dist/` to the `docs/` folder of the `gh-pages` branch.

## Controls

- W / S or Up / Down: Move forward / backward along the way you face
- A / D or Left / Right: Strafe sideways
- Mouse: Aim (you turn to face the cursor)
- Left mouse button / Space: Shoot (hold to keep firing)
- 1..8: Use inventory item
- ~ or E: Toggle inventory
- Enter / Escape: Enter/exit shop
- F3: Toggle debug mode
