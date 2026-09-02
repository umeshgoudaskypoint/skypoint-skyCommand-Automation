import { test as base, Page } from '@playwright/test';
import { LoginPage, PortfolioInsightsPage } from './pages';

export type TestData = {
  runId: string;
  email: string;
  name: string;
};

type CustomFixtures = {
  loginPage: LoginPage;
  portfolioInsightsPage: PortfolioInsightsPage;
  authenticatedPage: Page;
  testData: TestData;
};

export const test = base.extend<CustomFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  portfolioInsightsPage: async ({ page }, use) => {
    await use(new PortfolioInsightsPage(page));
  },

  /**
   * A page guaranteed to be authenticated.
   * Normally the cached storageState from global-setup already covers this,
   * so this only performs a live login when the session is missing.
   */
  authenticatedPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    if (await loginPage.isLoginPageDisplayed()) {
      await loginPage.loginWithEnvCredentials();
    }

    await use(page);
  },

  testData: async ({}, use) => {
    const runId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    await use({
      runId,
      email: `qa.auto.${runId}@example.com`,
      name: `QA Auto ${runId}`,
    });
  },
});

export { expect } from '@playwright/test';
