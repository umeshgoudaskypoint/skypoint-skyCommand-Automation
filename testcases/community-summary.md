# Feature: Community Summary

Route: `/insights/community-summary?instanceid=<INSTANCE_ID>`
Tenant under test: **Westmont**

IDs continue the sequence after Portfolio (`TC-PI-001`..`TC-PI-021`) rather
than restarting at 1, so a test id is unique across the whole suite.

## Testing principles for this module

1. **Do not validate data against Power BI.** The app fetches its numbers from
   PBI via API. We are testing *rendering*, not data correctness.
2. **`0` is a pass.** A KPI card showing `0` means PBI has no value for that
   metric. Only an error, a blank card, or a stuck loader is a failure.
3. **No data table here.** Unlike Portfolio's Community Scorecard, every
   non-KPI widget on this dashboard is a chart. A chart is checked for
   rendering only (an `<svg>` and no error text) - never a plotted value.
4. **Unconfigured tabs are a pass, not a failure.** Forecasting, History and
   Scenarios legitimately show a "Not Configured" / "No forecast runs yet"
   empty state in this tenant. That is expected UI, not a defect. A tab only
   fails on a genuine error state or a stuck loader - if forecasting is later
   configured for this tenant, the same test should then expect real content
   to render instead, not the empty state.
5. **Leave no trace.** Edit-mode tests must restore the original state and
   never click Save.
6. **AI briefing tests check that a briefing generates, not that its
   figures match on-screen data.** This module's non-KPI widgets are charts,
   whose data points never render as text in the DOM - only axis gridlines
   and month labels do - so there is nothing reliable to compare a quoted
   figure against. See Portfolio's retired TC-PI-017 for the full rationale.

---

## Section: Page Load

## TC-CS-022: Community Summary page renders for the Westmont tenant
- Priority: Critical
- Section: Page Load
- Type: ui
- Status: Automated
- Tags: sanity, regression
- Precondition: User is logged in to the Westmont tenant
- Steps:
  1. Navigate to the Community Summary page for the Westmont instance
  2. Wait for the loading indicator to disappear
  3. Verify the page container is displayed
  4. Verify the page heading is displayed
- Expected: The Community Summary page renders completely with no error state

## TC-CS-023: No error banner or error state on load
- Priority: High
- Section: Page Load
- Type: ui
- Status: Automated
- Tags: sanity, regression, negative
- Precondition: User is on the Community Summary page
- Steps:
  1. Navigate to the Community Summary page
  2. Wait for loading to complete
  3. Verify no error banner is displayed
- Expected: The page is free of error states

## TC-CS-024: No loading spinner remains stuck after load
- Priority: Medium
- Section: Page Load
- Type: ui
- Status: Automated
- Tags: regression
- Precondition: User is on the Community Summary page
- Steps:
  1. Navigate to the Community Summary page
  2. Wait for the page to settle
  3. Verify no loading indicator is still visible
- Expected: All loaders resolve within the timeout

---

## Section: KPI Cards

## TC-CS-025: All KPI cards render with a value
- Priority: Critical
- Section: KPI Cards
- Type: ui
- Status: Automated
- Tags: sanity, regression
- Precondition: User is on the Community Summary page
- Steps:
  1. Navigate to the Community Summary page
  2. Wait for the KPI cards (Occupancy Rate, Unit Capacity, Units Occupied,
     Vacancy Rate) to finish loading
  3. For each KPI card verify a well-formed value is present
  4. Verify no card shows an error
  5. For any card reading 0, check the previous 3 months via the Quick
     Month filter; if the card also reads 0 in every one of those months,
     fail - a metric stuck at 0 for a month or more looks broken, not
     legitimately empty. Restore the original month before finishing
- Expected: Every KPI card shows a value. A single 0 is acceptable, but not
  one that persists across the current period and the last 3 months

---

## Section: Chart Widgets

## TC-CS-026: All chart widgets render without an error or blank state
- Priority: High
- Section: Chart Widgets
- Type: ui
- Status: Automated
- Tags: sanity, regression
- Precondition: User is on the Community Summary page
- Steps:
  1. Navigate to the Community Summary page
  2. Wait for the chart widgets (Occupancy % Last 30 Days, Actuals and
     Expenses, Net Income, Labor Expenses, Avg Acuity, % High Risk
     Incidents) to finish loading
  3. For each chart widget verify it shows a rendered chart (or other
     non-trivial content) and no error text
