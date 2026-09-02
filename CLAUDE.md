# skyCommand Automation - Project Context

Playwright E2E automation for **skyCommand** (`qa-skycommand.skypoint.ai`),
testing the **Portfolio** module in the **Westmont** tenant.

Working folder (open THIS as the VS Code workspace root):
`C:\Users\UmeshgoudaHiregoudra\OneDrive - Skypoint\skyCommand_Automation`

GitHub: https://github.com/umeshgoudaskypoint/skypoint-skyCommand-Automation

---

## How the app works

The app fetches all its data from **Power BI via API**. We are testing that the
**UI renders**, not that the data is correct.

### Testing principles (from QA - do not violate)

1. **Never validate numbers against Power BI.** Render checks only.
2. **A KPI value of `0` is a PASS** - it means PBI has no value for that metric.
   Only errors, blanks and stuck loaders fail. (`Net Movement` is live at `0`.)
3. **Leave no trace.** Edit-mode tests must restore the original state and
   never click Save.
4. **One exception to rule 1:** the standard AI briefing summarises values
   already on screen, so TC-PI-017 compares briefing text against the UI -
   never against PBI.

---

## Authentication - READ THIS BEFORE TOUCHING LOGIN

Auth is **Azure AD B2C** at `login.skypointcloud.com`
(tenant `sicdpstage.onmicrosoft.com`, policy `B2C_1A_AccountLink_signin_Copilot`).

**Automated login DOES NOT WORK. Do not try to fix it.** Three walls:

1. `automation@skypointcloud.com` - password rejected.
2. `umeshgouda.hiregoudra@skypoint.ai` via email+password - B2C says
   "We can't seem to find your account". It is federated to Entra ID, not a
   local B2C account.
3. Via Microsoft SSO - the Microsoft page performs an `sso_reload` that
   **clears the email field** between filling and submitting. Verified with a
   retry+verify loop; clicking Next triggers another reload. Also, MFA cannot
   be automated at all.

### The working approach: capture the session manually

```bash
npm run auth:save
```

Opens a real browser. The USER signs in by hand (Microsoft SSO -> MFA ->
"Stay signed in?" = Yes). Session is saved to `playwright/.auth/user.json`
and reused by every test for several days. Re-run when it expires.

Claude cannot do this step - it needs a human at the machine.

---

## The Portfolio dashboard - real structure

9 widgets in `[data-testid="dashboard-grid"]`, all `.react-grid-item`.
**Only 7 are KPI cards.** The other two have no headline value:

| # | Widget | Value |
|---|---|---|
| 1 | Total Revenue | $15,655,447 |
| 2 | New Leads | 1 |
| 3 | Net Movement | **0** |
| 4 | Communities | 19 |
| 5 | Portfolio Health | 92.1% |
| 6 | **Disclaimer** | *(text block - NOT a KPI)* |
| 7 | Vacancy Rate | 7.9% |
| 8 | Vacancy Rate | 7.9% *(duplicate - flagged to QA, not confirmed a bug)* |
| 9 | **Community Scorecard** | *(table - NOT a KPI)* |

A KPI card is identified by containing `span.font-extrabold`:
- `kpiCard: '.react-grid-item:has(span.font-extrabold)'`
- `nonKpiWidget: '.react-grid-item:not(:has(span.font-extrabold))'`

Treating all 9 as KPI cards caused false failures on the Disclaimer and
Scorecard. Do not regress this.

### Real selectors (captured from the live app - use these, do not guess)

```
[data-testid="dynamic-insight-page"]        page container
[data-testid="dashboard-header"]            header
[data-testid="dashboard-grid"]              widget grid
[data-testid="dashboard-edit-btn"]          Edit button
[data-testid="button-global-ai-briefing"]   AI Briefing button
[data-testid="ai-briefing-container"]       briefing panel
[data-testid="button-briefing-create-task"] Create task button
[data-testid="filter-bar"]                  filter bar
[data-testid="filter-bar-quick-month"]      quick month dropdown
[data-testid="filter-bar-community"]        community dropdown
[data-testid="dynamic-insight-page-empty"]  empty state (tenant with no widgets)
.react-grid-item                            a widget
span.font-semibold                          KPI title
span.font-extrabold                         KPI value
```

