# Code Conventions

## General
- Vanilla JS — no framework, no component library
- ES modules (import/export)
- No TypeScript
- Turkish UI strings, Arabic content (letters, TTS)

## DOM Patterns
- Single centralized `dom` reference object caches all DOM queries
- State via CSS class toggles: .is-visible, .is-active, .is-collected
- CSS Custom Properties in :root for design tokens

## File Organization
- main.js is the monolithic orchestrator (modularization in progress)
- New modules go under src/ with clear domain boundaries
- Tests: Playwright E2E in tests/*.spec.js, node:test for unit tests in tests/*.test.mjs

## Naming
- camelCase for JS variables/functions
- kebab-case for CSS classes
- PascalCase only for Three.js/Rapier3D constructors

## State Management
- localStorage key: `sun-court-settings-v2`
- No external state library — direct object mutation

## Asset Conventions
- Arabic letter PNGs: `assets/arabic_huruf/`
- 3D models: GLB/GLTF format, compressed with meshopt
- Audio: .ogg files + Web Audio API synthesized SFX
- TTS: Web Speech API for Arabic pronunciation
