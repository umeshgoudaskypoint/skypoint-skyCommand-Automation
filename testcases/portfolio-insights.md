# Feature: Portfolio

Route: `/insights/portfolio-insights?instanceid=<INSTANCE_ID>`
Tenant under test: **Westmont**

## Testing principles for this module

1. **Do not validate data against Power BI.** The app fetches its numbers from
   PBI via API. We are testing *rendering*, not data correctness.
2. **`0` is a pass.** A KPI card showing `0` means PBI has no value for that
   metric. Only an error, a blank card, or a stuck loader is a failure.
3. **Leave no trace.** Edit-mode tests must restore the original state before
   they finish. No test may persist a change.
4. The one exception to principle 1 is the **standard AI briefing**, which
   summarises values already on screen — there we compare briefing text against
   the UI, never against PBI.

---

## Section: Page Load

## TC-PI-001: User logs in successfully with valid credentials
- Priority: High
- Section: Login
- Type: ui
- Status: Not Automated
- Tags: sanity, regression
- Precondition: Valid QA credentials for the Westmont tenant
- Steps:
  1. Navigate to the application
  2. Complete the sign-in flow with valid credentials
  3. Verify the application loads in an authenticated state
- Expected: User is signed in and lands in the application

## TC-PI-002: Portfolio page renders for the Westmont tenant
- Priority: High
- Section: Page Load
- Type: ui
- Status: Not Automated
- Tags: sanity, regression
- Precondition: User is logged in to the Westmont tenant
- Steps:
  1. Navigate to the Portfolio page for the Westmont instance
  2. Wait for the loading indicator to disappear
  3. Verify the page container is displayed
  4. Verify the page heading is displayed
- Expected: The Portfolio page renders completely with no error state

## TC-PI-003: No error banner or error state on load
- Priority: High
- Section: Page Load
- Type: ui
- Status: Not Automated
- Tags: sanity, regression, negative
- Precondition: User is on the Portfolio page
- Steps:
  1. Navigate to the Portfolio page
  2. Wait for loading to complete
  3. Verify no error banner is displayed
  4. Verify no failed-to-load message is displayed
- Expected: The page is free of error states

## TC-PI-004: No loading spinner remains stuck after load
- Priority: Medium
- Section: Page Load
- Type: ui
- Status: Not Automated
- Tags: regression
- Precondition: User is on the Portfolio page
- Steps:
  1. Navigate to the Portfolio page
  2. Wait for the page to settle
  3. Verify no loading indicator is still visible
- Expected: All loaders resolve within the timeout

---

## Section: KPI Cards

## TC-PI-005: All KPI cards render with a value
- Priority: High
- Section: KPI Cards
- Type: ui
- Status: Not Automated
- Tags: sanity, regression
- Precondition: User is on the Portfolio page
- Steps:
  1. Navigate to the Portfolio page
  2. Wait for the KPI cards to finish loading
  3. Verify at least one KPI card is displayed
  4. For each KPI card verify a value is present
  5. Verify no card shows an error or dash placeholder
- Expected: Every KPI card shows a value. A value of 0 is acceptable

## TC-PI-006: KPI cards show no error text
- Priority: High
- Section: KPI Cards
- Type: ui
- Status: Not Automated
- Tags: sanity, regression, negative
- Precondition: User is on the Portfolio page
- Steps:
  1. Navigate to the Portfolio page
  2. Wait for the KPI cards to load
  3. For each card verify it does not contain error text
  4. Verify no card is stuck in a loading state
- Expected: No KPI card displays an error or remains loading

## TC-PI-007: KPI card values are numeric or a valid placeholder
- Priority: Medium
- Section: KPI Cards
- Type: ui
- Status: Not Automated
- Tags: regression
- Precondition: User is on the Portfolio page
- Steps:
  1. Navigate to the Portfolio page
  2. Read the value from each KPI card
  3. Verify each value is a number, percentage, or currency amount
- Expected: Values are well formed. Zero is valid, error text is not

---

## Section: Filters

## TC-PI-008: Quick month filter updates the page
- Priority: High
- Section: Filters
- Type: ui
- Status: Not Automated
- Tags: sanity, regression
- Precondition: User is on the Portfolio page
- Steps:
  1. Navigate to the Portfolio page
  2. Note the current quick month selection
  3. Change the quick month to a different value
  4. Wait for the page to reload its data
  5. Verify the KPI cards still render without errors
- Expected: The page reloads for the new month with no errors

## TC-PI-009: Date range filter updates the page
- Priority: High
- Section: Filters
- Type: ui
- Status: Not Automated
- Tags: sanity, regression
- Precondition: User is on the Portfolio page
- Steps:
  1. Navigate to the Portfolio page
  2. Open the date range picker
  3. Select a different date range
  4. Apply the selection
  5. Wait for the page to reload its data
  6. Verify the KPI cards still render without errors
- Expected: The page reloads for the new range with no errors

## TC-PI-010: Community dropdown updates the page
- Priority: High
- Section: Filters
- Type: ui
- Status: Not Automated
- Tags: sanity, regression
- Precondition: User is on the Portfolio page
- Steps:
  1. Navigate to the Portfolio page
  2. Open the community dropdown
  3. Verify the dropdown lists communities
  4. Select a different community
  5. Wait for the page to reload its data
  6. Verify the KPI cards still render without errors
