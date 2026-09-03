# Feature: Occupancy

Route: `/insights/occupancy?instanceid=<INSTANCE_ID>`
Tenant under test: **Westmont**

IDs continue the sequence after Community Summary (`TC-CS-022`..`TC-CS-034`)
rather than restarting at 1, so a test id is unique across the whole suite.

## Testing principles for this module

1. **Do not validate data against Power BI.** The app fetches its numbers from
   PBI via API. We are testing *rendering*, not data correctness.
2. **A single `0` is a pass, but a metric stuck at `0` is not.** A KPI card
   showing `0` for the current period is fine (PBI may have no value for it).
   A KPI still showing `0` after checking the previous 3 months too is
   treated as a broken metric, not legitimately empty data - see
   `findStuckZeroKpis()`. Applies to every module with KPI cards, not just
   this one.
3. **No data table here.** Every non-KPI widget on this dashboard is a
   chart, checked for rendering only (an `<svg>` and no error text) - never
   a plotted value.
4. **Forecasting/History/Scenarios are REAL features on this module,
   unlike Community Summary.** Confirmed live before writing these cases:
   Forecasting has a working configuration form, History already contains a
   genuinely failed past run, and Scenarios currently reproduces a live
   backend error. A "Failed" status in the History table is legitimate
   historical data, not a UI defect - do not fail a test on that word
   appearing. A raw API error surfacing as page text IS a real defect and
   must fail the test, not be filtered out to make the suite green.
5. **Leave no trace.** Edit-mode and KPI-zero-check tests must restore the
   original state (layout, selected month) before finishing.

## Known defect surfaced by this suite

