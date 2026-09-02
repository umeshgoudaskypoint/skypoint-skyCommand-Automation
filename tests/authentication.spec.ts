import { test, expect } from '../utils/fixtures';
import { LoginPage } from '../utils/pages';

/**
 * Authentication tests.
 *
 * These run WITHOUT credentials (they only exercise the login page itself),
 * so they work as a smoke check of the framework before .env is filled in.
 * Run them with: npx cross-env SKIP_AUTH=true npm test -- tests/authentication.spec.ts
 */
test.describe('Authentication', () => {
  // These tests must start from a signed-out state.
  test.use({ storageState: { cookies: [], origins: [] } });

  // Test Case: TC-AUTH-001
  test('TC-AUTH-001: unauthenticated user is redirected to the Skypoint login page @sanity @regression', async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    expect(page.url()).toContain('login.skypointcloud.com');
    await loginPage.assertLoginPageLoaded();
  });

  // Test Case: TC-AUTH-002
  test('TC-AUTH-002: all sign-in provider options are displayed @sanity @regression', async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.assertAllProvidersVisible();
  });

  // Test Case: TC-AUTH-003
  test('TC-AUTH-003: email & password form opens from the provider chooser @regression', async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.openEmailPasswordForm();

    await expect(page.locator(loginPage.selectors.emailInput)).toBeVisible();
    await expect(page.locator(loginPage.selectors.passwordInput)).toBeVisible();
    await expect(page.locator(loginPage.selectors.signInButton)).toBeVisible();
  });

  // Test Case: TC-AUTH-004
  test('TC-AUTH-004: invalid credentials show an error message @regression @negative', async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('invalid.user@example.com', 'WrongPassword123!');

    expect(await loginPage.hasError()).toBe(true);
    expect(page.url()).toContain('login.skypointcloud.com');
  });
});
