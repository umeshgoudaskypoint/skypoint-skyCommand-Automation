# skyCommand Automation

Playwright end-to-end automation framework for **skyCommand** (`qa-skycommand.skypoint.ai`).

## Prerequisites

- Node.js 18+ (tested on v24)
- npm

## Setup

```bash
npm install
npx playwright install chromium
```

Copy the environment template and fill in your QA credentials:

```bash
cp .env.example .env
```

Then edit `.env`:

```
TEST_USER_EMAIL=automation@skypointcloud.com
TEST_USER_PASSWORD=<your password>
```

`.env` is gitignored — never commit real credentials.

## Running tests

| Command | What it does |
|---|---|
| `npm test` | Run the whole suite (headless) |
| `npm run test:headed` | Run with a visible browser |
| `npm run test:ui` | Playwright's interactive UI mode |
| `npm run test:debug` | Step through tests in the inspector |
| `npm run test:sanity` | Only `@sanity`-tagged tests |
| `npm run test:auth` | Only the authentication suite |
| `npm run report` | Open the last HTML report |
| `npm run codegen` | Record a new test by clicking through the app |

The authentication tests run **without credentials**, so they work as a smoke
check of the setup:

```bash
npx playwright test tests/authentication.spec.ts
```

## Authentication

skyCommand uses **Azure AD B2C** at `login.skypointcloud.com`
(tenant `sicdpstage.onmicrosoft.com`, policy `B2C_1A_AccountLink_signin_Copilot`).

The flow is:

1. App redirects to the B2C provider chooser
2. Click **Sign in with Email & Password** (`#emailPasswordSignIn`)
3. Fill `#signInName` / `#password`, submit `#next`
4. B2C redirects to `/auth/callback`, then into the app

`utils/global-setup.ts` performs this once per run and caches the session to
`playwright/.auth/user.json`, so individual tests start already signed in.

## Project layout

```
├── tests/                    # Test specs
│   └── authentication.spec.ts
├── testcases/                # Human-readable Markdown test cases
├── utils/
│   ├── pages/                # Page Object Models
│   │   ├── BasePage.ts       # Shared click/fill/wait/assert helpers
│   │   ├── LoginPage.ts      # Azure AD B2C login flow
│   │   └── PortfolioInsightsPage.ts
│   ├── fixtures.ts           # Custom Playwright fixtures
│   ├── global-setup.ts       # Login once, cache the session
│   ├── global-teardown.ts
│   └── custom-reporter.js    # Run summary + healing hints
├── agents/                   # Test generation agents
├── reports/                  # Generated reports (gitignored)
├── playwright.config.ts
└── .env                      # Your credentials (gitignored)
```

## Refining selectors

`PortfolioInsightsPage.ts` currently uses multi-strategy fallback selectors
written before the authenticated UI could be inspected. Once you can sign in,
replace them with real `data-testid` values from the app source.

To discover selectors interactively:

```bash
npm run codegen
```

## Troubleshooting

**`Login rejected by Skypoint B2C: "Your password is incorrect"`**
The credentials in `.env` are wrong, or the account signs in via an SSO
provider (Microsoft / Okta) rather than email + password.

**Tests hang on a loading spinner**
Insights pages poll continuously, so `networkidle` may never settle.
`BasePage.waitForNetworkIdle()` swallows that timeout by design — wait on a
specific element instead.

**Want to skip login entirely**
Set `SKIP_AUTH=true` in `.env`, or prefix the command with it.
