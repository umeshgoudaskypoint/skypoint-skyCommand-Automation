import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * LoginPage - Skypoint Azure AD B2C authentication.
 *
 * Flow observed on QA (login.skypointcloud.com,
 * tenant sicdpstage.onmicrosoft.com, policy B2C_1A_AccountLink_signin_Copilot):
 *
 *   1. App redirects to the B2C provider-chooser page
 *   2. Click "Sign in with Email & Password" (#emailPasswordSignIn)
 *      -> reveals the local account form (#localAccountForm)
 *   3. Fill #signInName + #password, submit with #next
 *   4. B2C redirects back to {BASE_URL}/auth/callback, then into the app
 */
export class LoginPage extends BasePage {
  readonly selectors = {
    // Provider chooser
    chooserContainer: '.accountButton, #emailPasswordSignIn',
    microsoftButton: '#AzureADExchange',
    googleButton: '#GoogleExchange',
    appleButton: '#AppleExchange',
    oktaButton: '#oktaSignIn',
    emailPasswordButton: '#emailPasswordSignIn',
    backButton: '#backButton',

    // Local account form
    localForm: '#localAccountForm',
    emailInput: '#signInName',
    passwordInput: '#password',
    signInButton: '#next',
    forgotPasswordLink: 'a:has-text("Forgot your password?")',

    // Errors
    errorMessage:
      '.error.itemLevel[aria-hidden="false"], .error.pageLevel[aria-hidden="false"], #claimVerificationServerError',
    anyError: '.error',

    // Post-login app chrome
    appShell: '[data-testid="app-shell"], #root, main',
  };

  constructor(page: Page) {
    super(page);
  }

  /** Navigate to the app root, which redirects to B2C when unauthenticated. */
  async goto(): Promise<void> {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
    await this.waitForLoginPage();
  }

  /** Wait until the B2C login page has rendered. */
  async waitForLoginPage(timeout = 45000): Promise<void> {
    await this.page.waitForURL(/login\.skypointcloud\.com|b2clogin\.com/, { timeout });
    await this.page.locator(this.selectors.emailPasswordButton).waitFor({
      state: 'visible',
      timeout,
    });
  }

  /** Reveal the email/password form from the provider chooser. */
  async openEmailPasswordForm(): Promise<void> {
    const alreadyOpen = await this.isVisible(this.selectors.emailInput, 2000);
    if (alreadyOpen) return;

    await this.clickElement(this.selectors.emailPasswordButton);
    await this.page.locator(this.selectors.emailInput).waitFor({
      state: 'visible',
      timeout: 15000,
    });
  }

  /** Full login with email + password. */
  async login(email: string, password: string): Promise<void> {
    await this.openEmailPasswordForm();
    await this.fillInput(this.selectors.emailInput, email);
    await this.fillInput(this.selectors.passwordInput, password);
    await this.clickElement(this.selectors.signInButton);
  }

  /** Login and wait for the app to load (happy path). */
  async loginAndWaitForApp(email: string, password: string): Promise<void> {
    await this.login(email, password);
    await this.waitForSuccessfulLogin();
  }

  /**
   * Wait for redirect back into the application after B2C.
   *
   * Races the success condition against a B2C error message so that a bad
   * password fails fast and loudly, rather than being mistaken for success
   * during the initial redirect through the app origin.
   */
  async waitForSuccessfulLogin(timeout = 90000): Promise<void> {
    const baseUrl = process.env.BASE_URL || 'https://qa-skycommand.skypoint.ai';
    const appHost = new URL(baseUrl).host;

    const landed = this.page
      .waitForURL(
        (url) => url.host === appHost && !url.pathname.includes('/auth/callback'),
        { timeout }
      )
      .then(() => 'success' as const);

    const errored = this.page
      .locator(this.selectors.errorMessage)
      .first()
      .waitFor({ state: 'visible', timeout })
      .then(() => 'error' as const);

    const outcome = await Promise.race([landed, errored]).catch(() => 'timeout' as const);

    if (outcome === 'error') {
      const message = await this.getErrorMessage();
      throw new Error(
        `Login rejected by Skypoint B2C: "${message}"\n` +
          `  Account: ${process.env.TEST_USER_EMAIL}\n` +
          '  Check TEST_USER_EMAIL / TEST_USER_PASSWORD in .env'
      );
    }

    if (outcome === 'timeout') {
      throw new Error(
        `Login did not complete within ${timeout}ms. Last URL: ${this.page.url()}`
      );
    }

    // Confirm we did not bounce straight back to the identity provider.
    await this.page.waitForTimeout(3000);
    if (/login\.skypointcloud\.com|b2clogin\.com/.test(this.page.url())) {
      throw new Error(
        'Login bounced back to the identity provider - the session was not established.'
      );
    }

    await this.waitForNetworkIdle();
  }

  /** Login using credentials from environment variables. */
  async loginWithEnvCredentials(): Promise<void> {
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;

    if (!email || !password) {
      throw new Error(
        'TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in your .env file. ' +
          'Copy .env.example to .env and fill in your QA credentials.'
      );
    }

    await this.goto();
    await this.loginAndWaitForApp(email, password);
  }

  // ---------- Assertions & state ----------
  async isLoginPageDisplayed(): Promise<boolean> {
    return await this.isVisible(this.selectors.emailPasswordButton);
  }

  async getErrorMessage(): Promise<string> {
    return await this.getText(this.selectors.errorMessage);
  }

  async hasError(): Promise<boolean> {
    return await this.isVisible(this.selectors.errorMessage, 10000);
  }

  async assertLoginPageLoaded(): Promise<void> {
    await expect(this.page.locator(this.selectors.emailPasswordButton)).toBeVisible();
  }

  async assertErrorDisplayed(): Promise<void> {
    await expect(this.page.locator(this.selectors.errorMessage).first()).toBeVisible();
  }

  /** Verify all SSO provider options are available on the chooser. */
  async assertAllProvidersVisible(): Promise<void> {
    await expect(this.page.locator(this.selectors.microsoftButton)).toBeVisible();
    await expect(this.page.locator(this.selectors.googleButton)).toBeVisible();
    await expect(this.page.locator(this.selectors.appleButton)).toBeVisible();
    await expect(this.page.locator(this.selectors.emailPasswordButton)).toBeVisible();
  }

  async logout(): Promise<void> {
    await this.clearSession();
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
  }
}