TC-OC-043 and TC-OC-045 currently fail against the live app with the same
root cause: generating an occupancy forecast returns a Power BI 400 -
`DatasetExecuteQueriesError` - because the underlying DAX query references
the `Community` column without an aggregation when "All Communities" is
selected ("A single value for column 'Community' ... cannot be
determined"). Scenarios reproduces the same error because it auto-triggers
a baseline forecast on load. This is a genuine backend/model defect, not a
test issue - the tests are deliberately left failing until it's fixed
rather than adjusted to pass around it.

---

## Section: Page Load

## TC-OC-035: Occupancy page renders for the Westmont tenant
- Priority: Critical
- Section: Page Load
- Type: ui
- Status: Automated
- Tags: sanity, regression
- Precondition: User is logged in to the Westmont tenant
- Steps:
  1. Navigate to the Occupancy page for the Westmont instance
  2. Wait for the loading indicator to disappear
  3. Verify the page container is displayed
  4. Verify the page heading is displayed
- Expected: The Occupancy page renders completely with no error state

## TC-OC-036: No error banner or error state on load
- Priority: High
- Section: Page Load
- Type: ui
- Status: Automated
- Tags: sanity, regression, negative
- Precondition: User is on the Occupancy page
- Steps:
  1. Navigate to the Occupancy page
  2. Wait for loading to complete
  3. Verify no error banner is displayed
- Expected: The page is free of error states

## TC-OC-037: No loading spinner remains stuck after load
- Priority: Medium
- Section: Page Load
- Type: ui
- Status: Automated
- Tags: regression
- Precondition: User is on the Occupancy page
- Steps:
  1. Navigate to the Occupancy page
  2. Wait for the page to settle
  3. Verify no loading indicator is still visible
- Expected: All loaders resolve within the timeout

---

## Section: KPI Cards

## TC-OC-038: All KPI cards render with a value
- Priority: Critical
- Section: KPI Cards
- Type: ui
- Status: Automated
- Tags: sanity, regression
- Precondition: User is on the Occupancy page
- Steps:
  1. Navigate to the Occupancy page
  2. Wait for the KPI cards (Total Occupied, Occupancy Rate, Total Units,
     Vacancy Rate) to finish loading
  3. For each KPI card verify a well-formed value is present
  4. Verify no card shows an error
  5. For any card reading 0, check the previous 3 months via the Quick
     Month filter; if the card also reads 0 in every one of those months,
     fail. Restore the original month before finishing
- Expected: Every KPI card shows a value. A single 0 is acceptable, but not
  one that persists across the current period and the last 3 months

---

## Section: Chart Widgets

## TC-OC-039: All chart widgets render without an error or blank state
- Priority: High
- Section: Chart Widgets
- Type: ui
- Status: Automated
- Tags: sanity, regression
- Precondition: User is on the Occupancy page
- Steps:
  1. Navigate to the Occupancy page
  2. Wait for the chart widgets (Total Occupancy Overview, Units by
     Community, Move-In / Move-Out Trends, Primary Occupancy by Product
     Type) to finish loading
  3. For each chart widget verify it shows a rendered chart (or other
     non-trivial content) and no error text
- Expected: Every chart widget renders. No plotted value is checked

---

## Section: Filters

## TC-OC-040: Quick Month / Date Range / Community filters update the dashboard without error
- Priority: High
- Section: Filters
- Type: ui
- Status: Automated
- Tags: sanity, regression
- Precondition: User is on the Occupancy page
- Steps:
  1. Navigate to the Occupancy page
  2. Change the quick month; verify no error state and no failing KPI cards
  3. Change the date range via "Custom range"; verify the same
  4. Open the community dropdown, verify it lists options, select a
     different community; verify the same
- Expected: The dashboard reloads for each filter change with no errors

---

## Section: Edit Mode

> These tests must leave the page exactly as they found it.

## TC-OC-041: Edit mode opens and closes cleanly, layout unchanged
- Priority: High
- Section: Edit
- Type: ui
- Status: Automated
- Tags: sanity, regression
- Precondition: User is on the Occupancy page
- Steps:
  1. Navigate to the Occupancy page
  2. Record the current KPI card order and values
  3. Enter edit mode and verify it is active
  4. Exit edit mode without saving
  5. Compare the KPI card order and values against the recorded state
- Expected: Edit mode opens and closes cleanly and the layout is identical
  to before the test ran

---

## Section: Forecasting

## TC-OC-042: Forecasting tab renders its configuration form without error
- Priority: High
- Section: Forecasting
- Type: ui
- Status: Automated
- Tags: sanity, regression
- Precondition: User is on the Occupancy page
- Steps:
  1. Navigate to the Occupancy page and switch to the Forecasting tab
  2. Verify no error state and no stuck loader
  3. Verify the Generate Forecast button is visible
- Expected: The Forecasting configuration form renders correctly

## TC-OC-043: Generating a forecast completes without an error state
- Priority: Medium
- Section: Forecasting
- Type: ui
- Status: Automated
- Tags: regression
- Precondition: User is on the Occupancy page, Forecasting tab
- Steps:
  1. Click Generate Forecast
  2. Wait for the run to settle (success or error)
  3. Verify no structured error state and no raw "API error" text
- Expected: The forecast generates without error
- **Currently failing** - see "Known defect" above (Power BI 400,
  DatasetExecuteQueriesError on the Community column)

---

## Section: History

## TC-OC-044: History tab renders the run history without an error state
- Priority: Medium
- Section: History
- Type: ui
- Status: Automated
- Tags: regression
- Precondition: User is on the Occupancy page
- Steps:
  1. Navigate to the Occupancy page and switch to the History tab
  2. Verify no structured error state and no stuck loader
- Expected: The run history renders. A "Failed" status on a past run is
  valid historical data and must NOT be treated as a test failure

---

## Section: Scenarios

## TC-OC-045: Scenarios tab loads without an error state
- Priority: Medium
- Section: Scenarios
- Type: ui
- Status: Automated
- Tags: regression
- Precondition: User is on the Occupancy page
- Steps:
  1. Navigate to the Occupancy page and switch to the Scenarios tab
  2. Verify no structured error state and no raw "API error" text
- Expected: The scenario planner loads without error
- **Currently failing** - see "Known defect" above (Scenarios auto-triggers
  a baseline forecast, which hits the same Power BI 400)
