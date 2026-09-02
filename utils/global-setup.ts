import { chromium, FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { LoginPage } from './pages/LoginPage';

dotenv.config();

const AUTH_DIR = path.join(process.cwd(), 'playwright', '.auth');
const AUTH_FILE = path.join(AUTH_DIR, 'user.json');

/** Is the cached storage state still usable (cookies not expired)? */
function isCachedAuthValid(): boolean {
  if (!fs.existsSync(AUTH_FILE)) return false;

  try {
    const state = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
    if (!state.cookies || state.cookies.length === 0) return false;

    const nowSeconds = Date.now() / 1000;
    // Session cookies use expires === -1; treat those as valid.
    const expired = state.cookies.some(
      (c: { expires: number }) => c.expires > 0 && c.expires < nowSeconds + 300
    );
    return !expired;
  } catch {
    return false;
  }
}

async function globalSetup(config: FullConfig): Promise<void> {
  console.log('\n========================================');
  console.log('  SkyCommand Automation - Global Setup');
  console.log('========================================\n');

  if (process.env.SKIP_AUTH === 'true') {
    console.log('  SKIP_AUTH=true - skipping authentication.\n');
    return;
  }

  fs.mkdirSync(AUTH_DIR, { recursive: true });

  if (isCachedAuthValid()) {
    console.log('  Reusing cached authentication state.\n');
    return;
  }

  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  const baseURL = process.env.BASE_URL || 'https://qa-skycommand.skypoint.ai';

  if (!email || !password) {
    throw new Error(
      '\n  Missing credentials.\n' +
        '  Set TEST_USER_EMAIL and TEST_USER_PASSWORD in automation/.env\n' +
        '  (copy .env.example to .env and fill them in), or run with SKIP_AUTH=true.\n'
    );
  }

  console.log(`  Authenticating ${email} against ${baseURL} ...`);

  const browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false' });
  const context = await browser.newContext({
    baseURL,
    ignoreHTTPSErrors: true,
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  try {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAndWaitForApp(email, password);

    await context.storageState({ path: AUTH_FILE });
    console.log('  Authentication succeeded. State cached.\n');
  } catch (error) {
    fs.mkdirSync(path.join(process.cwd(), 'reports', 'screenshots'), { recursive: true });
    await page.screenshot({
      path: 'reports/screenshots/auth-failure.png',
      fullPage: true,
    });
    console.error('\n  Authentication FAILED.');
    console.error(`  Final URL: ${page.url()}`);
    console.error('  Screenshot: reports/screenshots/auth-failure.png\n');
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

export default globalSetup;
