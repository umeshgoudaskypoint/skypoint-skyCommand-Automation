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
 * OccupancyPage - /insights/occupancy
 *
 * Same page shell as Community Summary (dashboard-grid, filter bar, edit
 * mode, tabs), but with real differences confirmed by live inspection
 * before writing any selector here:
 *
 *  - The page heading reads "Analytics", not "Occupancy" - every other
 *    module's heading matches its own name, so this looks like a real
 *    copy bug. Not asserted on as a failure here since it's a content
 *    question for QA, but deliberately NOT hidden by hard-coding "Analytics"
 *    as if it were correct - see isInsightsPageLoaded / TC-OC-035.
 *  - The 4 KPI cards sit inside a `[data-testid="group-container"]` wrapper
 *    that is itself a *child* of a `.react-grid-item` (not one itself), so
 *    `.react-grid-item:has(span.font-extrabold)` alone also matches that
 *    outer wrapper as a spurious 5th "card". Confirmed live and excluded
 *    via :not(:has(...)).
 *  - Forecasting/History/Scenarios are REAL configured features here
 *    (unlike Community Summary, where all three are legitimately
 *    "Not Configured"). History already shows a genuinely failed past run,
 *    and Scenarios reproduces a live "Power BI API error: 400" as plain
 *    page text with no alert/destructive styling - so the generic
 *    hasErrorState() check (role=alert/[class*=destructive]) does not
 *    catch it, and a generic word-scan for "error"/"failed" would wrongly
 *    flag History's legitimate "Failed" status column. hasApiErrorText()
 *    targets the specific "API error" pattern instead of either extreme.
 */
export class OccupancyPage extends BasePage {
  readonly selectors = {
    // Page shell
    pageContainer: '[data-testid="dynamic-insight-page"]',
    pageHeader: '[data-testid="dashboard-header"]',
    loadingSpinner: '[class*="animate-pulse"], [class*="skeleton"], [role="progressbar"]',

    // Widget grid
    dashboardGrid: '[data-testid="dashboard-grid"]',
    widget: '.react-grid-item',
    // Excludes the group wrapper around the 4 KPI cards, which also
    // matches :has(span.font-extrabold) since :has() checks descendants.
    kpiCard: '.react-grid-item:has(span.font-extrabold):not(:has([data-testid="group-container"]))',
    chartWidget: '.react-grid-item:not(:has(span.font-extrabold))',
    kpiTitle: 'span.font-semibold',
    kpiValue: 'span.font-extrabold',
    chartTitle: '.font-semibold',
    chartSvg: 'svg',

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

    // Forecasting tab
    generateForecastButton: 'button:has-text("Generate Forecast")',

    // Errors
    errorState: '[role="alert"], [class*="destructive"]',
  };

  private get instanceId(): string {
    return process.env.INSTANCE_ID || '';
  }

