import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const CI = !!process.env.CI;

/**
 * E2E against a production build (`next build && next start`) in fixture mode, so data is deterministic
 * and a flaky third-party API can't fail CI (research R11). The build goes to `.next-e2e`.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 1 : undefined,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !CI,
    timeout: 240_000,
    env: { CATALOGUE_SOURCE: 'fixture', NEXT_DIST_DIR: '.next-e2e' },
  },
});
