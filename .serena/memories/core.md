# Project Core

## Identity
- Name: electrobun-arabic-game
- Type: 3D browser educational game — Arabic letter collection with gamification
- UI language: Turkish, content: Arabic

## Source Map
```
src/
  main.js                    # Game controller/orchestrator (~8273 lines, modularization in progress)
  letterCatalog.js           # 30 Arabic letter entries with metadata (~749 lines)
  styles.css                 # All styling, dark theme + gold accents (~4084 lines)
  admin.js                   # Admin panel logic
  bot.js                     # Lightweight browser bot client
  debug/
    gameDebugApi.js          # Debug/test global registration behind env gate
  network/
    multiplayerClient.js     # Shared WebSocket client and multiplayer helpers
  runtime/
    renderer.js              # WebGPU/WebGL renderer factory with fallback
  workers/
    simulation.worker.js     # Rapier3D physics in Web Worker
server/
  multiplayer-server.mjs     # Node.js WebSocket multiplayer server (port 2567)
scripts/
  sync-public-assets.mjs     # Mirrors assets to public/ via allowlist
  share-public.ps1           # PowerShell: starts server + vite preview + tunnel
  browser-load-harness.mjs   # Bot load testing harness
tests/
  letter-collection.spec.js
  physics-interactions.spec.js
  portal-transition.spec.js
  phase1-stabilization.spec.js
  asset-allowlist.test.mjs
  server-50-player-load.test.mjs
  server-roster-coalescing.test.mjs
```

## HTML Entry Points
- `index.html` — main game
- `admin.html` — admin panel (password: sun-court-admin)
- `host.html` — host view
- `bot.html` — bot client for load testing

## Key Invariants
- Physics runs in Web Worker via postMessage (Rapier3D)
- Renderer uses WebGPU with WebGL fallback (renderer.js handles detection)
- DOM state machine via CSS classes (.is-visible, .is-active, .is-collected)
- Centralized `dom` reference map in main.js
- CSS Custom Properties for design tokens (--ink, --muted, --frame, --gold-bright)
- Settings persistence via localStorage key `sun-court-settings-v2`
- GLTF files embed binary as base64 data URIs
- Arabic letter PNGs in `assets/arabic_huruf/`

## Modularization Status
- Wave 1 done: multiplayerClient.js extracted (main.js reduced from 8650 to ~7430 lines, now ~8273)
- Wave 2 done: debug global registration moved to gameDebugApi.js
- Plan at docs/main-js-comprehensive-modularization-plan.md
- Next: extract renderGameToText into src/debug/gameStateSerializer.js
