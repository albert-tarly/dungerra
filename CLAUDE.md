# CLAUDE.md

Dungerra web client: a browser-based, multiplayer, top-down dungeon shooter built with TypeScript, React 19, and three stacked HTML5 canvases, bundled by webpack. The client is a **thin renderer**. All gameplay runs on the authoritative Go server, `dungerra-api`. The client sends inputs, receives state deltas over a WebSocket, interpolates, draws, and plays sounds.

## Commands

```sh
npm install
npm run dev            # webpack-dev-server on :9000 (opens browser); talks to http://localhost:8080
npm start              # same, without opening a browser
npm run typecheck      # tsc --noEmit — must pass
npm run build          # production bundle -> dist/ (index.html + 404.html), via cross-env
npm run lint           # eslint src (type-aware) — must pass with 0 problems
npm run lint:fix       # apply ESLint autofixes
npm run format         # prettier --write src
npm run format:check   # must pass
```

Node 26 is required (`.nvmrc`, `engines`; CI reads `.nvmrc`). The dev machine runs Windows, and the shell is either PowerShell or Git Bash. Use the syntax of whichever tool you are calling. npm runs scripts through cmd.exe on Windows, so scripts that set environment variables must use `cross-env` (as `build` does), not POSIX `VAR=value cmd`.

For local play you need the server running: `cd ../dungerra-api && go run main.go`, which serves on :8080. In production, the client talks to `https://dungerra.onrender.com` (see `API_DOMAIN` in `src/config.ts`, which `NODE_ENV` switches).

## Architecture

```
index.tsx ─ Game.loadResources() preload ─ <App> (react-router, basename /dungerra in prod)
  AuthProvider (contexts/AuthContext) → ProtectedRoute → screens (components/*)
    GameScreen ─ creates Game(3 canvases) after SessionManager.joinSession()
      Game (utils/Game.ts)      rAF loop, input listeners, DPR-aware resize, owns World
        World (utils/World.ts)  entity store, applyGameStateDelta, input → server, camera, UI/darkness drawing
          entities/*            Player, OtherPlayer, Enemy, Wall, Bonus, Shop, Ray, Bullet (via BulletManager)
api/  AuthManager · HttpClient (REST, Bearer token) · SessionManager · SocketService (WebSocket)
```

### Data flow (server-authoritative)

- **Outbound:** `World.handleInput` builds an `InputMessage` (movement flags, shoot, item and purchase keys, `aimRotation`) and sends it **only when it changes**. Aim-only updates are throttled (`AIM_SEND_INTERVAL_MS`, `AIM_SEND_MIN_DELTA_DEG`), and a keep-alive goes out every 1s. The client never sends positions, damage, money, or similar values.
- **Inbound:** `SocketService` decodes a `GameMessage` (protobuf binary by default; `localStorage.setItem("protocol","json")` switches to JSON for DevTools). `gameStateDelta` messages go to `World.applyGameStateDelta`, which handles added, updated, and removed entries per entity type. Out-of-order deltas (`timestamp <= last`) are dropped.
- **Protocol types** come from the `dungerra-api` npm package (a GitHub dependency) and are re-exported through `src/types/socketEvents.ts`. Always import from there, never from `dungerra-api` directly. Webpack's ts-loader compiles that package from source (see the `exclude` regex in `webpack.config.js`).

### Time and smoothing (read before touching movement or bullets)

- `serverClock` (`utils/ServerClock.ts`) maps server epoch ms onto the local monotonic clock. Server timestamps (`delta.timestamp`, `bullet.deletedAt`) must be compared against `world.renderTime` or `serverClock.now()`, **never `Date.now()`**.
- `world.snapshotTime` is the server time of the delta being applied. Entities stamp incoming poses with it.
- `world.renderTime` is `serverClock.now() - INTERPOLATION_DELAY_MS`. Everything moving is drawn slightly in the past.
- `PoseBuffer` stores timestamped poses for each entity and samples them at `renderTime`: it lerps position, takes the shortest-arc angle, snaps on teleport (`TELEPORT_DISTANCE`), and inserts a synthetic "stood still" snapshot across gaps, because the server only sends changes. Player, OtherPlayer, and Enemy all use it. There is **no client-side prediction**, so the local player is interpolated too.
- Bullets are **not** streamed. They arrive once with an origin and velocity, and `Bullet.advance` flies them locally from `(origin, originTime)` until they hit a wall, then waits for the server's removal. `updatedBullets` (`rebase`) only supports older servers. Railgun and shotgun shots are hitscan: their velocity is the whole beam. Inactive railgun and rocket bullets linger for `BULLET_AFTERLIFE_MS_BY_WEAPON_TYPE` to show effects.

