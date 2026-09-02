import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

// Only reuse a cached session if global-setup actually managed to create one.
const AUTH_FILE = 'playwright/.auth/user.json';
const hasCachedAuth = fs.existsSync(AUTH_FILE);

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // No retries: a failed test is reported as failed, once. Retrying inflated
  // the totals (23 passed + 3 failed out of 24 tests) and hid real flakiness.
  retries: 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['json', { outputFile: 'reports/results.json' }],
    ['junit', { outputFile: 'reports/junit.xml' }],
    ['list'],
    ['./utils/results-logger.js'],
    ['./utils/custom-reporter.js'],
  ],

  // The Portfolio dashboard pulls its data from Power BI and routinely takes
  // 30s+ to render, so 60s per test was not survivable. AI briefing tests
  // raise this further with test.setTimeout().
  timeout: 180000,
  expect: { timeout: 20000 },

  use: {
    baseURL: process.env.BASE_URL || 'https://qa-skycommand.skypoint.ai',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: process.env.HEADLESS !== 'false',
    actionTimeout: 15000,
    navigationTimeout: 30000,
    ignoreHTTPSErrors: true,
    viewport: { width: 1920, height: 1080 },
    storageState:
      process.env.SKIP_AUTH === 'true' || !hasCachedAuth ? undefined : AUTH_FILE,
  },

  outputDir: 'test-results/',

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  globalSetup: process.env.SKIP_AUTH === 'true' ? undefined : './utils/global-setup.ts',
  globalTeardown: './utils/global-teardown.ts',
});
