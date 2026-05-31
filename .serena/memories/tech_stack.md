# Tech Stack

## Runtime
- JavaScript (ES modules, `"type": "module"` in package.json)
- Node.js for multiplayer server and build scripts
- Windows 11 development environment

## Core Dependencies
- three ^0.183.2 — 3D rendering (WebGPU + WebGL fallback)
- @dimforge/rapier3d-compat ^0.19.3 — physics engine (Web Worker)
- nipplejs ^0.10.2 — mobile joystick input
- qrcode ^1.5.4 — QR code generation for sharing
- ws ^8.20.0 — WebSocket server

## Dev Dependencies
- vite ^7.3.1 — build tool and dev server
- @playwright/test ^1.59.1 — E2E testing
- @gltf-transform/cli ^4.3.0 — GLTF optimization
- concurrently ^9.2.1 — parallel process runner

## Build
- Vite multi-page build (4 HTML entries: main, admin, host, bot)
- Assets: GLB/GLTF/FBX/OBJ bundled by Vite
- Pre-build: sync-public-assets.mjs scans refs and emits only required files

## Version Pins
- Playwright: 1.59.1 (matched runner/runtime)
- Vite: 7.3.1 (7.x series, not 8.x)