### Rendering

- There are three canvases with identical CSS boxes: **game** (floor, entities, bullets), **light** (darkness overlay; torches are cut out with `destination-out`; night vision gives a green tint), and **ui** (HUD, arrows, debug info, inventory and shop overlays). `Game.draw` clears all three each frame.
- **Units:** all game, layout, and input code works in CSS pixels through the `viewport` singleton (`utils/Viewport.ts`). Backing stores are in device pixels, and the contexts carry a DPR transform. Do not use `ctx.canvas.width/height` for layout.
- The camera follows the local player, and the world is never rotated. Use `world.worldToScreenCoordinates(point)` for conversions. Rotation follows the server convention: degrees, 0 = +Y, `atan2(-dx, dy)`.
- **Performance matters** (recent commits are perf work). In the per-frame paths (`update`, `draw`, `handleInput`), avoid allocations and avoid serializing or rebuilding arrays. Use `EntityCollection` (an id → entity `Map` with a cached list), cull with `isNearView` and `DRAW_CULL_MARGIN`, do a cheap anchor-distance reject before building rects, and precompute constant offsets at module scope (see `Enemy.ts`).
- Visibility is part of gameplay: enemies are drawn only when lit (`world.isLitByTorch`) or when the player has night vision, unless debug mode is on. F3 toggles debug overlays (collision boxes, gun points, chunk grid, session info).

### Patterns and conventions

- **Interfaces plus factory injection:** each entity has an interface in `src/types/screen-objects/I*.ts` with an `I*Factory` constructor type. `World` receives the concrete classes in its constructor (see `Game.start`). New entity types follow the same pattern: interface, factory type, class in `entities/` extending `ScreenObject`, `EntityCollection` in `World`, and handling for added, updated, and removed entries in `applyGameStateDelta`. Entities depend on `IWorld`, never on `World`.
- **Entity lifecycle:** constructed from a server message (`constructor(world, data)` or `static fromGameState`), mutated by `applyFromGameStateDelta(update)`, advanced by `update(dt)` (dt in **seconds**), and drawn with `draw(ctx, uiCtx)`. Debug overlays go on `uiCtx`.
- **Singletons:** `AuthManager`, `SessionManager`, `SocketService`, `AudioManager`, and `ImageManager` use `getInstance()`. `viewport` and `serverClock` are module-level instances.
- **Assets:** import the file in `src/assets/index.ts`, add it to `TEXTURES`, `SOUNDS`, or `ANIMATIONS` in `config.ts`, and preload it in `Game.loadResources` (critical assets are awaited, the rest load in the background). Entities fetch images with `void ImageManager.getInstance().loadImage(...).then(img => this._x = img)` (fire-and-forget, hence `void`) and must tolerate `null` until the image loads. Sounds are `.ogg`, and `AudioManager.playSound` silently warns if a sound isn't loaded yet. Positional volume falls off with distance from the player.
- **Config:** all tunables and lookup tables live in `src/config.ts` as `SCREAMING_SNAKE_CASE` constants with a units comment. Typed lookups use `Record<Type, …>`, and enums are `as const` objects with a derived union type (`ENEMY_TYPES` → `EnemyType`). Many gameplay values mirror server constants (`../dungerra-api/internal/config/config.go`). The server is the source of truth, so when a client constant must match, check there.
- **React** handles screens, routing, and auth only. The game itself never re-renders through React: `GameScreen` is memoized and holds `Game` in a ref. Do not move per-frame state into React state.

## Code style

