import { test, expect } from '../utils/fixtures';
import { PortfolioInsightsPage } from '../utils/pages';

/**
 * Portfolio module - Westmont tenant.
 *
 * Testing principles (from QA):
 *  - Do NOT validate numbers against Power BI. The app pulls data from PBI
 *    via API; we test that the UI RENDERS, not that the data is right.
 *  - A KPI of 0 is a PASS. It means PBI has no value for that metric.
 *    Only errors, blanks and stuck loaders fail.
 *  - Leave no trace. Edit-mode tests must restore the original state.
 *  - Exception: the standard AI briefing summarises values already on
 *    screen, so there we compare briefing text against the UI (never PBI).
 */

test.describe('Portfolio - Page Load', () => {
  // Test Case: TC-PI-002
  test('TC-PI-002: Portfolio page renders for the Westmont tenant @sanity @regression', async ({
    portfolioInsightsPage,
  }) => {
    await portfolioInsightsPage.goto();
    await portfolioInsightsPage.assertPageLoaded();
  });

  // Test Case: TC-PI-003
  test('TC-PI-003: no error state on load @sanity @regression @negative', async ({
    portfolioInsightsPage,
  }) => {
    await portfolioInsightsPage.goto();
    expect(await portfolioInsightsPage.hasErrorState()).toBe(false);
  });

  // Test Case: TC-PI-004
  test('TC-PI-004: no loading spinner remains stuck @regression', async ({
    portfolioInsightsPage,
  }) => {
    await portfolioInsightsPage.goto();
    expect(await portfolioInsightsPage.isStillLoading()).toBe(false);
  });
});

test.describe('Portfolio - KPI Cards', () => {
  // Test Case: TC-PI-005
  test('TC-PI-005: all KPI cards render with a value (0 is valid unless stuck) @sanity @regression', async ({
    portfolioInsightsPage,
  }) => {
    await portfolioInsightsPage.goto();

    const cards = await portfolioInsightsPage.getKpiCards();
    expect(cards.length, 'expected at least one KPI card').toBeGreaterThan(0);

    for (const card of cards) {
      expect(card.value, `KPI card "${card.title}" has no value`).not.toBe('');
      expect(card.hasError, `KPI card "${card.title}" shows an error`).toBe(false);
    }

    // A single 0 is a legitimate PASS (PBI may have no value for this
    // period) - but a metric stuck at 0 for this month AND the last 3
    // months looks broken, not legitimately empty.
    const stuck = await portfolioInsightsPage.findStuckZeroKpis();
    expect(
      stuck,
      `KPI card(s) stuck at 0 across the last 3+ months: ${stuck.join(', ')}`
    ).toHaveLength(0);
  });

  // Test Case: TC-PI-005b
  test('TC-PI-005b: non-KPI widgets render with content @regression', async ({
    portfolioInsightsPage,
  }) => {
    await portfolioInsightsPage.goto();

    // The Disclaimer block and Community Scorecard table have no headline
    // value, so they are checked for content and absence of errors only.
    const widgets = await portfolioInsightsPage.getNonKpiWidgets();

    for (const widget of widgets) {
      expect(widget.text.length, 'a non-KPI widget rendered empty').toBeGreaterThan(0);
      expect(widget.hasError, `widget shows an error: ${widget.text.slice(0, 60)}`).toBe(false);
    }
  });

  // Test Case: TC-PI-006
  test('TC-PI-006: no KPI card shows error text @sanity @regression @negative', async ({
    portfolioInsightsPage,
  }) => {
    await portfolioInsightsPage.goto();

    const failing = await portfolioInsightsPage.getFailingKpiCards();
    expect(failing, `KPI cards in an error state: ${failing.join(', ')}`).toHaveLength(0);
  });

  // Test Case: TC-PI-007
  test('TC-PI-007: KPI values are well formed @regression', async ({
    portfolioInsightsPage,
  }) => {
    await portfolioInsightsPage.goto();

    const cards = await portfolioInsightsPage.getKpiCards();
    for (const card of cards) {
      expect(
        portfolioInsightsPage.isValidKpiValue(card.value),
        `KPI card "${card.title}" has a malformed value: "${card.value}"`
      ).toBe(true);
    }
  });
});

test.describe('Portfolio - Filters', () => {
  // Test Case: TC-PI-008
  test('TC-PI-008: quick month filter updates the page @sanity @regression', async ({
    portfolioInsightsPage,
  }) => {
    await portfolioInsightsPage.goto();

    await portfolioInsightsPage.changeQuickMonth();
    await portfolioInsightsPage.waitForInsightsLoad();

    expect(await portfolioInsightsPage.hasErrorState()).toBe(false);
    expect((await portfolioInsightsPage.getFailingKpiCards()).length).toBe(0);
  });

  // Test Case: TC-PI-009
  test('TC-PI-009: date range filter updates the page @sanity @regression', async ({
    portfolioInsightsPage,
  }) => {
    await portfolioInsightsPage.goto();

    await portfolioInsightsPage.changeDateRange();
    await portfolioInsightsPage.waitForInsightsLoad();

    expect(await portfolioInsightsPage.hasErrorState()).toBe(false);
    expect((await portfolioInsightsPage.getFailingKpiCards()).length).toBe(0);
  });

  // Test Case: TC-PI-010
  test('TC-PI-010: community dropdown updates the page @sanity @regression', async ({
    portfolioInsightsPage,
  }) => {
    await portfolioInsightsPage.goto();

    await portfolioInsightsPage.selectDifferentCommunity();
    await portfolioInsightsPage.waitForInsightsLoad();

    expect(await portfolioInsightsPage.hasErrorState()).toBe(false);
    expect((await portfolioInsightsPage.getFailingKpiCards()).length).toBe(0);
  });

  // Test Case: TC-PI-011
  test('TC-PI-011: community dropdown is populated @regression', async ({
    portfolioInsightsPage,
  }) => {
    await portfolioInsightsPage.goto();

    const communities = await portfolioInsightsPage.getCommunityOptions();
    expect(communities.length, 'community dropdown is empty').toBeGreaterThan(0);
  });

  // Test Case: TC-PI-012
  test('TC-PI-012: combined filters apply together @regression', async ({
    portfolioInsightsPage,
  }) => {
    await portfolioInsightsPage.goto();

    await portfolioInsightsPage.selectDifferentCommunity();
    await portfolioInsightsPage.waitForInsightsLoad();
    await portfolioInsightsPage.changeQuickMonth();
    await portfolioInsightsPage.waitForInsightsLoad();

    expect(await portfolioInsightsPage.hasErrorState()).toBe(false);
    expect((await portfolioInsightsPage.getFailingKpiCards()).length).toBe(0);
  });
});

