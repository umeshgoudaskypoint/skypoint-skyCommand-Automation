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

    // Widget grid.
    //
    // Every widget is a .react-grid-item, but only some are KPI cards - the
    // Portfolio dashboard also carries a Disclaimer text block and the
    // Community Scorecard table. A KPI card is identified by its big value
    // span; the others are checked for rendering only.
    dashboardGrid: '[data-testid="dashboard-grid"]',
    widget: '.react-grid-item',
    kpiCard: '.react-grid-item:has(span.font-extrabold)',
    nonKpiWidget: '.react-grid-item:not(:has(span.font-extrabold))',
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
    // Selecting a briefing type only ARMS it - this button actually runs it.
    // The custom flow's button is labelled "Generate Custom Briefing", which
    // does NOT contain "Generate Briefing" as a substring (the word "Custom"
    // splits it) - so it needs its own selector, not a shared one.
    generateButton: 'button:has-text("Generate Briefing")',
    customGenerateButton: 'button:has-text("Generate Custom Briefing")',
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

  /** Total widgets on the dashboard, KPI cards and everything else. */
  async getWidgetCount(): Promise<number> {
    return await this.getCount(this.selectors.widget);
  }

  /**
   * Non-KPI widgets (the Disclaimer block, Community Scorecard table).
   * These have no single headline value, so they are only checked for
   * rendering with some content and no error.
   */
  async getNonKpiWidgets(): Promise<{ text: string; hasError: boolean }[]> {
    const widgets = this.page.locator(this.selectors.nonKpiWidget);
    const count = await widgets.count();
    const result: { text: string; hasError: boolean }[] = [];

    for (let i = 0; i < count; i++) {
      const text = ((await widgets.nth(i).textContent()) || '').trim();
      result.push({ text, hasError: this.looksLikeError(text) });
    }

    return result;
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

  /**
   * Wait for a briefing to finish generating.
   *
   * The panel already contains the two option cards ("Standard Briefing...",
   * "Custom AI Analysis...") before anything is generated, so simply waiting
   * for "some text" returns instantly and the test races ahead of the LLM.
   *
   * Instead: remember the text before generating, wait for it to CHANGE, then
   * wait for it to STOP GROWING - the response streams in, so a stable length
   * across consecutive polls means generation has finished.
   */
  private async waitForBriefingToGenerate(baseline: string, timeout = 360000): Promise<void> {
    const container = this.page.locator(this.selectors.briefingContainer);
    const deadline = Date.now() + timeout;

    const readText = async () =>
      ((await container.textContent().catch(() => '')) || '').trim();

    // Phase 1: content must actually change from the pre-generation state.
    let changed = false;
    while (Date.now() < deadline && !changed) {
      await this.page.waitForTimeout(3000);
      const text = await readText();
      if (text !== baseline && text.length > baseline.length + 100) {
        changed = true;
      }
    }

    if (!changed) {
      throw new Error(
        `Briefing did not generate within ${timeout / 1000}s - the panel content ` +
          'never changed from its pre-generation state.'
      );
    }

    // Phase 2: streaming has stopped once the length holds steady.
    let previousLength = -1;
    let stableCount = 0;
    while (Date.now() < deadline) {
      await this.page.waitForTimeout(4000);
      const length = (await readText()).length;

      if (length === previousLength) {
        stableCount++;
        if (stableCount >= 3) return;
      } else {
        stableCount = 0;
      }
      previousLength = length;
    }
  }

  /**
   * Generate the standard briefing.
   *
   * Two clicks are required: selecting "Standard Briefing" only arms it and
   * shows "Ready to generate an AI-powered briefing for this dashboard" - a
   * separate "Generate Briefing" button actually starts the LLM call.
   * Missing that second click meant the test waited for a briefing that had
   * never been requested.
   */
  async generateStandardBriefing(): Promise<void> {
    const container = this.page.locator(this.selectors.briefingContainer);

    await this.clickElement(this.selectors.standardBriefingOption);
    await this.page.waitForTimeout(2000);

    // Baseline AFTER arming, so the "Ready to generate" prompt is not
    // mistaken for generated content.
    const baseline = ((await container.textContent().catch(() => '')) || '').trim();

    await this.clickElement(this.selectors.generateButton);
    await this.waitForBriefingToGenerate(baseline);
  }

  async generateCustomBriefing(): Promise<void> {
    const container = this.page.locator(this.selectors.briefingContainer);

    await this.clickElement(this.selectors.customBriefingOption);
    await this.page.waitForTimeout(2000);

    // The custom flow asks for a prompt before it will generate.
    const input = this.page.locator('textarea, input[type="text"]').last();
    if (await input.isVisible({ timeout: 15000 }).catch(() => false)) {
      await input.fill('Summarise the key metrics shown on this dashboard.');
    }

    const baseline = ((await container.textContent().catch(() => '')) || '').trim();

    if (await this.isVisible(this.selectors.customGenerateButton, 10000)) {
      await this.clickElement(this.selectors.customGenerateButton);
    } else if (await this.isVisible(this.selectors.generateButton, 5000)) {
      await this.clickElement(this.selectors.generateButton);
    } else {
      await this.pressKey('Enter');
    }

    await this.waitForBriefingToGenerate(baseline);
  }

  async getBriefingText(): Promise<string> {
    return await this.getText(this.selectors.briefingContainer);
  }

  async briefingHasError(): Promise<boolean> {
    const container = this.page.locator(this.selectors.briefingContainer);
    const text = ((await container.textContent().catch(() => '')) || '').toLowerCase();
    return /error|failed|something went wrong|unable to generate/.test(text);
  }

  /**
   * Every numeric figure visible anywhere on the current dashboard - KPI
   * cards (including their subtext, e.g. "NOI: $16,521,794"), the
   * Disclaimer, and every row of the Community Scorecard table. The
   * standard briefing legitimately summarises per-community figures from
   * the scorecard, not just the 7 KPI cards, so TC-PI-017 must check
   * against all of it or it flags real on-screen data as "missing".
   *
   * Uses innerText (not textContent) so the browser's own rendered layout
   * inserts line breaks between table cells/rows - textContent would
   * concatenate adjacent cells with no separator (e.g. a row's Units and
   * Leads columns run together into one bad number).
   */
  async getOnScreenFigures(): Promise<string[]> {
    const text = await this.waitForDashboardTextToStabilize();
    return this.extractFigures(text);
  }

  /**
   * [data-testid="dashboard-grid"] resolves to TWO separate elements on this
   * page, not a duplicate render of the same thing: one holds the 7 KPI
   * cards + Disclaimer, the other holds the entire Community Scorecard
   * table. Reading only .first() (confirmed via a throwaway probe script)
   * silently drops the whole scorecard, so every match must be read and
   * joined.
   *
   * The Community Scorecard also populates via its own async fetch, later
   * than the KPI cards - waitForInsightsLoad() only waits for the first KPI
   * card, so reading right after goto() can race ahead of it. Poll until
   * the combined text stops growing (same approach used for the AI
   * briefing panel in waitForBriefingToGenerate).
   *
   * innerText (not textContent) so the browser's own rendered layout
   * inserts line breaks between table cells/rows - textContent would
   * concatenate adjacent cells with no separator.
   */
  private async waitForDashboardTextToStabilize(timeout = 60000): Promise<string> {
    const grids = this.page.locator(this.selectors.dashboardGrid);
    const deadline = Date.now() + timeout;
    let previous = '';
    let stableCount = 0;

    const readAll = async (): Promise<string> => {
      const count = await grids.count();
      const texts: string[] = [];
      for (let i = 0; i < count; i++) {
        texts.push(await grids.nth(i).innerText().catch(() => ''));
      }
      return texts.join('\n');
    };

    while (Date.now() < deadline) {
      const current = await readAll();
      if (current.length > 0 && current.length === previous.length) {
        stableCount++;
        if (stableCount >= 3) return current;
      } else {
        stableCount = 0;
      }
      previous = current;
      await this.page.waitForTimeout(1000);
    }
    return previous;
  }

  /** Numeric figures quoted in the briefing text. */
  async getBriefingFigures(): Promise<string[]> {
    const text = await this.getBriefingText();
    return this.extractFigures(text);
  }

  /** Numbers with an optional $/£/€ prefix, K/M/B magnitude suffix, or % suffix. */
  private extractFigures(text: string): string[] {
    const matches = text.match(/[$£€]?\d[\d,]*(?:\.\d+)?[KMBkmb]?%?/g) || [];
    return [...new Set(matches.map((m) => m.trim()).filter(Boolean))];
  }

  private parseFigure(raw: string): { numeric: number; isPercent: boolean; digits: string } | null {
    const isPercent = raw.trim().endsWith('%');
    const cleaned = raw.replace(/[$£€,%\s]/g, '');
    const suffix = cleaned.match(/([KMBkmb])$/);
    const numStr = suffix ? cleaned.slice(0, -1) : cleaned;
    const numeric = parseFloat(numStr);
    if (Number.isNaN(numeric)) return null;

    const multipliers = { k: 1e3, m: 1e6, b: 1e9 } as const;
    const multiplier = suffix ? multipliers[suffix[1].toLowerCase() as 'k' | 'm' | 'b'] : 1;
    return { numeric: numeric * multiplier, isPercent, digits: numStr.replace('.', '') };
  }

  /**
   * Is this a simple derivation from two on-screen numbers - "total x
   * rate%" or "total x (1 - rate%)" (e.g. "181 vacant units" computed from
   * the on-screen "2,492 total units" and an on-screen vacancy/occupancy
   * rate)? The briefing sometimes computes a count from an on-screen
   * percentage rather than quoting a count that is itself on screen -
   * treat that as an acceptable derivation, not a fabricated figure.
   * Tolerance is generous (15%) because rendered percentages are rounded
   * to 1-2 decimals while the underlying figure is not, so an exact
   * product is not expected.
   */
  private isDerivedFromOnScreen(
    target: number,
    onScreen: { numeric: number; isPercent: boolean }[]
  ): boolean {
    const totals = onScreen.filter((u) => !u.isPercent && u.numeric > 1).map((u) => u.numeric);
    const rates = onScreen.filter((u) => u.isPercent).map((u) => u.numeric / 100);

    return totals.some((total) =>
      rates.some((rate) =>
        [total * rate, total * (1 - rate)].some((c) => Math.abs(c - target) / target <= 0.15)
      )
    );
  }

  /**
   * Figures quoted in the briefing that do not appear anywhere on screen.
   *
   * Compares numerically, not by string containment - the previous
   * substring check treated any UI value as a wildcard once normalised to
   * 1-2 characters (e.g. the Net Movement card's "0" is a substring of
   * almost every number), which silently passed figures that were never
   * actually on screen.
   *
   * Percentages match within a small rounding tolerance, since the briefing
   * sometimes quotes an extra decimal (e.g. "7.89%" for a UI value shown
   * as "7.9%" - the same metric, more precision). Currency and counts match
   * within a small relative tolerance, to allow for "$16.52M" vs
   * "$16,521,794"-style magnitude rounding. Bare 1-2 digit whole numbers
   * (list counts, ordinals - "5 communities", "1 community flagged") are
   * not checked, since they are rarely a specific on-screen figure. Nor are
   * whole-number percentages with no decimal ("below 90%", "sub-80%
   * occupancy") - every percentage this dashboard ever renders carries a
   * decimal (92.0%, 89.00%, ...), so a bare one is reliably threshold
   * language in the prose, not a citation of a specific figure. A count
   * that is a simple total x rate% derivation of two on-screen numbers is
   * also allowed - see isDerivedFromOnScreen.
   */
  findUnmatchedFigures(briefingFigures: string[], onScreenFigures: string[]): string[] {
    const onScreen = onScreenFigures
      .map((f) => this.parseFigure(f))
      .filter((p): p is NonNullable<typeof p> => p !== null);

    return briefingFigures.filter((figure) => {
      const target = this.parseFigure(figure);
      if (!target) return false;

      const isBareSmallInt = !figure.includes('%') && !figure.includes('.') && target.digits.length <= 2;
      if (isBareSmallInt) return false;
      if (target.isPercent && !figure.includes('.')) return false;
      if (/^(19|20)\d{2}$/.test(target.digits) && !figure.includes('%')) return false;

      const onScreenMatch = onScreen.some((ui) => {
        if (target.isPercent !== ui.isPercent) return false;
        if (target.isPercent) return Math.abs(target.numeric - ui.numeric) <= 0.05;
        if (ui.numeric === 0) return target.numeric === 0;
        return Math.abs(target.numeric - ui.numeric) / Math.abs(ui.numeric) <= 0.005;
      });
      if (onScreenMatch) return false;

      if (!target.isPercent && this.isDerivedFromOnScreen(target.numeric, onScreen)) return false;

      return true;
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
