import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export type KpiCard = {
  title: string;
  value: string;
  hasError: boolean;
};

/**
 * PortfolioInsightsPage - /insights/portfolio-insights
 *
 * Selectors below were captured from the live QA app (Westmont tenant),
 * so they use the application's real data-testid values wherever they
 * exist. KPI cards are react-grid-layout items and carry no testid of
 * their own, so those fall back to the card's Tailwind classes.
 */
export class PortfolioInsightsPage extends BasePage {
  readonly selectors = {
    // Page shell
    pageContainer: '[data-testid="dynamic-insight-page"]',
    pageHeader: '[data-testid="dashboard-header"]',
    pageTabs: '[data-testid="dynamic-insight-page-tabs"]',
    sidebar: '[data-testid="sidebar"]',
    loadingSpinner: '[class*="animate-pulse"], [class*="skeleton"], [role="progressbar"]',

    // Widget grid + KPI cards
    dashboardGrid: '[data-testid="dashboard-grid"]',
    kpiCard: '.react-grid-item',
    kpiTitle: 'span.font-semibold',
    kpiValue: 'span.font-extrabold',

    // Empty state (a tenant with no widgets configured)
    emptyState: '[data-testid="dynamic-insight-page-empty"]',
    addWidgetButton: '[data-testid="dynamic-insight-page-empty-add"]',

    // Filter bar
    filterBar: '[data-testid="filter-bar"]',
    quickMonthDropdown: '[data-testid="filter-bar-quick-month"]',
    communityDropdown: '[data-testid="filter-bar-community"]',
    dropdownOption: '[role="option"], [role="menuitem"], li',

    // Edit mode
    editButton: '[data-testid="dashboard-edit-btn"]',
    saveButton: 'button:has-text("Save")',
    cancelButton: 'button:has-text("Cancel"), button:has-text("Discard")',

    // AI briefing
    aiBriefingButton: '[data-testid="button-global-ai-briefing"]',
    briefingContainer: '[data-testid="ai-briefing-container"]',
    standardBriefingOption: 'button:has-text("Standard Briefing")',
    customBriefingOption: 'button:has-text("Custom AI Analysis")',
    briefingHistory: 'button:has-text("History")',
    createTaskButton: '[data-testid="button-briefing-create-task"]',

    // Errors
    errorState: '[role="alert"], [class*="destructive"]',
  };

  private get instanceId(): string {
    return process.env.INSTANCE_ID || '';
  }

  constructor(page: Page) {
    super(page);
  }

  // ---------- Navigation & load ----------
  async goto(): Promise<void> {
    if (this.instanceId) {
      await this.page.goto(`/insights/portfolio-insights?instanceid=${this.instanceId}`, {
        waitUntil: 'domcontentloaded',
      });
      await this.waitForInsightsLoad();
      return;
    }
    await this.gotoFromHome();
  }

  /** Navigate from the app root by clicking through the UI. */
  async gotoFromHome(): Promise<void> {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
    await this.waitForNetworkIdle();

    const tenant = process.env.TENANT;
    if (tenant) {
      await this.switchToTenant(tenant);
    }

    if (!this.page.url().includes('portfolio-insights')) {
      const portfolioLink = this.page.locator('a[href*="portfolio-insights"]').first();
      if (await portfolioLink.isVisible({ timeout: 15000 }).catch(() => false)) {
        await portfolioLink.click();
      }
    }

    await this.page.waitForURL(/portfolio/, { timeout: 30000 }).catch(() => {});
    await this.waitForInsightsLoad();
  }

  /** Wait for the dashboard grid (or the empty state) to settle. */
  async waitForInsightsLoad(timeout = 90000): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded', { timeout });

    await this.page
      .locator(this.selectors.pageContainer)
      .waitFor({ state: 'visible', timeout })
      .catch(() => {});

    // Either widgets render, or the tenant has none configured.
    await Promise.race([
      this.page
        .locator(this.selectors.kpiCard)
        .first()
        .waitFor({ state: 'visible', timeout })
        .catch(() => {}),
      this.page
        .locator(this.selectors.emptyState)
        .waitFor({ state: 'visible', timeout })
        .catch(() => {}),
    ]);

