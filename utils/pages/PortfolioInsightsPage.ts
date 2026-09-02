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
 * Selectors use multi-strategy fallbacks (data-testid, then class, then
 * text/ARIA) so the page object survives markup changes. Refine them with
 * real data-testid values once the authenticated UI can be inspected.
 */
export class PortfolioInsightsPage extends BasePage {
  readonly selectors = {
    pageContainer:
      '[data-testid="portfolio-insights"], main, [class*="portfolio"], [class*="insights"]',
    pageHeading: 'h1, h2, [data-testid="page-title"], [class*="pageTitle"]',
    loadingSpinner:
      '[data-testid="loading"], [class*="spinner"], [class*="skeleton"], [role="progressbar"]',

    // KPI cards
    kpiCard:
      '[data-testid*="kpi"], [class*="kpiCard"], [class*="kpi-card"], [class*="metricCard"], [class*="statCard"]',
    kpiTitle: '[class*="title"], [class*="label"], h3, h4',
    kpiValue: '[class*="value"], [class*="amount"], [class*="metric"], strong',

    // Filters
    quickMonthDropdown:
      '[data-testid*="month"], [class*="quickMonth"], [class*="month-select"], [aria-label*="month" i]',
    dateRangePicker:
      '[data-testid*="date-range"], [class*="dateRange"], [class*="date-picker"], [aria-label*="date" i]',
    communityDropdown:
      '[data-testid*="community"], [class*="community"], [aria-label*="community" i]',
    dropdownOption: '[role="option"], [class*="option"], li[data-value], .ant-select-item',

    // Edit mode
    editButton: 'button:has-text("Edit"), [aria-label*="Edit" i], [data-testid*="edit"]',
    editModeIndicator:
      '[data-testid*="edit-mode"], [class*="editMode"], button:has-text("Save"), button:has-text("Cancel")',
    cancelButton: 'button:has-text("Cancel"), button:has-text("Discard"), [data-testid*="cancel"]',

    // AI briefing
    aiBriefingButton:
      'button:has-text("AI Briefing"), button:has-text("Briefing"), [data-testid*="briefing"]',
    standardBriefingOption:
      'button:has-text("Standard"), [role="tab"]:has-text("Standard"), [data-testid*="standard"]',
    customBriefingOption:
      'button:has-text("Custom"), [role="tab"]:has-text("Custom"), [data-testid*="custom"]',
    generateButton: 'button:has-text("Generate"), button:has-text("Create Briefing")',
    briefingContent:
      '[data-testid*="briefing-content"], [class*="briefingContent"], [class*="briefing-body"]',
    briefingError: '[class*="error"], [role="alert"]',

    // Create task
    createTaskButton:
      'button:has-text("Create a task"), button:has-text("Create Task"), a:has-text("Create a task")',
    createTaskPage: '[data-testid*="create-task"], [class*="createTask"], form[class*="task"]',

    // Generic states
    emptyState: '[class*="empty"]',
    errorState: '[class*="error"], [role="alert"]',
  };

  private get instanceId(): string {
    return process.env.INSTANCE_ID || 'f507ae68-5a2b-447e-a78c-5098e889e16d';
  }

  constructor(page: Page) {
    super(page);
  }

