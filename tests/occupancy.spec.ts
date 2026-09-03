import { test, expect } from '../utils/fixtures';

/**
 * Occupancy module - Westmont tenant.
 *
 * UI-only test cases: rendering and interaction checks, never data-value
 * assertions. Same principles as Portfolio/Community Summary:
 *  - Do NOT validate numbers against Power BI - test that the UI RENDERS.
 *  - A single 0 on a KPI card is a PASS, but one stuck at 0 across the
 *    current period and the last 3 months looks broken, not legitimately
 *    empty - see findStuckZeroKpis().
 *  - Leave no trace. Edit-mode tests must restore the original state.
 *
 * Unlike Community Summary, Forecasting/History/Scenarios are REAL
 * configured features on this module, not "Not Configured" empty states -
 * confirmed live before writing these. History already contains a
 * genuinely failed past run (legitimate historical data, not a UI error),
 * and Scenarios currently reproduces a live "Power BI API error: 400" as
 * plain page text - TC-OC-045 is expected to fail on that until it's
 * fixed; it is deliberately not special-cased away.
 */

test.describe('Occupancy - Page Load', () => {
  // Test Case: TC-OC-035
  test('TC-OC-035: Occupancy page renders for the Westmont tenant @sanity @regression', async ({
    occupancyPage,
  }) => {
    await occupancyPage.goto();

    expect(await occupancyPage.isInsightsPageLoaded()).toBe(true);
    await expect(
      occupancyPage.page.locator(occupancyPage.selectors.pageHeader)
    ).toBeVisible();
  });

  // Test Case: TC-OC-036
  test('TC-OC-036: no error banner or error state on load @sanity @regression @negative', async ({
    occupancyPage,
  }) => {
    await occupancyPage.goto();

    expect(await occupancyPage.hasErrorState()).toBe(false);
  });

  // Test Case: TC-OC-037
  test('TC-OC-037: no loading spinner remains stuck after load @regression', async ({
    occupancyPage,
  }) => {
    await occupancyPage.goto();
    await occupancyPage.page.waitForTimeout(3000);

    expect(await occupancyPage.isStillLoading()).toBe(false);
  });
});

test.describe('Occupancy - KPI Cards', () => {
  // Test Case: TC-OC-038
  test('TC-OC-038: all KPI cards render with a value (0 is valid unless stuck) @sanity @regression', async ({
    occupancyPage,
  }) => {
    await occupancyPage.goto();

    const cards = await occupancyPage.getKpiCards();
    expect(cards.length, 'no KPI cards rendered').toBeGreaterThan(0);

    for (const card of cards) {
      expect(card.hasError, `KPI card "${card.title}" shows an error`).toBe(false);
      expect(card.value, `KPI card "${card.title}" has no value`).not.toBe('');
      expect(
        occupancyPage.isValidKpiValue(card.value),
        `KPI card "${card.title}" has a malformed value: "${card.value}"`
      ).toBe(true);
    }

    const stuck = await occupancyPage.findStuckZeroKpis();
    expect(
      stuck,
      `KPI card(s) stuck at 0 across the last 3+ months: ${stuck.join(', ')}`
    ).toHaveLength(0);
  });
});

test.describe('Occupancy - Chart Widgets', () => {
  // Test Case: TC-OC-039
  test('TC-OC-039: all chart widgets render without an error or blank state @sanity @regression', async ({
    occupancyPage,
  }) => {
    await occupancyPage.goto();

    const charts = await occupancyPage.getChartWidgets();
    expect(charts.length, 'no chart widgets rendered').toBeGreaterThan(0);

    for (const chart of charts) {
      expect(chart.hasError, `chart "${chart.title}" shows an error`).toBe(false);
      const hasContent = chart.hasChart || chart.text.length > chart.title.length + 5;
      expect(hasContent, `chart "${chart.title}" appears blank`).toBe(true);
    }
  });
});

