import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end configuration.
 *
 * The suite boots its own stack: a mock JobTech server and the app pointed at
 * it, so the tests never depend on a third-party API being up — or on it
 * returning the same ads twice. E-mail verification is switched off here only;
 * the environment schema refuses that flag in production.
 */

const PORT = Number(process.env.E2E_PORT ?? 3100);
const MOCK_PORT = Number(process.env.MOCK_JOBTECH_PORT ?? 4010);
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * Use a Chromium that is already on the machine when one is pointed at.
 *
 * Some sandboxes ship a browser build that does not match this Playwright
 * version's expected revision; rather than downloading a second copy, honour an
 * explicit path. Unset — as in CI, where `playwright install` runs — Playwright
 * picks its own.
 */
const chromium = process.env.PLAYWRIGHT_CHROMIUM_PATH
  ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
  : {};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 45_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'sv-SE',
    timezoneId: 'Europe/Stockholm',
  },

  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], ...chromium } },
    { name: 'mobil', use: { ...devices['Pixel 7'], ...chromium } },
  ],

  webServer: [
    {
      command: `node e2e/mock-jobtech.mjs`,
      url: `http://127.0.0.1:${MOCK_PORT}/search`,
      reuseExistingServer: !process.env.CI,
      env: { MOCK_JOBTECH_PORT: String(MOCK_PORT) },
      stdout: 'ignore',
    },
    {
      command: `pnpm exec next dev --port ${PORT}`,
      url: `${BASE_URL}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NODE_ENV: 'development',
        DATABASE_URL:
          process.env.DATABASE_URL ?? 'postgresql://postgres@127.0.0.1:5433/jobbdjungeln',
        AUTH_SECRET: 'e2e-hemlighet-som-ar-minst-32-tecken-lang',
        APP_URL: BASE_URL,
        AUTH_SKIP_EMAIL_VERIFICATION: '1',
        JOBTECH_SEARCH_URL: `http://127.0.0.1:${MOCK_PORT}/search`,
        JOBTECH_AD_URL: `http://127.0.0.1:${MOCK_PORT}/ad`,
        JOBTECH_TAXONOMY_URL: `http://127.0.0.1:${MOCK_PORT}/concepts`,
      },
    },
  ],
});
