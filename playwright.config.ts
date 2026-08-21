import { defineConfig, devices } from '@playwright/test';

const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000';
const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: process.env.CI
    ? [['line'], ['html', { outputFolder: 'reports/e2e', open: 'never' }]]
    : [['list']],
  use: {
    baseURL: webOrigin,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'pnpm dev',
    url: webOrigin,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      API_ORIGIN: apiOrigin,
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://wb:wb@localhost:5432/wb',
      EMAIL_MODE: 'console',
      EVENT_URL_ENCRYPTION_KEY: process.env.EVENT_URL_ENCRYPTION_KEY ?? '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    },
  },
});
