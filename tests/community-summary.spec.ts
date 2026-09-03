import { test, expect } from '../utils/fixtures';

/**
 * Community Summary module - Westmont tenant.
 *
 * UI-only test cases: rendering and interaction checks, never data-value
 * assertions. Same principles as Portfolio:
 *  - Do NOT validate numbers against Power BI - test that the UI RENDERS.
 *  - A KPI of 0 is a PASS. Only errors, blanks and stuck loaders fail.
 *  - Leave no trace. Edit-mode tests must restore the original state.
 *
 * This module has no data table (unlike Portfolio's Community Scorecard) -
 * its non-KPI widgets are all charts, checked for rendering only, never a
 * plotted value. It also has 4 tabs (Dashboard/Forecasting/History/
 * Scenarios); only Dashboard has real content in this tenant, so the other
 * three intentionally show a "Not Configured" / "No forecast runs yet"
 * empty state - that is a PASS, not a failure. Only a genuine error state
 * or a stuck loader fails a tab.
 */

test.describe('Community Summary - Page Load', () => {
  // Test Case: TC-CS-022
  test('TC-CS-022: Community Summary page renders for the Westmont tenant @sanity @regression', async ({
    communitySummaryPage,
  }) => {
    await communitySummaryPage.goto();

    expect(await communitySummaryPage.isInsightsPageLoaded()).toBe(true);
    await expect(
      communitySummaryPage.page.locator(communitySummaryPage.selectors.pageHeader)
    ).toBeVisible();
  });

  // Test Case: TC-CS-023
  test('TC-CS-023: no error banner or error state on load @sanity @regression @negative', async ({
    communitySummaryPage,
  }) => {
    await communitySummaryPage.goto();

    expect(await communitySummaryPage.hasErrorState()).toBe(false);
  });

  // Test Case: TC-CS-024
  test('TC-CS-024: no loading spinner remains stuck after load @regression', async ({
    communitySummaryPage,
  }) => {
    await communitySummaryPage.goto();
    await communitySummaryPage.page.waitForTimeout(3000);

    expect(await communitySummaryPage.isStillLoading()).toBe(false);
  });
});

test.describe('Community Summary - KPI Cards', () => {
  // Test Case: TC-CS-025
  test('TC-CS-025: all KPI cards render with a value (0 is valid) @sanity @regression', async ({
    communitySummaryPage,
  }) => {
    await communitySummaryPage.goto();

    const cards = await communitySummaryPage.getKpiCards();
    expect(cards.length, 'no KPI cards rendered').toBeGreaterThan(0);

    for (const card of cards) {
      expect(card.hasError, `KPI card "${card.title}" shows an error`).toBe(false);
      expect(card.value, `KPI card "${card.title}" has no value`).not.toBe('');
      expect(
        communitySummaryPage.isValidKpiValue(card.value),
        `KPI card "${card.title}" has a malformed value: "${card.value}"`
      ).toBe(true);
    }
  });
});

test.describe('Community Summary - Chart Widgets', () => {
  // Test Case: TC-CS-026
  test('TC-CS-026: all chart widgets render without an error or blank state @sanity @regression', async ({
    communitySummaryPage,
  }) => {
    await communitySummaryPage.goto();

    const charts = await communitySummaryPage.getChartWidgets();
    expect(charts.length, 'no chart widgets rendered').toBeGreaterThan(0);

    for (const chart of charts) {
      expect(chart.hasError, `chart "${chart.title}" shows an error`).toBe(false);
      // Rendered = has an <svg> (the chart itself), or at least more
      // content than just the title (e.g. a legitimate "no data" state).
      const hasContent = chart.hasChart || chart.text.length > chart.title.length + 5;
      expect(hasContent, `chart "${chart.title}" appears blank`).toBe(true);
    }
  });
});