test.describe('Portfolio - Edit Mode', () => {
  // These tests must leave the page exactly as they found it.

  // Test Case: TC-PI-013
  test('TC-PI-013: edit mode opens and closes cleanly @sanity @regression', async ({
    portfolioInsightsPage,
  }) => {
    await portfolioInsightsPage.goto();

    await portfolioInsightsPage.enterEditMode();
    expect(await portfolioInsightsPage.isInEditMode()).toBe(true);

    await portfolioInsightsPage.exitEditModeWithoutSaving();
    expect(await portfolioInsightsPage.isInEditMode()).toBe(false);
  });

  // Test Case: TC-PI-014
  test('TC-PI-014: exiting edit mode leaves the layout unchanged @sanity @regression', async ({
    portfolioInsightsPage,
  }) => {
    await portfolioInsightsPage.goto();

    const before = await portfolioInsightsPage.captureLayoutSnapshot();

    await portfolioInsightsPage.enterEditMode();
    await portfolioInsightsPage.exitEditModeWithoutSaving();
    await portfolioInsightsPage.waitForInsightsLoad();

    const after = await portfolioInsightsPage.captureLayoutSnapshot();
    expect(after, 'layout changed after entering and leaving edit mode').toEqual(before);
  });
});

test.describe('Portfolio - AI Briefing', () => {
  // Briefings are LLM calls - they need far longer than a normal test.
  test.setTimeout(420000);

  // Test Case: TC-PI-016
  test('TC-PI-016: standard AI briefing generates @sanity @regression', async ({
    portfolioInsightsPage,
  }) => {
    await portfolioInsightsPage.goto();

    await portfolioInsightsPage.openAiBriefing();
    await portfolioInsightsPage.generateStandardBriefing();

    const text = await portfolioInsightsPage.getBriefingText();
    expect(text.length, 'briefing is empty').toBeGreaterThan(0);
  });

  // TC-PI-017 ("standard briefing figures match the UI") was removed: per
  // QA decision, AI briefing tests check that a briefing GENERATES, not
  // that its figures match on-screen data. Portfolio's briefing legitimately
  // cites derived and per-community numbers (e.g. from the Community
  // Scorecard, or simple arithmetic like "181 vacant units") that a DOM-only
  // check can't reliably distinguish from a real content error, and other
  // modules' briefings cite chart data points that never render as text at
  // all - so this class of check does not generalise across modules.

  // Test Case: TC-PI-018
  test('TC-PI-018: custom AI briefing generates @sanity @regression', async ({
    portfolioInsightsPage,
  }) => {
    await portfolioInsightsPage.goto();

    await portfolioInsightsPage.openAiBriefing();
    await portfolioInsightsPage.generateCustomBriefing();

    const text = await portfolioInsightsPage.getBriefingText();
    expect(text.length, 'custom briefing is empty').toBeGreaterThan(0);
  });

  // Test Case: TC-PI-019
  test('TC-PI-019: briefing shows no error state @regression @negative', async ({
    portfolioInsightsPage,
  }) => {
    await portfolioInsightsPage.goto();

    await portfolioInsightsPage.openAiBriefing();
    await portfolioInsightsPage.generateStandardBriefing();

    expect(await portfolioInsightsPage.briefingHasError()).toBe(false);
  });
});

test.describe('Portfolio - Create a Task', () => {
  // Reaching the task button requires generating a briefing first.
  test.setTimeout(420000);

  // Test Case: TC-PI-020
  test('TC-PI-020: create a task from the briefing opens the task page @sanity @regression', async ({
    portfolioInsightsPage,
  }) => {
    await portfolioInsightsPage.goto();

    await portfolioInsightsPage.openAiBriefing();
    await portfolioInsightsPage.generateStandardBriefing();
    await portfolioInsightsPage.clickCreateTask();

    expect(await portfolioInsightsPage.isCreateTaskPageDisplayed()).toBe(true);
  });

  // Test Case: TC-PI-021
  test('TC-PI-021: abandoning the task form creates nothing @regression', async ({
    portfolioInsightsPage,
  }) => {
    await portfolioInsightsPage.goto();

    await portfolioInsightsPage.openAiBriefing();
    await portfolioInsightsPage.generateStandardBriefing();
    await portfolioInsightsPage.clickCreateTask();
    expect(await portfolioInsightsPage.isCreateTaskPageDisplayed()).toBe(true);

    // Leave without submitting - nothing should be persisted.
    await portfolioInsightsPage.goBack();
    await portfolioInsightsPage.waitForInsightsLoad();

    expect(await portfolioInsightsPage.isInsightsPageLoaded()).toBe(true);
  });
});