  // ---------- Navigation & load ----------
  /**
   * Open the Portfolio page.
   *
   * Prefers navigating through the UI from the app root, so the tenant is
   * whichever one the app selects for the signed-in user - no hard-coded
   * instance id needed. Falls back to the direct URL when INSTANCE_ID is
   * set explicitly in .env.
   */
  async goto(): Promise<void> {
    if (process.env.INSTANCE_ID) {
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

    // Make sure we are in the tenant under test before going anywhere.
    const tenant = process.env.TENANT;
    if (tenant) {
      await this.switchToTenant(tenant);
    }

    // Already there? Some tenants land on Portfolio by default.
    if (this.page.url().includes('portfolio-insights')) {
      await this.waitForInsightsLoad();
      return;
    }

    const insightsLink = this.page
      .locator('a[href*="/insights"], [role="link"]:has-text("Insights")')
      .first();
    if (await insightsLink.isVisible({ timeout: 15000 }).catch(() => false)) {
      await insightsLink.click();
      await this.page.waitForTimeout(2000);
    }

    const portfolioLink = this.page
      .locator('a[href*="portfolio"], :text("Portfolio Insights"), :text("Portfolio")')
      .first();
    if (await portfolioLink.isVisible({ timeout: 15000 }).catch(() => false)) {
      await portfolioLink.click();
    }

    await this.page.waitForURL(/portfolio/, { timeout: 30000 }).catch(() => {});
    await this.waitForInsightsLoad();
  }

  /** The instance id currently in the address bar, whatever it is. */
  getInstanceIdFromUrl(): string | null {
    try {
      return new URL(this.page.url()).searchParams.get('instanceid');
    } catch {
      return null;
    }
  }

  async waitForInsightsLoad(timeout = 60000): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded', { timeout });
    try {
      await this.page
        .locator(this.selectors.loadingSpinner)
        .first()
        .waitFor({ state: 'hidden', timeout: 30000 });
    } catch {
      // Spinner may never render, or may poll forever - not a failure by itself.
    }
    await this.waitForNetworkIdle();
  }

  async isInsightsPageLoaded(): Promise<boolean> {
    return (
      this.page.url().includes('portfolio-insights') &&
      (await this.isVisible(this.selectors.pageContainer, 15000))
    );
  }

  async isStillLoading(): Promise<boolean> {
    return await this.isVisible(this.selectors.loadingSpinner, 3000);
  }

  async hasErrorState(): Promise<boolean> {
    return await this.isVisible(this.selectors.errorState, 5000);
  }

