# Playwright + EspoCRM — QA Automation Portfolio

Playwright (TypeScript) test automation portfolio built against a private **EspoCRM** instance, demonstrating professional-level test engineering:

- Self-contained, resilient tests for a live CRM application
- Page Object Model + typed fixtures + shared authenticated session (storageState)
- Multi-project matrix (desktop / mobile) + WebKit smoke channel
- CI via GitHub Actions with HTML report, traces, videos and failure screenshots as artifacts

## Current status

| Area | Status |
|---|---|
| Env injection (`dotenv`, baseURL from env) | Done |
| Login Page Object Model (`pages/LoginPage.ts`) | Done |
| Shared auth session (`tests/auth.setup.ts` → storageState) | Done |
| Auth suite (`tests/auth.spec.ts`): valid login / wrong password / empty-field validation | Done, passing |
| Accounts spec (`tests/accounts.spec.ts`): create / detail / edit / search / delete | Done, passing |
| Leads spec (`tests/leads.spec.ts`): create / search / convert | Done, passing |
| Data factory fixtures (`tests/helpers/fixtures.ts`) | Done (`uniqueName` + `unique` fixture) |
| CI workflow (`.github/workflows/ci.yml`) | Ready; requires 3 GitHub secrets |
| GitHub push | Pending (repo not yet published) |

> Tracked in detail in [`HANDOFF.md`](./HANDOFF.md).

## Configuration

The target instance and credentials are injected via environment (`.env`, gitignored):

```bash
cp .env.example .env   # fill in your EspoCRM instance URL + admin credentials
```

## Quick start

```bash
pnpm install
pnpm exec playwright install chromium   # use --with-deps on Linux CI
pnpm test                                # run all projects against your instance
pnpm exec playwright show-report         # view HTML report
```

## Projects

| Project | Target | Purpose |
|---|---|---|
| `desktop-chromium` | Desktop Chrome | Full UI suite |
| `mobile` | Pixel 5 | Mobile viewport |
| `webkit-smoke` | Desktop Safari | Cross-browser smoke evidence |

All projects depend on `setup`, which logs in once and persists `storageState` for shared sessions.

## Test discipline

Tests follow **self-contained data** rules (no reliance on pre-existing rows):

- every business spec creates uniquely-named data and cleans it up afterwards,
- parallel-safe via unique suffixes (`Auto_<ts>` + workerIndex),
- results/artifacts land in `test-results/` (gitignored).

## CI (GitHub Actions)

The workflow runs on push to `main` and manual dispatch, and targets the same private instance via 3 secrets:

| Secret | Maps to |
|---|---|
| `ESPOCRM_BASE_URL` | `BASE_URL` |
| `ESPOCRM_ADMIN_USER` | `ADMIN_USER` |
| `ESPOCRM_ADMIN_PASS` | `ADMIN_PASS` |

It installs Chromium, runs the `desktop-chromium` project, and uploads the HTML report plus traces/videos/screenshots as artifacts (30-day retention).

> The instance is user-owned; treat credentials as secrets (`BASE_URL`, `ADMIN_USER`, `ADMIN_PASS` are injected, never committed).