test.describe('Occupancy - Filters', () => {
  // Test Case: TC-OC-040
  test('TC-OC-040: Quick Month / Date Range / Community filters update the dashboard without error @sanity @regression', async ({
    occupancyPage,
  }) => {
    await occupancyPage.goto();

    await occupancyPage.changeQuickMonth();
    await occupancyPage.waitForInsightsLoad();
    expect(await occupancyPage.hasErrorState()).toBe(false);
    expect((await occupancyPage.getFailingKpiCards()).length).toBe(0);

    await occupancyPage.changeDateRange();
    await occupancyPage.waitForInsightsLoad();
    expect(await occupancyPage.hasErrorState()).toBe(false);
    expect((await occupancyPage.getFailingKpiCards()).length).toBe(0);

    const options = await occupancyPage.getCommunityOptions();
    expect(options.length, 'community dropdown is empty').toBeGreaterThan(0);

    await occupancyPage.selectDifferentCommunity();
    await occupancyPage.waitForInsightsLoad();
    expect(await occupancyPage.hasErrorState()).toBe(false);
    expect((await occupancyPage.getFailingKpiCards()).length).toBe(0);
  });
});

test.describe('Occupancy - Edit Mode', () => {
  // These tests must leave the page exactly as they found it.

  // Test Case: TC-OC-041
  test('TC-OC-041: edit mode opens and closes cleanly, layout unchanged @sanity @regression', async ({
    occupancyPage,
  }) => {
    await occupancyPage.goto();

    const before = await occupancyPage.captureLayoutSnapshot();

    await occupancyPage.enterEditMode();
    expect(await occupancyPage.isInEditMode()).toBe(true);

    await occupancyPage.exitEditModeWithoutSaving();
    expect(await occupancyPage.isInEditMode()).toBe(false);
    await occupancyPage.waitForInsightsLoad();

    const after = await occupancyPage.captureLayoutSnapshot();
    expect(after, 'layout changed after entering and leaving edit mode').toEqual(before);
  });
});

test.describe('Occupancy - Forecasting', () => {
  test.setTimeout(180000);

  // Test Case: TC-OC-042
  test('TC-OC-042: Forecasting tab renders its configuration form without error @sanity @regression', async ({
    occupancyPage,
  }) => {
    await occupancyPage.goto();
    await occupancyPage.switchToTab('Forecasting');

    expect(await occupancyPage.hasErrorState()).toBe(false);
    expect(await occupancyPage.isStillLoading()).toBe(false);
    await expect(
      occupancyPage.page.locator(occupancyPage.selectors.generateForecastButton)
    ).toBeVisible();
  });

  // Test Case: TC-OC-043
  test('TC-OC-043: generating a forecast completes without an error state @regression', async ({
    occupancyPage,
  }) => {
    await occupancyPage.goto();
    await occupancyPage.switchToTab('Forecasting');

    await occupancyPage.generateForecast();

    expect(await occupancyPage.hasErrorState()).toBe(false);
    expect(await occupancyPage.hasApiErrorText()).toBe(false);
  });
});

test.describe('Occupancy - History', () => {
  // Test Case: TC-OC-044
  test('TC-OC-044: History tab renders the run history without an error state @regression', async ({
    occupancyPage,
  }) => {
    await occupancyPage.goto();
    await occupancyPage.switchToTab('History');

    // A "Failed" status on a past run is legitimate historical data, not a
    // UI error - only a structured error state or a stuck loader fails.
    expect(await occupancyPage.hasErrorState()).toBe(false);
    expect(await occupancyPage.isStillLoading()).toBe(false);
  });
});

test.describe('Occupancy - Scenarios', () => {
  // Test Case: TC-OC-045
  test('TC-OC-045: Scenarios tab loads without an error state @regression', async ({
    occupancyPage,
  }) => {
    await occupancyPage.goto();
    await occupancyPage.switchToTab('Scenarios');
    await occupancyPage.page.waitForTimeout(5000);

    expect(await occupancyPage.hasErrorState()).toBe(false);
    expect(await occupancyPage.hasApiErrorText()).toBe(false);
  });
});
