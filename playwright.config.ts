/**
 * End-to-end tests (Playwright). HEADED by default with slowMo so the team can watch:
 *   npm run test:e2e                 # headed (needs a display; on a server use xvfb-run)
 *   HEADLESS=1 npm run test:e2e      # CI / no display
 *   npm run test:e2e -- --grep-invert @real-model   # skip the tests that download the model
 *
 * The app is tested as a PRODUCTION build (service worker included, for the offline
 * test) with the test hook enabled, served by our own server on port 4173.
 * The fake camera plays tests/fixtures/coffee_cup.y4m (made by scripts/make-fixtures.sh).
 */
import { defineConfig, devices } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

const PORT = 4173;
// A fresh leaderboard file per run, so every run starts from an empty board.
const DATA_FILE = path.join(os.tmpdir(), `binsight-e2e-${Date.now()}.json`);
const headless = process.env.HEADLESS === '1';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: { timeout: 15_000, toHaveScreenshot: { maxDiffPixelRatio: 0.02 } },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${PORT}`,
    headless,
    // Service workers would hide requests from page.route(); only the offline test enables them.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      slowMo: headless ? 0 : 250,
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--use-file-for-fake-video-capture=tests/fixtures/coffee_cup.y4m',
      ],
    },
  },
  projects: [
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `npm run build:test && PORT=${PORT} DATA_FILE=${DATA_FILE} npm start -w server`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