    await this.waitForNetworkIdle();
  }

  async isInsightsPageLoaded(): Promise<boolean> {
    return (
      this.page.url().includes('portfolio-insights') &&
      (await this.isVisible(this.selectors.pageContainer, 20000))
    );
  }

  async isStillLoading(): Promise<boolean> {
    return await this.isVisible(this.selectors.loadingSpinner, 3000);
  }

  async hasErrorState(): Promise<boolean> {
    return await this.isVisible(this.selectors.errorState, 5000);
  }

  async isEmptyStateShown(): Promise<boolean> {
    return await this.isVisible(this.selectors.emptyState, 3000);
  }

  getInstanceIdFromUrl(): string | null {
    try {
      return new URL(this.page.url()).searchParams.get('instanceid');
    } catch {
      return null;
    }
  }

  // ---------- KPI cards ----------
  async getKpiCards(): Promise<KpiCard[]> {
    await this.page
      .locator(this.selectors.kpiCard)
      .first()
      .waitFor({ state: 'visible', timeout: 60000 })
      .catch(() => {});

    const cards = this.page.locator(this.selectors.kpiCard);
    const count = await cards.count();
    const result: KpiCard[] = [];

    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const raw = ((await card.textContent()) || '').trim();

      const title = await card
        .locator(this.selectors.kpiTitle)
        .first()
        .textContent()
        .then((t) => (t || '').trim())
        .catch(() => '');

      const value = await card
        .locator(this.selectors.kpiValue)
        .first()
        .textContent()
        .then((t) => (t || '').trim())
        .catch(() => '');

      result.push({
        title: title || `card-${i + 1}`,
        value,
        hasError: this.looksLikeError(raw),
      });
    }

    return result;
  }

  /** Titles of cards that are erroring or have no value at all. */
  async getFailingKpiCards(): Promise<string[]> {
    const cards = await this.getKpiCards();
    return cards.filter((c) => c.hasError || c.value === '').map((c) => c.title);
  }

  private looksLikeError(text: string): boolean {
    return /error|failed|unable to load|something went wrong/i.test(text);
  }

  /**
   * A KPI value is valid if it is a number, percentage or currency amount.
   * Zero is a PASS - it means Power BI has no value for that metric.
   */
  isValidKpiValue(value: string): boolean {
    if (!value) return false;
    const cleaned = value.replace(/[\s,]/g, '');
    return /^[-+]?[$£€]?\d+(\.\d+)?[%KMB]?$/i.test(cleaned);
  }

  // ---------- Filters ----------
  /** Currently selected quick month, e.g. "Sep 2026". */
  async getSelectedQuickMonth(): Promise<string> {
    return await this.getText(this.selectors.quickMonthDropdown);
  }

  async getQuickMonthOptions(): Promise<string[]> {
    await this.clickElement(this.selectors.quickMonthDropdown);
    await this.page.waitForTimeout(1500);
    const texts = await this.page.locator(this.selectors.dropdownOption).allTextContents();
    await this.pressKey('Escape');
    return texts.map((t) => t.trim()).filter(Boolean);
  }

  /** Pick a different month from the quick-month dropdown. */
  async changeQuickMonth(): Promise<void> {
    const current = await this.getSelectedQuickMonth();

    await this.clickElement(this.selectors.quickMonthDropdown);
    await this.page.waitForTimeout(1500);

    // Skip "Custom range" and whatever is already selected.
    const option = this.page
      .locator(this.selectors.dropdownOption)
      .filter({ hasText: /^\w{3} \d{4}$/ })
      .filter({ hasNotText: current })
      .first();

    await option.click({ timeout: 15000 });
    await this.page.waitForTimeout(2000);
  }

  /** Switch the quick-month control to "Custom range" to change the dates. */
  async changeDateRange(): Promise<void> {
    await this.clickElement(this.selectors.quickMonthDropdown);
    await this.page.waitForTimeout(1500);

    const custom = this.page
      .locator(this.selectors.dropdownOption)
      .filter({ hasText: /custom range/i })
      .first();
    await custom.click({ timeout: 15000 });
    await this.page.waitForTimeout(2000);

    // Pick a selectable day from the calendar that appears.
    const day = this.page
      .locator('[role="gridcell"] button:not([disabled]), button[name="day"]:not([disabled])')
      .first();
    if (await day.isVisible({ timeout: 10000 }).catch(() => false)) {
      await day.click();
      await this.page.waitForTimeout(1500);
    }

    await this.pressKey('Escape');
    await this.page.waitForTimeout(1500);
  }

  async getCommunityOptions(): Promise<string[]> {
    await this.clickElement(this.selectors.communityDropdown);
    await this.page.waitForTimeout(2000);
    const texts = await this.page.locator(this.selectors.dropdownOption).allTextContents();
    await this.pressKey('Escape');
    return texts.map((t) => t.trim()).filter(Boolean);
  }

  async selectDifferentCommunity(): Promise<void> {
    await this.clickElement(this.selectors.communityDropdown);
    await this.page.waitForTimeout(2000);

    const options = this.page.locator(this.selectors.dropdownOption);
    const count = await options.count();
    if (count === 0) {
      throw new Error('Community dropdown opened but listed no options');
    }

    await options.first().click();
    await this.page.waitForTimeout(2000);
    await this.pressKey('Escape');
  }

  // ---------- Edit mode ----------
  async enterEditMode(): Promise<void> {
    await this.clickElement(this.selectors.editButton);
    await this.page.waitForTimeout(3000);
  }

  async isInEditMode(): Promise<boolean> {
    return (
      (await this.isVisible(this.selectors.saveButton, 5000)) ||
      (await this.isVisible(this.selectors.cancelButton, 3000))
    );
  }

  /** Leave edit mode WITHOUT saving, so nothing is persisted. */
  async exitEditModeWithoutSaving(): Promise<void> {
    if (await this.isVisible(this.selectors.cancelButton, 5000)) {
      await this.clickElement(this.selectors.cancelButton);
    } else {
      await this.pressKey('Escape');
    }
    await this.page.waitForTimeout(3000);
  }

  /** Fingerprint of the layout, used to prove edit mode changed nothing. */
  async captureLayoutSnapshot(): Promise<string[]> {
    const cards = await this.getKpiCards();
    return cards.map((c) => `${c.title}|${c.value}`);
  }

  // ---------- AI briefing ----------
  async openAiBriefing(): Promise<void> {
    await this.clickElement(this.selectors.aiBriefingButton);
    await this.page
      .locator(this.selectors.briefingContainer)
      .waitFor({ state: 'visible', timeout: 30000 })
      .catch(() => {});
    await this.page.waitForTimeout(2000);
  }

  private async runBriefing(optionSelector: string): Promise<void> {
    await this.clickElement(optionSelector);

    // Generation is an LLM call - allow generous time for content to appear.
    const container = this.page.locator(this.selectors.briefingContainer);
    const deadline = Date.now() + 180000;

    while (Date.now() < deadline) {
      await this.page.waitForTimeout(5000);
      const text = ((await container.textContent().catch(() => '')) || '').trim();
      // Wait until meaningful prose has streamed in.
      if (text.length > 200) return;
    }
  }

  async generateStandardBriefing(): Promise<void> {
    await this.runBriefing(this.selectors.standardBriefingOption);
  }

  async generateCustomBriefing(): Promise<void> {
    await this.clickElement(this.selectors.customBriefingOption);
    await this.page.waitForTimeout(2000);

    // The custom flow asks for a prompt before it will generate.
    const input = this.page.locator('textarea, input[type="text"]').last();
    if (await input.isVisible({ timeout: 10000 }).catch(() => false)) {
      await input.fill('Summarise the key metrics shown on this dashboard.');
      await this.pressKey('Enter');
    }

    const container = this.page.locator(this.selectors.briefingContainer);
    const deadline = Date.now() + 180000;
    while (Date.now() < deadline) {
      await this.page.waitForTimeout(5000);
      const text = ((await container.textContent().catch(() => '')) || '').trim();
      if (text.length > 200) return;
    }
  }

  async getBriefingText(): Promise<string> {
    return await this.getText(this.selectors.briefingContainer);
  }

  async briefingHasError(): Promise<boolean> {
    const container = this.page.locator(this.selectors.briefingContainer);
    const text = ((await container.textContent().catch(() => '')) || '').toLowerCase();
    return /error|failed|something went wrong|unable to generate/.test(text);
  }

  /** Numeric figures quoted in the briefing text. */
  async getBriefingFigures(): Promise<string[]> {
    const text = await this.getBriefingText();
    const matches = text.match(/[$£€]?\d[\d,]*(\.\d+)?%?/g) || [];
    return [...new Set(matches.map((m) => m.trim()))];
  }

  /**
   * Figures quoted in the briefing that do not appear in the UI values.
   * Normalised so "$15,655,447" and "15655447" count as the same figure.
   */
  findUnmatchedFigures(briefingFigures: string[], uiValues: string[]): string[] {
    const normalise = (s: string) => s.replace(/[$£€,%\s]/g, '');
    const uiNormalised = uiValues.map(normalise).filter(Boolean);

    return briefingFigures.filter((figure) => {
      const target = normalise(figure);
      // Ignore trivia: single digits, years, list numbering.
      if (target.length <= 2) return false;
      if (/^(19|20)\d{2}$/.test(target)) return false;

      return !uiNormalised.some((ui) => ui.includes(target) || target.includes(ui));
    });
  }

  // ---------- Create task ----------
  async clickCreateTask(): Promise<void> {
    await this.clickElement(this.selectors.createTaskButton);
    await this.page.waitForTimeout(4000);
  }

  async isCreateTaskPageDisplayed(): Promise<boolean> {
    const urlMatches = /task/i.test(this.page.url());
    const formVisible = await this.isVisible(
      'form, [role="dialog"], [class*="createTask"]',
      10000
    );
    return urlMatches || formVisible;
  }

  // ---------- Assertions ----------
  async assertPageLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/portfolio-insights/);
    await expect(this.page.locator(this.selectors.pageContainer)).toBeVisible();
  }
}