- Expected: Every chart widget renders. No plotted value is checked

---

## Section: Filters

## TC-CS-027: Quick Month filter updates the dashboard without error
- Priority: High
- Section: Filters
- Type: ui
- Status: Automated
- Tags: sanity, regression
- Precondition: User is on the Community Summary page
- Steps:
  1. Navigate to the Community Summary page
  2. Change the quick month to a different value
  3. Wait for the page to reload its data
  4. Verify no error state and no failing KPI cards
- Expected: The page reloads for the new month with no errors

## TC-CS-028: Date Range filter updates the dashboard without error
- Priority: High
- Section: Filters
- Type: ui
- Status: Automated
- Tags: sanity, regression
- Precondition: User is on the Community Summary page
- Steps:
  1. Navigate to the Community Summary page
  2. Open the date range picker via "Custom range" and select a different day
  3. Wait for the page to reload its data
  4. Verify no error state and no failing KPI cards
- Expected: The page reloads for the new range with no errors

## TC-CS-029: Community dropdown is populated and filtering updates the dashboard without error
- Priority: High
- Section: Filters
- Type: ui
- Status: Automated
- Tags: sanity, regression
- Precondition: User is on the Community Summary page for the Westmont tenant
- Steps:
  1. Navigate to the Community Summary page
  2. Open the community dropdown and verify it lists options
  3. Select a different community
  4. Wait for the page to reload its data
  5. Verify no error state and no failing KPI cards
- Expected: The dropdown is populated and the page reloads for the
  selected community with no errors

---

## Section: Tabs

## TC-CS-030: Dashboard/Forecasting/History/Scenarios tabs switch without error
- Priority: Medium
- Section: Tabs
- Type: ui
- Status: Automated
- Tags: regression
- Precondition: User is on the Community Summary page
- Steps:
  1. Navigate to the Community Summary page
  2. Read the list of tabs
  3. Click each tab in turn
  4. For each tab verify no error state and no stuck loader
- Expected: Every tab switches cleanly. A "Not Configured" / "No forecast
  runs yet" empty state on Forecasting, History or Scenarios is a PASS -
  only a genuine error or a stuck loader fails a tab

---

## Section: Edit Mode

> These tests must leave the page exactly as they found it.

## TC-CS-031: Edit mode opens and closes cleanly, layout unchanged
- Priority: High
- Section: Edit
- Type: ui
- Status: Automated
- Tags: sanity, regression
- Precondition: User is on the Community Summary page
- Steps:
  1. Navigate to the Community Summary page
  2. Record the current KPI card order and values
  3. Enter edit mode and verify it is active
  4. Exit edit mode without saving
  5. Compare the KPI card order and values against the recorded state
- Expected: Edit mode opens and closes cleanly and the layout is identical
  to before the test ran

---

## Section: AI Briefing

## TC-CS-032: Standard AI briefing generates
- Priority: High
- Section: AI Briefing
- Type: ui
- Status: Automated
- Tags: sanity, regression
- Precondition: User is on the Community Summary page
- Steps:
  1. Navigate to the Community Summary page
  2. Open the AI briefing
  3. Select the standard briefing and generate it
  4. Wait for the briefing to finish generating
  5. Verify briefing content is displayed
- Expected: A standard briefing is produced with no error

## TC-CS-033: Custom AI briefing generates
- Priority: High
- Section: AI Briefing
- Type: ui
- Status: Automated
- Tags: sanity, regression
- Precondition: User is on the Community Summary page
- Steps:
  1. Navigate to the Community Summary page
  2. Open the AI briefing
  3. Select the custom briefing
  4. Provide the custom input the form requires
  5. Wait for the briefing to finish generating
  6. Verify briefing content is displayed
- Expected: A custom briefing is produced with no error

## TC-CS-034: Briefing does not show an error state
- Priority: Medium
- Section: AI Briefing
- Type: ui
- Status: Automated
- Tags: regression, negative
- Precondition: User is on the Community Summary page
- Steps:
  1. Navigate to the Community Summary page
  2. Open the AI briefing
  3. Generate a briefing
  4. Verify no error message is displayed
- Expected: The briefing completes successfully with content
