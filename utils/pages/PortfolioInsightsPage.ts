import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * PortfolioInsightsPage - /insights/portfolio-insights
 *
 * NOTE: selectors below are multi-strategy fallbacks written before the
 * authenticated UI could be inspected. After the first successful login run,
 * refine them with real data-testid values (see README "Refining selectors").
 */
export class PortfolioInsightsPage extends BasePage {
  readonly selectors = {
    pageContainer:
      '[data-testid="portfolio-insights"], main, [class*="portfolio"], [class*="insights"]',
    pageHeading:
      'h1, h2, [data-testid="page-title"], [class*="pageTitle"], [class*="page-title"]',

    loadingSpinner:
      '[data-testid="loading"], [class*="spinner"], [class*="loading"], [role="progressbar"]',

    // Report surface (often a Power BI embed)
    reportIframe: 'iframe[src*="powerbi"], iframe[title*="Report"], iframe',
    visualContainer: '[class*="visualContainer"], [class*="chart"], [class*="card"]',

    // Filters / controls
    filterPanel: '[data-testid="filters"], [class*="filter"], aside',
    dateRangePicker: '[data-testid="date-range"], [class*="datePicker"], [class*="date-range"]',
    refreshButton: 'button:has-text("Refresh"), [aria-label*="Refresh" i]',
    exportButton: 'button:has-text("Export"), [aria-label*="Export" i]',

    // Navigation
    sidebarNav: 'nav, [role="navigation"], [class*="sidebar"]',
    insightsMenuItem: 'a[href*="/insights"], [role="link"]:has-text("Insights")',

    // Empty / error states
    emptyState: '[class*="empty"], :text("No data")',
    errorState: '[class*="error"], [role="alert"]',
  };

  /** Instance id is required as a query param on this route. */
  private get instanceId(): string {
    return process.env.INSTANCE_ID || 'f507ae68-5a2b-447e-a78c-5098e889e16d';
  }

  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto(`/insights/portfolio-insights?instanceid=${this.instanceId}`, {
      waitUntil: 'domcontentloaded',
    });
    await this.waitForInsightsLoad();
  }

  /** Wait for the page shell and for any loading spinner to clear. */
  async waitForInsightsLoad(timeout = 60000): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded', { timeout });

    // Spinner may or may not appear; ignore if it never shows.
    try {
      await this.page
        .locator(this.selectors.loadingSpinner)
        .first()
        .waitFor({ state: 'hidden', timeout: 30000 });
    } catch {
      // No spinner rendered - fine.
    }

    await this.waitForNetworkIdle();
  }

  async isInsightsPageLoaded(): Promise<boolean> {
    const urlOk = this.page.url().includes('portfolio-insights');
    const shellOk = await this.isVisible(this.selectors.pageContainer, 15000);
    return urlOk && shellOk;
  }

  async getPageHeading(): Promise<string> {
    return await this.getText(this.selectors.pageHeading);
  }

  /** Number of rendered visual/chart cards. */
  async getVisualCount(): Promise<number> {
    return await this.getCount(this.selectors.visualContainer);
  }

  async hasReportIframe(): Promise<boolean> {
    return await this.exists(this.selectors.reportIframe);
  }

  async refreshReport(): Promise<void> {
    if (await this.isVisible(this.selectors.refreshButton, 5000)) {
      await this.clickElement(this.selectors.refreshButton);
      await this.waitForInsightsLoad();
    }
  }

  async isEmptyStateShown(): Promise<boolean> {
    return await this.isVisible(this.selectors.emptyState, 5000);
  }

  async hasErrorState(): Promise<boolean> {
    return await this.isVisible(this.selectors.errorState, 5000);
  }

  // ---------- Assertions ----------
  async assertPageLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/portfolio-insights/);
    await expect(this.page.locator(this.selectors.pageContainer).first()).toBeVisible();
  }

  async assertNoErrors(): Promise<void> {
    expect(await this.hasErrorState()).toBe(false);
  }
}
