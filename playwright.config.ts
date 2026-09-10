import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  expect: { timeout: 7000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:8799',
    serviceWorkers: 'block',
    viewport: { width: 1366, height: 1024 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', channel: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: {
    command: 'node scripts/test-server.mjs',
    url: 'http://localhost:8799',
    reuseExistingServer: process.env.BARN_TEST_EXTERNAL === '1',
    timeout: 60000,
  },
});
