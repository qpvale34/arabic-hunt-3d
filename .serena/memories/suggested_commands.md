# Suggested Commands

## Development
```bash
npm run dev              # Vite dev server at http://127.0.0.1:4173
npm run dev:all          # Multiplayer server + Vite dev server concurrently
npm run preview          # Serve built dist/ at http://127.0.0.1:4173
npm run build            # Production build
```

## Full System (with tunnel)
```bash
npm run share:auto       # Server + Vite preview + Cloudflare/ngrok tunnel
npm run start:full       # Alias for share:auto
npm run share:cloudflare # Cloudflare tunnel only
npm run share:ngrok      # ngrok tunnel only
```

## Server Only
```bash
npm run server           # Multiplayer server at port 2567
```

## Testing
```bash
npm run test:e2e         # Full Playwright suite (21 tests, headed by default)
npm run test:e2e:smoke   # Smoke tests only
npm run test:e2e:letters # Letter collection tests
npm run test:e2e:physics # Physics interaction tests
npm run test:e2e:portals # Portal transition tests
npm run test:e2e:phase1  # Phase 1 stabilization tests
npm run test:e2e:headless # Headless mode override
npm run test:e2e:headed  # Headed with slowMo
npm run test:e2e:debug   # Debug mode with slowMo
npm run test:assets:allowlist  # Asset allowlist unit test
npm run test:server:50players  # Server load test
npm run test:server:coalescing # Server roster coalescing test
```

## Windows-Specific
- PowerShell scripts use `-ExecutionPolicy Bypass`
- `share-public.ps1` spawns background processes via `Start-Process`
- Process cleanup uses `Get-CimInstance Win32_Process` + port-based kill
