# PROJECT STATE

> GSD Pattern: Cross-session state tracking. Keeps the AI agent oriented across sessions.

## Project Identity

| Field | Value |
|-------|-------|
| Name | electrobun-arabic-game |
| Type | 3D Browser Educational Game |
| Stack | Three.js + Rapier3D + Vite + Vanilla JS |
| UI Lang | Turkish |
| Entry | `src/main.js` (7430 lines, modularization in progress) |

## Current Phase

| Field | Status |
|-------|--------|
| Phase | Active Development |
| Focus | main.js modularization waves |
| Blocker | None |

## Codebase Health

| Concern | Status | Notes |
|---------|--------|-------|
| main.js size | 7430 lines | Local multiplayer client removed; debug globals moved behind module gate |
| styles.css | 3512 lines | Custom CSS, no preprocessor |
| Test coverage | 3 Playwright specs | E2E only, no unit tests |
| UI framework | None (vanilla) | No component library |
| 3D rendering | Three.js WebGPU + WebGL fallback | renderer.js handles fallback |

## Architecture Map

```
src/
  main.js                    # Game controller/orchestrator (modularization in progress)
  letterCatalog.js           # 30 Arabic letter entries with metadata
  styles.css                 # All styling (dark theme + gold accents)
  debug/
    gameDebugApi.js          # Test/debug global registration behind env gate
  network/
    multiplayerClient.js     # Shared WebSocket client and multiplayer storage helpers
  runtime/
    renderer.js              # WebGPU/WebGL renderer factory
  workers/
    simulation.worker.js     # Rapier3D physics (Web Worker)
```

## Key Patterns Observed

- **DOM State Machine**: CSS class toggles (.is-visible, .is-active, .is-collected)
- **Centralized DOM Ref Map**: Single `dom` object caches all DOM queries
- **CSS Custom Properties**: Design tokens in :root (--ink, --muted, --frame, --gold-bright)
- **Responsive Tiers**: 4 breakpoints (1120px, 900px, 700px, touch)
- **Worker Architecture**: Physics offloaded to Web Worker via postMessage
- **Settings Persistence**: localStorage key `sun-court-settings-v2`

## Decisions Log

