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

  /**
   * Login via the Microsoft SSO provider (login.microsoftonline.com).
   *
   * Corporate @skypoint.ai accounts are federated to Entra ID and are NOT
   * local B2C accounts, so they must use this path rather than
   * email + password. Set AUTH_METHOD=microsoft in .env to select it.
   */
  async loginWithMicrosoft(email: string, password: string): Promise<void> {
    await this.clickElement(this.selectors.microsoftButton);
    await this.page.waitForURL(/login\.microsoftonline\.com/, { timeout: 45000 });

    // Microsoft performs an "sso_reload" that clears any text already typed,
    // so the email must be entered AFTER the page settles and then verified
    // to have stuck before submitting.
    const emailBox = this.page.locator('input[name="loginfmt"], input[type="email"]').first();

    if (await emailBox.isVisible({ timeout: 20000 }).catch(() => false)) {
      let entered = false;

      for (let attempt = 1; attempt <= 3 && !entered; attempt++) {
        await this.page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
        await this.page.waitForTimeout(2000);

        await emailBox.click();
        await emailBox.fill('');
        await emailBox.fill(email);
        await this.page.waitForTimeout(1000);

        // Confirm the value survived any reload before clicking Next.
        if ((await emailBox.inputValue().catch(() => '')) === email) {
          entered = true;
        }
      }

      if (!entered) {
        throw new Error(
          'Could not enter the email on the Microsoft sign-in page - the field ' +
            'kept clearing itself (sso_reload).'
        );
      }

      await this.page.locator('#idSIButton9, input[type="submit"]').first().click();
    }

    // Password step.
    const passwordBox = this.page.locator('input[name="passwd"], input[type="password"]').first();
    await passwordBox.waitFor({ state: 'visible', timeout: 30000 });
    await this.page.waitForTimeout(1500);
    await passwordBox.fill(password);
    await this.page.waitForTimeout(500);
    await this.page.locator('#idSIButton9, input[type="submit"]').first().click();

    await this.handleMicrosoftPrompts();
  }

  /** Handle the prompts Microsoft shows after a password: MFA, "Stay signed in?". */
  private async handleMicrosoftPrompts(): Promise<void> {
    await this.page.waitForTimeout(5000);

    // Credential rejection.
    const msError = this.page.locator('#passwordError, .alert-error, [role="alert"]');
    if (await msError.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = (await msError.first().textContent()) || 'unknown error';
      throw new Error(`Microsoft SSO rejected the sign-in: "${text.trim()}"`);
    }

    // MFA cannot be automated - fail with an actionable message.
    const mfaIndicators = [
      'text=/Approve sign in request/i',
      'text=/Enter code/i',
      'text=/verification code/i',
      'text=/Verify your identity/i',
    ];
    for (const indicator of mfaIndicators) {
      if (await this.page.locator(indicator).first().isVisible({ timeout: 2000 }).catch(() => false)) {
        throw new Error(
          'Microsoft SSO is requesting multi-factor authentication, which cannot ' +
            'be automated. Ask IT to exempt the automation account from MFA on ' +
            'trusted/CI IPs, or use a dedicated local B2C test account.'
        );
      }
    }

    // "Stay signed in?" - answering Yes keeps the session cookie.
    const staySignedIn = this.page.locator('#idSIButton9, input[type="submit"][value="Yes"]');
    if (await staySignedIn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await staySignedIn.first().click();
    }
  }

  /** Login and wait for the app to load, using the configured auth method. */
  async loginAndWaitForApp(email: string, password: string): Promise<void> {
    if ((process.env.AUTH_METHOD || 'local').toLowerCase() === 'microsoft') {
      await this.loginWithMicrosoft(email, password);
    } else {
      await this.login(email, password);
    }
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
