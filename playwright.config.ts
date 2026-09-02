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
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['json', { outputFile: 'reports/results.json' }],
    ['junit', { outputFile: 'reports/junit.xml' }],
    ['list'],
    ['./utils/custom-reporter.js'],
  ],

  timeout: 60000,
  expect: { timeout: 10000 },

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