- TypeScript `strict`, no `any` (use `unknown` and narrow; type `response.json()` results with `as T`). Explicit return types on exported functions and public methods.
- Prettier config is in `.prettierrc.json`: double quotes, semicolons, 2 spaces, trailing commas, width 80. The whole `src` tree is formatted; keep it that way (`npm run format:check`).
- ESLint (`eslint.config.mjs`): `recommendedTypeChecked` + `stylisticTypeChecked` + React + React Hooks, with Prettier's conflicting rules turned off. The config comments every deliberate deviation. The codebase keeps explicit field annotations (`private _x: number = 0`), plain value imports (no `import type`), and `!` assertions where the invariant is known. Rules worth knowing:
  - Handle every promise: `await` it, `.catch` it, or mark intentional fire-and-forget with `void` (asset loads, `void navigate(...)`). Async React event handlers in JSX attributes are allowed as long as they catch their own errors.
  - Use `===`, braces on every `if`, `??` rather than `||` for defaults, and `?.` chains.
  - Hook dependency arrays are complete. Stable singletons go in the array too (memoize them with `useMemo` or define callbacks with `useCallback`).
  - Escape `'` and `"` in JSX text (`&apos;`, `&quot;`).
  - Don't add `eslint-disable` without a comment explaining why the rule is wrong in that spot (there is exactly one, in `AuthContext.tsx`).
- Naming: `PascalCase` classes and files for classes, `camelCase` util files and functions, an `I` prefix for **every** interface (including props and DTOs: `ISession`, `IProtectedRouteProps`; ESLint enforces it), `type` aliases only for unions and intersections, a `_` prefix for private fields exposed through getters (`private _lives` / `get lives()`), and a `_` prefix for unused parameters and variables (`_dt`).
- Comments explain **why** (constraints, server behavior, perf reasons) in full sentences, as in `World.ts`, `PoseBuffer.ts`, and `Game.ts`. Don't narrate what the code does.
- Use `console.log/warn/error` for diagnostics. The codebase has no logging framework.

## Server and protocol (`../dungerra-api`)

- The Go server is checked out next to this repo at `../dungerra-api` and has its own `CLAUDE.md`. Follow its rules when working there.
- To change the protocol: edit `internal/protocol/messages.proto` there, regenerate (`npm run proto:generate:win`), and update `converters.go` and the JSON types per its rules. Add fields only with new numbers. Once that change is pushed, run `npm update dungerra-api` here so `package-lock.json` picks up the new commit, then adapt the client.
- **Ask before** changing the protocol, server behavior, or anything that breaks older clients. Never edit `node_modules/dungerra-api`.
- Gameplay logic (damage, AI, prices, drops) belongs on the server. If a change looks like it needs client-side game logic, it probably belongs in the server. Ask.

## Verification

- After every change, run `npm run typecheck`, `npm run lint`, and `npm run format:check`, and run `npm run build` for anything affecting bundling, assets, or config. Report the real results. CI runs the same three checks before every deploy, so a failing check blocks the deploy.
- There is no automated test suite. Gameplay, rendering, and audio can only be checked by playing with the local server running. Say explicitly when something wasn't verified in-game rather than implying it works.
- When changing networking or interpolation, consider out-of-order and late deltas, gaps (the server sends only changes), respawn teleports, and clock offset between client and server.

## Git and deploy

- Committing to `main` is fine, but commit only when asked and push only when asked. **Every push to `main` deploys** through `.github/workflows/deploy.yml`, which runs the checks, builds `dist/`, and replaces the `docs/` folder of the `gh-pages` branch with it. GitHub Pages serves `gh-pages:/docs` under `/dungerra/`, and `404.html` (a copy of `index.html`) keeps deep links like `/dungerra/<sessionId>` working.
- Never commit build output to `main` (`dist/` is gitignored, and there is no `docs/` on main). Never merge `main` into `gh-pages` or edit `gh-pages` by hand: it holds only deploy commits, and its other files are stale leftovers of the old merge-based deploy.
- Commit messages are short and imperative. The history mixes `feat: …` / `fix: …` with plain sentences, so either style works.
- Keep diffs focused. Report unrelated bugs instead of fixing them silently. Don't bump dependencies unless asked.
- Update `README.md` when controls, routes, or setup change.

## Known issues (fix only when asked; each is a separate task)

- `World` keeps an unused `chunks` map that is shown only in debug mode.
- `GameScreen` duplicates its cleanup in two effects.