  // ---------- KPI cards ----------
  async getKpiCards(): Promise<KpiCard[]> {
    await this.page
      .locator(this.selectors.kpiCard)
      .first()
      .waitFor({ state: 'visible', timeout: 30000 })
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
        // Fall back to the card's own text when no value node is matched.
        value: value || raw,
        hasError: this.looksLikeError(raw),
      });
    }

    return result;
  }

  /** Titles of cards that are erroring or blank. */
  async getFailingKpiCards(): Promise<string[]> {
    const cards = await this.getKpiCards();
    return cards.filter((c) => c.hasError || c.value === '').map((c) => c.title);
  }

  private looksLikeError(text: string): boolean {
    return /error|failed|unable to load|something went wrong/i.test(text);
  }

  /**
   * A KPI value is valid if it is a number, percentage, or currency amount.
   * Zero is a PASS - it means PBI has no value for that metric.
   */
  isValidKpiValue(value: string): boolean {
    if (!value) return false;
    const cleaned = value.replace(/[\s,]/g, '');
    return /^[-+]?[$£€]?\d+(\.\d+)?[%KMB]?$/i.test(cleaned);
  }

  // ---------- Filters ----------
  private async selectDropdownOption(dropdownSelector: string, index = 1): Promise<void> {
    await this.clickElement(dropdownSelector);
    await this.page.waitForTimeout(1000);

    const options = this.page.locator(this.selectors.dropdownOption);
    const count = await options.count();
    if (count === 0) {
      throw new Error(`Dropdown "${dropdownSelector}" opened but listed no options`);
    }

    await options.nth(Math.min(index, count - 1)).click();
    await this.page.waitForTimeout(1000);
  }

  async changeQuickMonth(): Promise<void> {
    await this.selectDropdownOption(this.selectors.quickMonthDropdown);
  }

  async changeDateRange(): Promise<void> {
    await this.selectDropdownOption(this.selectors.dateRangePicker);
  }

  async selectDifferentCommunity(): Promise<void> {
    await this.selectDropdownOption(this.selectors.communityDropdown);
  }

  async getCommunityOptions(): Promise<string[]> {
    await this.clickElement(this.selectors.communityDropdown);
    await this.page.waitForTimeout(1000);

    const texts = await this.page.locator(this.selectors.dropdownOption).allTextContents();
    await this.pressKey('Escape');

    return texts.map((t) => t.trim()).filter(Boolean);
  }

  // ---------- Edit mode ----------
  async enterEditMode(): Promise<void> {
    await this.clickElement(this.selectors.editButton);
    await this.page.waitForTimeout(2000);
  }

  async isInEditMode(): Promise<boolean> {
    return await this.isVisible(this.selectors.editModeIndicator, 5000);
  }

  /** Leave edit mode WITHOUT saving, so no state is persisted. */
  async exitEditModeWithoutSaving(): Promise<void> {
    if (await this.isVisible(this.selectors.cancelButton, 5000)) {
      await this.clickElement(this.selectors.cancelButton);
    } else {
      await this.pressKey('Escape');
    }
    await this.page.waitForTimeout(2000);
  }

  /** Fingerprint of the layout, used to prove edit mode changed nothing. */
  async captureLayoutSnapshot(): Promise<string[]> {
    const cards = await this.getKpiCards();
    return cards.map((c) => `${c.title}|${c.value}`);
  }

  // ---------- AI briefing ----------
  async openAiBriefing(): Promise<void> {
    await this.clickElement(this.selectors.aiBriefingButton);
    await this.page.waitForTimeout(2000);
  }

  private async generateBriefing(optionSelector: string): Promise<void> {
    if (await this.isVisible(optionSelector, 5000)) {
      await this.clickElement(optionSelector);
      await this.page.waitForTimeout(1000);
    }

    if (await this.isVisible(this.selectors.generateButton, 5000)) {
      await this.clickElement(this.selectors.generateButton);
    }

    // Generation is an LLM call - allow generous time.
    await this.page
      .locator(this.selectors.briefingContent)
      .first()
      .waitFor({ state: 'visible', timeout: 120000 })
      .catch(() => {});
    await this.page.waitForTimeout(3000);
  }

  async generateStandardBriefing(): Promise<void> {
    await this.generateBriefing(this.selectors.standardBriefingOption);
  }

  async generateCustomBriefing(): Promise<void> {
    await this.generateBriefing(this.selectors.customBriefingOption);
  }

  async getBriefingText(): Promise<string> {
    return await this.getText(this.selectors.briefingContent);
  }

  async briefingHasError(): Promise<boolean> {
    return await this.isVisible(this.selectors.briefingError, 5000);
  }

  /** Numeric figures quoted in the briefing text. */
  async getBriefingFigures(): Promise<string[]> {
    const text = await this.getBriefingText();
    const matches = text.match(/[$£€]?\d[\d,]*(\.\d+)?%?/g) || [];
    return [...new Set(matches.map((m) => m.trim()))];
  }

  /**
   * Figures quoted in the briefing that do not appear anywhere in the UI
   * values. Comparison is normalised (strips currency, commas, %) so
   * "1,234" and "$1234" count as the same figure.
   */
  findUnmatchedFigures(briefingFigures: string[], uiValues: string[]): string[] {
    const normalise = (s: string) => s.replace(/[$£€,%\s]/g, '');
    const uiNormalised = uiValues.map(normalise);

    return briefingFigures.filter((figure) => {
      const target = normalise(figure);
      // Ignore trivial figures - single digits, years, list numbering.
      if (target.length <= 1) return false;
      if (/^(19|20)\d{2}$/.test(target)) return false;

      return !uiNormalised.some((ui) => ui.includes(target) || target.includes(ui));
    });
  }

  // ---------- Create task ----------
  async clickCreateTask(): Promise<void> {
    await this.clickElement(this.selectors.createTaskButton);
    await this.page.waitForTimeout(3000);
  }

  async isCreateTaskPageDisplayed(): Promise<boolean> {
    const urlMatches = /task/i.test(this.page.url());
    const formVisible = await this.isVisible(this.selectors.createTaskPage, 10000);
    return urlMatches || formVisible;
  }

  // ---------- Assertions ----------
  async assertPageLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/portfolio-insights/);
    await expect(this.page.locator(this.selectors.pageContainer).first()).toBeVisible();
  }
}
