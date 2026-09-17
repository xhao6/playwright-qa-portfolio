# Playwright + EspoCRM — QA Automation Portfolio

Playwright (TypeScript) test automation portfolio built against a private **EspoCRM** instance, demonstrating professional-level test engineering:

- Self-contained, resilient tests for a live CRM application
- Page Object Model + typed fixtures + shared authenticated session (storageState)
- Multi-project matrix (desktop / mobile) + WebKit smoke channel
- CI via GitHub Actions with HTML report, traces, videos and failure screenshots as artifacts

## Configuration

The target instance and credentials are injected via environment (`.env`, gitignored):

```bash
cp .env.example .env   # fill in your EspoCRM instance URL + admin credentials
```

## Quick start

```bash
npm install
npx playwright install chromium          # use --with-deps on Linux CI
npm test                                  # run all projects against your instance
npx playwright show-report                # view HTML report
```

## Projects

| Project | Target | Purpose |
|---|---|---|
| `desktop-chromium` | Desktop Chrome | Full UI suite |
| `mobile` | Pixel 5 | Mobile viewport |
| `webkit-smoke` | Desktop Safari | Cross-browser smoke evidence |

## Test discipline

Tests follow **self-contained data** rules (no reliance on pre-existing rows):

- every test creates uniquely-named data and cleans it up (fixtures),
- parallel-safe via unique suffixes,
- results/artifacts land in `test-results/` (gitignored).

> The instance is user-owned; treat credentials as secrets (`BASE_URL`, `ADMIN_USER`, `ADMIN_PASS` are injected, never committed).