| Date | Decision | Reason |
|------|----------|--------|
| 2026-03-30 | Adopted GSD principles | Better context management, parallel agents, structured workflow |
| 2026-03-30 | Created STATE.md | Cross-session awareness for AI agent |
| 2026-04-06 | Playwright baslangic akisi harita secim overlay ile uyumlu hale getirildi | Map secimi eklendikten sonra `#start-btn` dogrudan tiklanamiyordu; test helper ve beklentiler yeni akisa gore guncellendi |
| 2026-04-06 | Playwright varsayilan kosusu slowMo olmadan hizlandirildi; headless mod opsiyonel bir override oldu | WebGPU/Three sahnesi headless Chromiumda kararsizdi; stabil hiz kazanci icin varsayilan mod headed + slowMo 0 secildi |
| 2026-04-06 | Kisa E2E npm scriptleri eklendi (`test:e2e:smoke`, `letters`, `physics`, `portals`) | Tam suite yerine hedefe yonelik hizli dogrulama komutlariyla iterasyon suresi kisaldi |
| 2026-04-06 | Preview-only public share akisi geri kuruldu (`share`, `share:cloudflare`, `share:ngrok`, `share:auto`) | Git rollback sonrasi share scriptleri ve `scripts/share-public.ps1` silinmisti; mevcut proje durumuna uygun hafif tunnel akisi tekrar eklendi |
| 2026-04-06 | Multiplayer/admin lobby-first restore rebuilt from artifacts | Restored join-lobby startup, default low quality, admin/host pages, Vite proxy entries, and local WS+REST multiplayer backend with admin controls |
| 2026-04-07 | `npm run share:auto` yeniden full-stack paylasim akisi oldu | Komut artik multiplayer server, Vite preview ve Cloudflare/ngrok tunnel adimlarini tek seferde baslatiyor |
| 2026-04-07 | Admin/host QR karti auth oncesi de tam QR render ediyor | `/api/state` artik QR data URL donduruyor; admin QR shell responsive hale getirildi ve canvas kirpilmasi engellendi |
| 2026-04-07 | Consensus plan approved for 50-player multiplayer/runtime UX stabilization | Plan saved at `.omx/plans/ralplan-multiplayer-performance-ui-audio.md`; Phase 1 is runtime/network/UI/audio, Phase 2 is asset/object compression |
| 2026-04-07 | Ralph Phase 1 stabilization landed and verified | Music defaults off, mobile FPS chip compacted, letter-card/TTS/skill UX tightened, remote roster LOD + debug hooks added, and server roster broadcasts now coalesce snapshot bursts |
| 2026-04-07 | Public asset sync switched from whole-pack mirroring to explicit allowlist generation | `scripts/sync-public-assets.mjs` now scans live `/assets/` refs and only emits required embedded GLTF public files; raw `.obj/.mtl/.import` payloads are no longer shipped from `dist` |
| 2026-04-07 | Phase 2 object compression landed with meshopt-backed public runtime assets | All shipped 3D object refs now resolve to compressed `.glb` files under `public/assets`, `GLTFLoader` uses `MeshoptDecoder`, and server load verification passed with 50 simultaneous WebSocket players |
| 2026-04-07 | Texture/runtime optimization wave added with browser bot harness | Basis transcoder support and KTX2 manifest are now emitted for optional texture compression, shockwave/loot FX reuse pooled nodes instead of reallocating, `bot.html` + `src/bot.js` provide lightweight browser clients, and the browser harness reached 50 concurrent bot pages |
| 2026-04-07 | Two-real-player freeze path hardened on WebGL devices | `createGameRenderer()` no longer keeps Three.js WebGPU renderer in WebGL2 fallback mode; non-WebGPU clients now use plain `THREE.WebGLRenderer`, fallback assets stay geometric/lightweight for remotes, and the 2-page multiplayer reproduction finished with both clients in `playing` and zero `INVALID_OPERATION` console errors |
| 2026-04-28 | Added `npm run start:full` as a discoverable alias for the full-stack launcher | `share:auto` already boots multiplayer server, Vite preview, and the tunnel; the new alias makes the all-in-one start command easier to find and use |
| 2026-04-28 | Technical lesson deck created under `presentation_lesson/output/output.pptx` | Covers project requirements, stack, folder structure, runtime communication, build/test flow, admin/multiplayer flow, and the final "ne degil / neden" lesson |
| 2026-04-30 | main.js review/refactor report created under `docs/main-js-review-and-refactor-plan.md` | Browser-use could not navigate to ChatGPT.com due local app-server path failure; local Codex review identified multiplayer client duplication and simulation authority as first refactor decisions |
| 2026-04-30 | Comprehensive main.js modularization master plan created under `docs/main-js-comprehensive-modularization-plan.md` | Browser-use selected the ChatGPT tab but page interaction still failed with local app-server path error; plan captures removal targets, missing module boundaries, wave order, tests, risks, and first atomic migration |
| 2026-04-30 | Wave 1 modularization applied: `main.js` now uses shared `src/network/multiplayerClient.js` | Removed duplicate local MultiplayerClient, preserved player-name sanitization and env WebSocket URL support, and reduced `main.js` from 8650 to 7430 lines |
| 2026-04-30 | Wave 2 started: debug global registration moved to `src/debug/gameDebugApi.js` | Keeps Playwright/debug hooks working while putting public debug surface behind dev / `VITE_ENABLE_DEBUG_API=1` gate |
| 2026-04-30 | Playwright packages aligned on 1.59.1 and refactor baseline recorded | `npm run test:e2e:*` now uses matching runner/runtime versions; baseline saved at `docs/refactor-baseline.md` |

## Asset Inventory

- 30 Arabic letter PNGs (`assets/arabic_huruf/`)
- Kaykit 4 packs (dungeon, characters, halloween, hexagon) — all GLB/GLTF
- Audio: Bevy .ogg music files + Web Audio API synthesized SFX
- TTS: Web Speech API for Arabic pronunciation

## Active Todos

- Next: extract `renderGameToText` into `src/debug/gameStateSerializer.js` without changing JSON output.
- Later: continue settings, UI, audio, simulation and world-builder waves from `docs/main-js-comprehensive-modularization-plan.md`.

## Last Updated

2026-04-30T01:48:32+03:00
