/**
 * Save an authenticated session for the test suite.
 *
 * Opens a real browser window and waits for YOU to sign in by hand -
 * Microsoft SSO, MFA prompts, "Stay signed in?", all of it. Once you land
 * in the app, the session is captured to playwright/.auth/user.json and
 * every test reuses it.
 *
 * Run:  npm run auth:save
 *
 * Re-run whenever the session expires (typically every few days).
 */
import { chromium } from '@playwright/test';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const BASE_URL = process.env.BASE_URL || 'https://qa-skycommand.skypoint.ai';
const AUTH_DIR = path.join(process.cwd(), 'playwright', '.auth');
const AUTH_FILE = path.join(AUTH_DIR, 'user.json');
const TIMEOUT_MIN = Number(process.env.AUTH_TIMEOUT_MIN) || 15;
const TIMEOUT_MS = TIMEOUT_MIN * 60 * 1000;

console.log('\n========================================');
console.log('  Save Authentication Session');
console.log('========================================\n');
console.log(`  Target: ${BASE_URL}`);
console.log(`  Account: ${process.env.TEST_USER_EMAIL || '(sign in as whoever you like)'}\n`);
console.log('  A browser window is opening.');
console.log('  1. Sign in normally - use "Sign In with Microsoft"');
console.log('  2. Complete any MFA prompt on your phone');
console.log('  3. Answer "Stay signed in?" with Yes');
console.log('  4. Wait until the app has loaded\n');
console.log('  The session saves automatically once you are in.');
console.log(`  You have ${TIMEOUT_MIN} minutes.\n`);

const browser = await chromium.launch({ headless: false, slowMo: 50 });
const context = await browser.newContext({
  baseURL: BASE_URL,
  ignoreHTTPSErrors: true,
  viewport: { width: 1600, height: 900 },
});
const page = await context.newPage();

await page.goto('/', { waitUntil: 'domcontentloaded' });

const appHost = new URL(BASE_URL).host;
const deadline = Date.now() + TIMEOUT_MS;
let signedIn = false;

while (Date.now() < deadline) {
  await page.waitForTimeout(2000);

  let currentUrl;
  try {
    currentUrl = new URL(page.url());
  } catch {
    continue;
  }

  const onApp = currentUrl.host === appHost;
  const onCallback = currentUrl.pathname.includes('/auth/callback');

  if (onApp && !onCallback) {
    // Give the SPA a moment to finish bootstrapping its tokens.
    await page.waitForTimeout(6000);
    if (new URL(page.url()).host === appHost) {
      signedIn = true;
      break;
    }
  }
}

if (!signedIn) {
  console.error('\n  Timed out before sign-in completed.');
  console.error(`  Last URL: ${page.url()}\n`);
  await browser.close();
  process.exit(1);
}

fs.mkdirSync(AUTH_DIR, { recursive: true });
await context.storageState({ path: AUTH_FILE });

const state = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
console.log('\n  ----------------------------------------');
console.log('  SESSION SAVED');
console.log('  ----------------------------------------');
console.log(`  File: playwright/.auth/user.json`);
console.log(`  Cookies: ${state.cookies.length}`);
console.log(`  Origins with storage: ${state.origins.length}`);
console.log(`  Landed on: ${page.url()}\n`);
console.log('  Now run:  npm test\n');

await browser.close();
