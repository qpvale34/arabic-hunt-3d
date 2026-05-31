import { defineConfig, devices } from '@playwright/test';

const isTruthy = (value) => /^(1|true|yes|on)$/i.test(String(value ?? '').trim());
const debugMode = isTruthy(process.env.PLAYWRIGHT_DEBUG) || isTruthy(process.env.PWDEBUG);
const headlessMode = isTruthy(process.env.PLAYWRIGHT_HEADLESS);
const headedMode = debugMode || isTruthy(process.env.PLAYWRIGHT_HEADED) || !headlessMode;
const slowMo = Number(process.env.PLAYWRIGHT_SLOWMO ?? (debugMode ? 500 : 0));

export default defineConfig({
  testDir: './tests',
  testIgnore: ['**/*.test.mjs'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    headless: !headedMode,
    launchOptions: {
      slowMo,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        headless: !headedMode,
      },
    },
  ],
  webServer: [
    {
      command: 'npm run server',
      url: 'http://127.0.0.1:2567/health',
      reuseExistingServer: true,
      timeout: 60000,
    },
    {
      command: 'npm run dev',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: true,
      timeout: 60000,
    },
  ],
});