Filter data: 19 communities (Carmel Valley, Chico, Culver City, ...).
Quick month: "Custom range" plus 15 months back from Sep 2026.

Briefing panel offers **Standard Briefing** and **Custom AI Analysis**,
plus **History** and **Create task**.

---

## Known traps (all previously hit - do not repeat)

**Briefing wait.** The panel ALREADY contains >200 chars before generating
(the two option-card descriptions). Checking for "some text" returns instantly
and the test races ahead of the LLM. Correct approach, in
`waitForBriefingToGenerate()`: snapshot text before clicking, wait for it to
CHANGE, then wait for the length to STOP GROWING (stable across 3 polls).

**Timeouts.** The dashboard takes ~35s to render PBI data. The default 60s
test timeout caused mass failures. Now `timeout: 180000`, with
`test.setTimeout(420000)` on the AI Briefing and Create Task suites.

**Retries are OFF** (`retries: 0`) by QA request. Retrying inflated totals
(23 passed + 3 failed out of 24 tests). The reporter also keys results by
test id so each case is counted exactly once.

**`--reporter=line` silently disables the email**, because the flag replaces
the config's reporter list including the custom one. Use plain `npm test`.

**PowerShell 5.1 has no `&&`.** Use `;` to chain commands, or Git Bash.

**Do not edit `utils/custom-reporter.js` while a run is in progress** - it
breaks report generation and no reports or email are produced.

---

## Email notification - CURRENTLY NOT WORKING

Requirement: after every run (including runs stopped early with Ctrl+C),
email **umeshgouda.hiregoudra@skypoint.ai** with total passed/failed and the
names of failed test cases.

Built: `scripts/send-report-email.ps1`, called from `custom-reporter.js`
`onEnd()`. Marks interrupted runs with an orange banner.

**Blocked:** the original approach used Outlook COM, but the user runs the
**new Outlook for Windows (Monarch)**, which has NO COM automation. Classic
Outlook is installed but has ZERO mail profiles, so COM launched it and it
prompted to create a profile, then returned `E_ABORT`.

Now switched to SMTP via PowerShell `System.Net.Mail` (no npm package needed).
Needs `SMTP_PASS` in `.env` - must be an **App Password**, not the normal
password. **Untested.** If the tenant has SMTP AUTH disabled it will fail with
`535 Authentication unsuccessful`; fall back to SendGrid or Microsoft Graph.

Without credentials, tests run normally and print the summary to the terminal.

---

## Commands

```bash
npm run auth:save     # manual sign-in, saves the session (USER must do this)
npm test              # all 24 tests + email
npm run test:headed   # watch it in a browser
npm run report        # open the HTML report
npm run mail:preview  # build the email without sending it
npx playwright test tests/portfolio.spec.ts --grep-invert "AI Briefing|Create a Task"
```

Full suite takes 50-60 minutes (briefings are LLM calls).

---

## Status

- 24 tests total: 4 authentication (pass without credentials), 20 Portfolio
- Test cases documented in `testcases/authentication.md` and
  `testcases/portfolio-insights.md`
- Last full run before the fixes: 10 passed, 9 failed - failures were the
  widget mis-classification and the 60s timeout, both since fixed
- **The fixes have NOT been verified by a full green run yet**
- Email delivery unverified

## Not done yet

- `agents/` folder is empty - the planner/generator/healer/orchestrator agents
  from the original template were never built. `package.json` still references
  them, so those scripts will fail.
- No `QUICKSTART.md` or `TESTCASE-GUIDE.md`.
- Only the Portfolio module is covered.