- Expected: The page reloads for the selected community with no errors

## TC-PI-011: Community dropdown lists the expected options
- Priority: Medium
- Section: Filters
- Type: ui
- Status: Not Automated
- Tags: regression
- Precondition: User is on the Portfolio page for the Westmont tenant
- Steps:
  1. Navigate to the Portfolio page
  2. Open the community dropdown
  3. Verify the option list is not empty
- Expected: The dropdown is populated for the Westmont tenant

## TC-PI-012: Combined filters apply together
- Priority: Medium
- Section: Filters
- Type: ui
- Status: Not Automated
- Tags: regression
- Precondition: User is on the Portfolio page
- Steps:
  1. Navigate to the Portfolio page
  2. Change the community selection
  3. Change the quick month selection
  4. Wait for the page to reload
  5. Verify the KPI cards render without errors
- Expected: Multiple filters apply together without breaking the page

---

## Section: Edit Mode

> These tests must leave the page exactly as they found it.

## TC-PI-013: Edit mode opens
- Priority: High
- Section: Edit
- Type: ui
- Status: Not Automated
- Tags: sanity, regression
- Precondition: User is on the Portfolio page
- Steps:
  1. Navigate to the Portfolio page
  2. Click Edit
  3. Verify edit mode is active
  4. Exit edit mode without saving
- Expected: Edit mode opens and closes cleanly

## TC-PI-014: Exiting edit mode leaves the layout unchanged
- Priority: High
- Section: Edit
- Type: ui
- Status: Not Automated
- Tags: sanity, regression
- Precondition: User is on the Portfolio page
- Steps:
  1. Navigate to the Portfolio page
  2. Record the current KPI card order and count
  3. Enter edit mode
  4. Exit edit mode without saving any change
  5. Compare the KPI card order and count against the recorded values
- Expected: The layout is identical to before the test ran

## TC-PI-015: Cancelling an edit discards the change
- Priority: High
- Section: Edit
- Type: ui
- Status: Not Automated
- Tags: regression
- Precondition: User is on the Portfolio page
- Steps:
  1. Navigate to the Portfolio page
  2. Record the current configuration
  3. Enter edit mode
  4. Make a reversible change
  5. Cancel or discard the change
  6. Verify the configuration matches the recorded state
- Expected: The cancelled change is not persisted

---

## Section: AI Briefing

## TC-PI-016: Standard AI briefing generates
- Priority: High
- Section: AI Briefing
- Type: ui
- Status: Not Automated
- Tags: sanity, regression
- Precondition: User is on the Portfolio page
- Steps:
  1. Navigate to the Portfolio page
  2. Open the AI briefing
  3. Select the standard briefing
  4. Wait for the briefing to finish generating
  5. Verify briefing content is displayed
- Expected: A standard briefing is produced with no error

## TC-PI-017: REMOVED - see rationale below
- Status: Removed
- This case compared numeric figures quoted in the briefing against the
  values shown on screen. Retired by QA decision: AI briefing tests check
  that a briefing GENERATES, not that its figures match on-screen data.
  Portfolio's briefing legitimately cites derived and per-community figures
  (from the Community Scorecard, or simple arithmetic like "181 vacant
  units") that a DOM-only check can't reliably tell apart from a real
  content error, and this class of check does not generalise to modules
  whose widgets are charts (their data points never render as text at all -
  see Community Summary). The id is retired, not reused.

## TC-PI-018: Custom AI briefing generates
- Priority: High
- Section: AI Briefing
- Type: ui
- Status: Not Automated
- Tags: sanity, regression
- Precondition: User is on the Portfolio page
- Steps:
  1. Navigate to the Portfolio page
  2. Open the AI briefing
  3. Select the custom briefing
  4. Provide the custom input the form requires
  5. Wait for the briefing to finish generating
  6. Verify briefing content is displayed
- Expected: A custom briefing is produced with no error

## TC-PI-019: Briefing does not show an error state
- Priority: High
- Section: AI Briefing
- Type: ui
- Status: Not Automated
- Tags: regression, negative
- Precondition: User is on the Portfolio page
- Steps:
  1. Navigate to the Portfolio page
  2. Open the AI briefing
  3. Generate a briefing
  4. Verify no error message is displayed
  5. Verify the briefing is not empty
- Expected: The briefing completes successfully with content

---

## Section: Create a Task

## TC-PI-020: Create a task from the AI briefing opens the task page
- Priority: High
- Section: Create Task
- Type: ui
- Status: Not Automated
- Tags: sanity, regression
- Precondition: An AI briefing has been generated
- Steps:
  1. Navigate to the Portfolio page
  2. Open the AI briefing and generate a briefing
  3. Click Create a task
  4. Wait for navigation to complete
  5. Verify the create task page is displayed
- Expected: The user is taken to the create task page

## TC-PI-021: Leaving the create task page does not create a task
- Priority: Medium
- Section: Create Task
- Type: ui
- Status: Not Automated
- Tags: regression
- Precondition: User is on the create task page from a briefing
- Steps:
  1. Open the AI briefing and click Create a task
  2. Verify the create task page is displayed
  3. Navigate back without submitting
  4. Verify no task was created
- Expected: No task is persisted when the form is abandoned
