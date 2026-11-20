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

4. Build for the desktop app and LAN hosts (output in `dist-desktop/`):

```bash
npm run build:desktop
```

The desktop build is served by the game server itself. It uses the page's own origin as the server address and is served at `/` rather than `/dungerra/`. To try it, start the server with `STATIC_DIR` pointing at it and open the server's address:

```bash
cd ../dungerra-api
DATA_DIR=data/desktop STATIC_DIR=../dungerra/dist-desktop go run main.go -no-dotenv
```

See `../dungerra-api/docs/decisions/desktop-version.md` for the design.

## Development

The game uses TypeScript, React, and HTML5 Canvas for rendering. The main components are:

### Frontend Architecture

- **React Router**: Handles client-side routing between screens
- **Components**:
  - `LoginScreen`: sign-in; shows the providers the server enables (`GET /auth/providers`): Google, and/or local username + password accounts (sign in / create account)
  - `LeaderboardScreen`: the lobby, with a Sessions tab and a Leaderboard tab. Creating a game requires choosing a difficulty (`DifficultyPicker`): Peaceful, Easy, Hard, Nightmare or Custom (sliders for each setting, with an Advanced section). The server stores the resolved settings per session; the client mirrors the presets in `config.ts` only for display.
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
- Enter: Enter shop
- Escape: Exit shop; outside a shop, open the game menu (Resume / Leave Game, back to the lobby). The game keeps running while the menu is open.
- F3: Toggle debug mode
