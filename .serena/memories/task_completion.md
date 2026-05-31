# Task Completion

## Build Verification
```bash
npm run build
```
Must complete without errors. Chunk size warning for main.js is expected (1.4MB).

## Lint/Typecheck
No linter or type checker configured. Skip this step.

## Test Suite
```bash
npm run test:e2e          # Full Playwright suite (headed, default)
npm run test:assets:allowlist  # Asset allowlist unit test
```
E2E tests require Chromium. Run in headed mode by default (WebGPU needs real GPU context).
For CI/headless: `npm run test:e2e:headless`

## Pre-commit Checks
1. `npm run build` — must succeed
2. `npm run test:assets:allowlist` — fast unit test
3. Manual smoke test: `npm run dev` → open browser → verify game loads

## Security
```bash
npm audit                 # Check for vulnerabilities
npm audit fix             # Auto-fix available vulnerabilities
```
Currently 5 known vulnerabilities (vite 3 high, ws 2 moderate).
