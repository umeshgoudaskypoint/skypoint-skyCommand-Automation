# Feature: Portfolio Insights

Route: `/insights/portfolio-insights?instanceid=<INSTANCE_ID>`

> All cases below require a working QA login. They stay `Not Automated`
> until credentials are confirmed and the real selectors can be captured.

## TC-PI-001: Portfolio Insights page loads for an authenticated user
- Priority: High
- Section: Page Load
- Type: ui
- Status: Not Automated
- Tags: sanity, regression
- Precondition: User is logged in with a valid instance id
- Steps:
  1. Navigate to the Portfolio Insights page
  2. Wait for the loading indicator to disappear
  3. Verify the page container is displayed
  4. Verify the URL contains portfolio-insights
- Expected: The Portfolio Insights page renders without errors

## TC-PI-002: Page heading is displayed
- Priority: Medium
- Section: Page Load
- Type: ui
- Status: Not Automated
- Tags: regression
- Precondition: User is on the Portfolio Insights page
- Steps:
  1. Navigate to the Portfolio Insights page
  2. Verify the page heading is displayed
- Expected: The heading identifies the page as Portfolio Insights

## TC-PI-003: Report visuals render
- Priority: High
- Section: Reporting
- Type: ui
- Status: Not Automated
- Tags: sanity, regression
- Precondition: User is on the Portfolio Insights page with data available
- Steps:
  1. Navigate to the Portfolio Insights page
  2. Wait for the report to finish loading
  3. Verify at least one visual is rendered
- Expected: Report visuals are displayed with data

## TC-PI-004: No error state is shown on load
- Priority: High
- Section: Page Load
- Type: ui
- Status: Not Automated
- Tags: sanity, regression, negative
- Precondition: User is on the Portfolio Insights page
- Steps:
  1. Navigate to the Portfolio Insights page
  2. Wait for loading to complete
  3. Verify no error message is displayed
- Expected: The page loads cleanly with no error state

## TC-PI-005: Invalid instance id is handled gracefully
- Priority: Medium
- Section: Error Handling
- Type: ui
- Status: Not Automated
- Tags: regression, negative
- Precondition: User is logged in
- Steps:
  1. Navigate to Portfolio Insights with a non-existent instance id
  2. Wait for the page to respond
  3. Verify an error or empty state is displayed
- Expected: A clear message is shown rather than a blank page or crash

## TC-PI-006: Page reload preserves the report
- Priority: Medium
- Section: Page Load
- Type: ui
- Status: Not Automated
- Tags: regression
- Precondition: User is on the Portfolio Insights page
- Steps:
  1. Navigate to the Portfolio Insights page
  2. Reload the page
  3. Verify the report renders again
- Expected: The report reloads correctly after a refresh

## TC-PI-007: Navigating away and back restores the page
- Priority: Low
- Section: Navigation
- Type: ui
- Status: Not Automated
- Tags: regression
- Precondition: User is logged in
- Steps:
  1. Navigate to the Portfolio Insights page
  2. Navigate to another section of the application
  3. Navigate back to Portfolio Insights
  4. Verify the page renders correctly
- Expected: The page loads correctly on return

## TC-PI-008: Page loads within an acceptable time
- Priority: Medium
- Section: Performance
- Type: ui
- Status: Not Automated
- Tags: regression
- Precondition: User is logged in
- Steps:
  1. Start a timer
  2. Navigate to the Portfolio Insights page
  3. Wait for the report to finish loading
  4. Stop the timer and compare against the threshold
- Expected: The page becomes usable within the agreed performance budget
