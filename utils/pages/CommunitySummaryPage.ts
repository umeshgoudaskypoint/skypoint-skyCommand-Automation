import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export type KpiCard = {
  title: string;
  value: string;
  hasError: boolean;
};

export type ChartWidget = {
  title: string;
  text: string;
  hasChart: boolean;
  hasError: boolean;
};

/**
 * CommunitySummaryPage - /insights/community-summary
 *
 * Same page shell as Portfolio (dashboard-grid, KPI cards, filter bar, edit
 * mode - see PortfolioInsightsPage for the pattern this mirrors), but two
 * real differences:
 *
 *  - No data table here. The non-KPI widgets are all Recharts charts, so
 *    "renders correctly" means an <svg> (or otherwise non-trivial content)
 *    with no error text - never a specific plotted value.
 *  - Four tabs: Dashboard / Forecasting / History / Scenarios. Only
 *    Dashboard has real content in this tenant; the rest intentionally show
 *    a "Not Configured" / "No forecast runs yet" empty state, which is a
 *    PASS, not a failure - only a genuine error or a stuck loader fails.
 */
export class CommunitySummaryPage extends BasePage {
  readonly selectors = {
    // Page shell
    pageContainer: '[data-testid="dynamic-insight-page"]',
    pageHeader: '[data-testid="dashboard-header"]',
    loadingSpinner: '[class*="animate-pulse"], [class*="skeleton"], [role="progressbar"]',

    // Widget grid. KPI cards use the same span.font-extrabold convention as
    // Portfolio; charts do not, so the same :has()/:not() split works.
    dashboardGrid: '[data-testid="dashboard-grid"]',
    widget: '.react-grid-item',
    kpiCard: '.react-grid-item:has(span.font-extrabold)',
    chartWidget: '.react-grid-item:not(:has(span.font-extrabold))',
    kpiTitle: 'span.font-semibold',
    kpiValue: 'span.font-extrabold',
    chartTitle: '.font-semibold',
    chartSvg: 'svg',

    // Empty state (a tenant with no widgets configured)
    emptyState: '[data-testid="dynamic-insight-page-empty"]',

    // Filter bar
    quickMonthDropdown: '[data-testid="filter-bar-quick-month"]',
    communityDropdown: '[data-testid="filter-bar-community"]',
    dropdownOption: '[role="option"], [role="menuitem"], li',

    // Edit mode
    editButton: '[data-testid="dashboard-edit-btn"]',
    saveButton: 'button:has-text("Save")',
    cancelButton: 'button:has-text("Cancel"), button:has-text("Discard")',

    // Tabs
    tab: '[role="tab"]',

    // Errors
    errorState: '[role="alert"], [class*="destructive"]',
  };

  private get instanceId(): string {
    return process.env.INSTANCE_ID || '';
  }

  // ---------- Navigation ----------
  async goto(): Promise<void> {
    if (this.instanceId) {
      await this.page.goto(`/insights/community-summary?instanceid=${this.instanceId}`, {
        waitUntil: 'domcontentloaded',
      });
      await this.waitForInsightsLoad();
      return;
    }
    await this.gotoFromHome();
  }

  async gotoFromHome(): Promise<void> {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
    await this.waitForNetworkIdle();

    const tenant = process.env.TENANT;
    if (tenant) {
      await this.switchToTenant(tenant);
    }

    if (!this.page.url().includes('community-summary')) {
      const link = this.page.locator('a[href*="community-summary"]').first();
      if (await link.isVisible({ timeout: 15000 }).catch(() => false)) {
        await link.click();
      }
    }

    await this.page.waitForURL(/community-summary/, { timeout: 30000 }).catch(() => {});
    await this.waitForInsightsLoad();
  }

  /** Wait for the dashboard grid (or the empty state) to settle. */
  async waitForInsightsLoad(timeout = 90000): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded', { timeout });

    await this.page
      .locator(this.selectors.pageContainer)
      .waitFor({ state: 'visible', timeout })
      .catch(() => {});

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
      this.page.url().includes('community-summary') &&
      (await this.isVisible(this.selectors.pageContainer, 20000))
    );
  }

  async isStillLoading(): Promise<boolean> {
    return await this.isVisible(this.selectors.loadingSpinner, 3000);
  }

  async hasErrorState(): Promise<boolean> {
    return await this.isVisible(this.selectors.errorState, 5000);
  }

  private looksLikeError(text: string): boolean {
    return /error|failed|unable to load|something went wrong/i.test(text);
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

  /**
   * A KPI value is valid if it is a number, percentage or currency amount.
   * Zero is a PASS - it means Power BI has no value for that metric.
   */
  isValidKpiValue(value: string): boolean {
    if (!value) return false;
    const cleaned = value.replace(/[\s,]/g, '');
    return /^[-+]?[$£€]?\d+(\.\d+)?[%KMB]?$/i.test(cleaned);
  }

  // ---------- Chart widgets ----------
  /**
   * This dashboard has no data table - every non-KPI widget is a Recharts
   * chart. "Renders correctly" means an <svg> is present (or, failing
   * that, some non-trivial content beyond the title) with no error text -
   * never a specific plotted value.
   */
  async getChartWidgets(): Promise<ChartWidget[]> {
    const widgets = this.page.locator(this.selectors.chartWidget);
    const count = await widgets.count();
    const result: ChartWidget[] = [];

    for (let i = 0; i < count; i++) {
      const widget = widgets.nth(i);
      const text = ((await widget.textContent()) || '').trim();

      const title = await widget
        .locator(this.selectors.chartTitle)
        .first()
        .textContent()
        .then((t) => (t || '').trim())
        .catch(() => '');

      const hasChart = (await widget.locator(this.selectors.chartSvg).count()) > 0;

      result.push({
        title: title || `chart-${i + 1}`,
        text,
        hasChart,
        hasError: this.looksLikeError(text),
      });
    }

    return result;
  }

  // ---------- Filters ----------
  async getSelectedQuickMonth(): Promise<string> {
    return await this.getText(this.selectors.quickMonthDropdown);
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

  // ---------- Tabs ----------
  async getTabNames(): Promise<string[]> {
    return (await this.page.locator(this.selectors.tab).allTextContents())
      .map((t) => t.trim())
      .filter(Boolean);
  }

  async switchToTab(name: string): Promise<void> {
    await this.page
      .locator(this.selectors.tab)
      .filter({ hasText: name })
      .first()
      .click();
    await this.page.waitForTimeout(2000);
    await this.waitForNetworkIdle();
  }

  /**
   * A tab is legitimately "unconfigured" (a PASS, not a failure) when it
   * shows the app's own "Not Configured" / "No forecast runs yet" empty
   * state - as opposed to a genuine error or a stuck loader.
   */
  async isTabUnconfigured(): Promise<boolean> {
    const text =
      (await this.page
        .locator(this.selectors.pageContainer)
        .textContent()
        .catch(() => '')) || '';
    return /not configured|no forecast runs yet/i.test(text);
  }
}
