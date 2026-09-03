import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const AUTH_DIR = path.join(process.cwd(), 'playwright', '.auth');
const AUTH_FILE = path.join(AUTH_DIR, 'user.json');

/**
 * Is there a usable cached session? This app (Azure AD B2C/MSAL) keeps its
 * real session in localStorage, not cookies, so a cookie-expiry check is
 * the wrong signal and was flagging a perfectly good session as invalid on
 * every run - triggering the automated-login fallback below on every
 * single test run, which then always failed after its 90s timeout (see
 * "Automated login DOES NOT WORK" in CLAUDE.md) despite the cached session
 * already working fine for the actual tests via playwright.config's
 * storageState. Just checking that the file has SOME saved state is a much
 * more honest signal than guessing at expiry: if the session actually did
 * expire, the tests themselves will fail with a clear signed-out symptom,
 * which is the real signal to re-run `npm run auth:save`.
 */
function isCachedAuthValid(): boolean {
  if (!fs.existsSync(AUTH_FILE)) return false;

  try {
    const state = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
    const hasCookies = Array.isArray(state.cookies) && state.cookies.length > 0;
    const hasLocalStorage = Array.isArray(state.origins) && state.origins.length > 0;
    return hasCookies || hasLocalStorage;
  } catch {
    return false;
  }
}

/**
 * Authenticating skyCommand automatically does not work - see
 * "AUTHENTICATION - READ THIS BEFORE TOUCHING LOGIN" in CLAUDE.md. There is
 * no automated fallback here on purpose: attempting one always fails after
 * a long timeout with zero chance of success, which just wastes time on
 * every run. The only real recovery step when the cached session actually
 * expires is a human running `npm run auth:save`.
 */
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
    console.log('  Reusing cached authentication state (playwright/.auth/user.json).\n');
    return;
  }

  console.error('  ----------------------------------------');
  console.error('  NO CACHED SESSION FOUND');
  console.error('  ----------------------------------------');
  console.error('  Run `npm run auth:save` to sign in once by hand - a human');
  console.error('  has to complete Microsoft SSO + MFA, this cannot be automated.');

  if (process.env.STRICT_AUTH === 'true') {
    console.error('\n  STRICT_AUTH=true - aborting the run.\n');
    throw new Error('No cached session found. Run `npm run auth:save` first.');
  }

  console.error('\n  Continuing WITHOUT a session.');
  console.error('  Logged-out tests still run; tests needing a signed-in');
  console.error('  user will fail. Set STRICT_AUTH=true to abort instead.\n');
}

export default globalSetup;