test.describe('Community Summary - Filters', () => {
  // Test Case: TC-CS-027
  test('TC-CS-027: Quick Month filter updates the dashboard without error @sanity @regression', async ({
    communitySummaryPage,
  }) => {
    await communitySummaryPage.goto();

    await communitySummaryPage.changeQuickMonth();
    await communitySummaryPage.waitForInsightsLoad();

    expect(await communitySummaryPage.hasErrorState()).toBe(false);
    expect((await communitySummaryPage.getFailingKpiCards()).length).toBe(0);
  });

  // Test Case: TC-CS-028
  test('TC-CS-028: Date Range filter updates the dashboard without error @sanity @regression', async ({
    communitySummaryPage,
  }) => {
    await communitySummaryPage.goto();

    await communitySummaryPage.changeDateRange();
    await communitySummaryPage.waitForInsightsLoad();

    expect(await communitySummaryPage.hasErrorState()).toBe(false);
    expect((await communitySummaryPage.getFailingKpiCards()).length).toBe(0);
  });

  // Test Case: TC-CS-029
  test('TC-CS-029: Community dropdown is populated and filtering updates the dashboard without error @sanity @regression', async ({
    communitySummaryPage,
  }) => {
    await communitySummaryPage.goto();

    const options = await communitySummaryPage.getCommunityOptions();
    expect(options.length, 'community dropdown is empty').toBeGreaterThan(0);

    await communitySummaryPage.selectDifferentCommunity();
    await communitySummaryPage.waitForInsightsLoad();

    expect(await communitySummaryPage.hasErrorState()).toBe(false);
    expect((await communitySummaryPage.getFailingKpiCards()).length).toBe(0);
  });
});

test.describe('Community Summary - Tabs', () => {
  // Test Case: TC-CS-030
  test('TC-CS-030: Dashboard/Forecasting/History/Scenarios tabs switch without error @regression', async ({
    communitySummaryPage,
  }) => {
    await communitySummaryPage.goto();

    const tabNames = await communitySummaryPage.getTabNames();
    expect(tabNames.length, 'no tabs found').toBeGreaterThan(0);

    for (const name of tabNames) {
      await communitySummaryPage.switchToTab(name);

      const hasError = await communitySummaryPage.hasErrorState();
      const stillLoading = await communitySummaryPage.isStillLoading();
      const unconfigured = await communitySummaryPage.isTabUnconfigured();

      // An intentional "Not Configured" / "No forecast runs yet" empty
      // state is a PASS - only a genuine error or a stuck loader fails.
      expect(hasError, `"${name}" tab shows an error state`).toBe(false);
      expect(stillLoading, `"${name}" tab is stuck loading`).toBe(false);
      void unconfigured; // documents intent: not asserted on, never a failure condition
    }
  });
});

test.describe('Community Summary - Edit Mode', () => {
  // These tests must leave the page exactly as they found it.

  // Test Case: TC-CS-031
  test('TC-CS-031: edit mode opens and closes cleanly, layout unchanged @sanity @regression', async ({
    communitySummaryPage,
  }) => {
    await communitySummaryPage.goto();

    const before = await communitySummaryPage.captureLayoutSnapshot();

    await communitySummaryPage.enterEditMode();
    expect(await communitySummaryPage.isInEditMode()).toBe(true);

    await communitySummaryPage.exitEditModeWithoutSaving();
    expect(await communitySummaryPage.isInEditMode()).toBe(false);
    await communitySummaryPage.waitForInsightsLoad();

    const after = await communitySummaryPage.captureLayoutSnapshot();
    expect(after, 'layout changed after entering and leaving edit mode').toEqual(before);
  });
});

test.describe('Community Summary - AI Briefing', () => {
  // Briefings are LLM calls - they need far longer than a normal test.
  test.setTimeout(420000);

  // Test Case: TC-CS-032
  test('TC-CS-032: standard AI briefing generates @sanity @regression', async ({
    communitySummaryPage,
  }) => {
    await communitySummaryPage.goto();

    await communitySummaryPage.openAiBriefing();
    await communitySummaryPage.generateStandardBriefing();

    const text = await communitySummaryPage.getBriefingText();
    expect(text.length, 'briefing is empty').toBeGreaterThan(0);
  });

  // Test Case: TC-CS-033
  test('TC-CS-033: custom AI briefing generates @sanity @regression', async ({
    communitySummaryPage,
  }) => {
    await communitySummaryPage.goto();

    await communitySummaryPage.openAiBriefing();
    await communitySummaryPage.generateCustomBriefing();

    const text = await communitySummaryPage.getBriefingText();
    expect(text.length, 'custom briefing is empty').toBeGreaterThan(0);
  });

  // Test Case: TC-CS-034
  test('TC-CS-034: briefing does not show an error state @regression @negative', async ({
    communitySummaryPage,
  }) => {
    await communitySummaryPage.goto();

    await communitySummaryPage.openAiBriefing();
    await communitySummaryPage.generateStandardBriefing();

    expect(await communitySummaryPage.briefingHasError()).toBe(false);
  });
});