  // ---------- Navigation ----------
  async goto(): Promise<void> {
    if (this.instanceId) {
      await this.page.goto(`/insights/occupancy?instanceid=${this.instanceId}`, {
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

    if (!this.page.url().includes('/insights/occupancy')) {
      const link = this.page.locator('a[href*="/insights/occupancy"]').first();
      if (await link.isVisible({ timeout: 15000 }).catch(() => false)) {
        await link.click();
      }
    }

    await this.page.waitForURL(/occupancy/, { timeout: 30000 }).catch(() => {});
    await this.waitForInsightsLoad();
  }

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
      this.page.url().includes('occupancy') &&
      (await this.isVisible(this.selectors.pageContainer, 20000))
    );
  }

  async isStillLoading(): Promise<boolean> {
    return await this.isVisible(this.selectors.loadingSpinner, 3000);
  }

  async hasErrorState(): Promise<boolean> {
    return await this.isVisible(this.selectors.errorState, 5000);
  }

  /**
   * A raw backend/API error surfaced as plain page text (e.g. "Power BI
   * API error: 400"), as opposed to a structured alert/destructive error
   * state or legitimate historical status data (e.g. History's "Failed"
   * status column, which must NOT trip this).
   */
  async hasApiErrorText(): Promise<boolean> {
    const text =
      (await this.page
        .locator(this.selectors.pageContainer)
        .textContent()
        .catch(() => '')) || '';
    return /\bapi error\b/i.test(text);
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

  async getFailingKpiCards(): Promise<string[]> {
    const cards = await this.getKpiCards();
    return cards.filter((c) => c.hasError || c.value === '').map((c) => c.title);
  }

  isValidKpiValue(value: string): boolean {
    if (!value) return false;
    const cleaned = value.replace(/[\s,]/g, '');
    return /^[-+]?[$£€]?\d+(\.\d+)?[%KMB]?$/i.test(cleaned);
  }

  private isZeroValue(value: string): boolean {
    const cleaned = value.replace(/[$£€,%\s]/g, '');
    const numeric = parseFloat(cleaned);
    return !Number.isNaN(numeric) && numeric === 0;
  }

  /**
   * KPI cards that read 0 THIS period AND stayed at 0 across the last
   * `monthsToCheck` prior months too - see PortfolioInsightsPage for the
   * full rationale. Restores the original month before returning.
   */
  async findStuckZeroKpis(monthsToCheck = 3): Promise<string[]> {
    const originalMonth = await this.getSelectedQuickMonth();
    const currentCards = await this.getKpiCards();
    const zeroTitles = new Set(
      currentCards.filter((c) => !c.hasError && this.isZeroValue(c.value)).map((c) => c.title)
    );

    if (zeroTitles.size === 0) return [];

    const allMonths = await this.getQuickMonthList();
    const currentIndex = allMonths.indexOf(originalMonth);
    const priorMonths = (
      currentIndex >= 0 ? allMonths.slice(currentIndex + 1) : allMonths
    ).slice(0, monthsToCheck);

    const recovered = new Set<string>();

    for (const month of priorMonths) {
      await this.selectQuickMonth(month);
      const cards = await this.getKpiCards();
      for (const card of cards) {
        if (zeroTitles.has(card.title) && !card.hasError && !this.isZeroValue(card.value)) {
          recovered.add(card.title);
        }
      }
    }

    await this.selectQuickMonth(originalMonth);

    return [...zeroTitles].filter((title) => !recovered.has(title));
  }

  // ---------- Chart widgets ----------
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

  async getQuickMonthList(): Promise<string[]> {
    await this.clickElement(this.selectors.quickMonthDropdown);
    await this.page.waitForTimeout(1500);
    const texts = await this.page
      .locator(this.selectors.dropdownOption)
      .filter({ hasText: /^\w{3} \d{4}$/ })
      .allTextContents();
    await this.pressKey('Escape');
    return texts.map((t) => t.trim()).filter(Boolean);
  }

  async selectQuickMonth(month: string): Promise<void> {
    await this.clickElement(this.selectors.quickMonthDropdown);
    await this.page.waitForTimeout(1500);

    const option = this.page.locator(this.selectors.dropdownOption).filter({ hasText: month }).first();
    await option.click({ timeout: 15000 });
    await this.page.waitForTimeout(2000);
    await this.waitForInsightsLoad();
  }

  async changeQuickMonth(): Promise<void> {
    const current = await this.getSelectedQuickMonth();

    await this.clickElement(this.selectors.quickMonthDropdown);
    await this.page.waitForTimeout(1500);

    const option = this.page
      .locator(this.selectors.dropdownOption)
      .filter({ hasText: /^\w{3} \d{4}$/ })
      .filter({ hasNotText: current })
      .first();

    await option.click({ timeout: 15000 });
    await this.page.waitForTimeout(2000);
  }

  async changeDateRange(): Promise<void> {
    await this.clickElement(this.selectors.quickMonthDropdown);
    await this.page.waitForTimeout(1500);

    const custom = this.page
      .locator(this.selectors.dropdownOption)
      .filter({ hasText: /custom range/i })
      .first();
    await custom.click({ timeout: 15000 });
    await this.page.waitForTimeout(2000);

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

  async exitEditModeWithoutSaving(): Promise<void> {
    if (await this.isVisible(this.selectors.cancelButton, 5000)) {
      await this.clickElement(this.selectors.cancelButton);
    } else {
      await this.pressKey('Escape');
    }
    await this.page.waitForTimeout(3000);
  }

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

  async isTabUnconfigured(): Promise<boolean> {
    const text =
      (await this.page
        .locator(this.selectors.pageContainer)
        .textContent()
        .catch(() => '')) || '';
    return /not configured|no forecast runs yet/i.test(text);
  }

  // ---------- Forecasting ----------
  /** Click "Generate Forecast" and wait for it to settle (success or error). */
  async generateForecast(timeout = 90000): Promise<void> {
    await this.clickElement(this.selectors.generateForecastButton);

    const deadline = Date.now() + timeout;
    let previousLength = -1;
    let stableCount = 0;

    while (Date.now() < deadline) {
      await this.page.waitForTimeout(3000);

      if ((await this.hasErrorState()) || (await this.hasApiErrorText())) return;

      const length = (
        (await this.page.locator(this.selectors.pageContainer).textContent().catch(() => '')) || ''
      ).length;

      if (length === previousLength) {
        stableCount++;
        if (stableCount >= 3) return;
      } else {
        stableCount = 0;
      }
      previousLength = length;
    }
  }
}
