# Playwright + OrangeHRM — QA Automation Portfolio

Playwright (TypeScript) test automation portfolio built against the publicly available [OrangeHRM Demo](https://opensource-demo.orangehrmlive.com), demonstrating professional-level test engineering:

- Self-contained, resilient tests for a dynamic external application
- Page Object Model + typed fixtures + shared authenticated session (storageState)
- Multi-project matrix (desktop / tablet / mobile) + WebKit smoke
- CI via GitHub Actions with HTML report, traces, videos and failure screenshots as artifacts

## Quick start

```bash
npm install
npx playwright install chromium     # use --with-deps on Linux CI
npm test                             # run all projects
npx playwright show-report           # view HTML report
```

## Projects

| Project | Target | Purpose |
|---|---|---|
| `desktop-chromium` | Desktop Chrome | Full UI suite |
| `tablet` | 768×1024 Chrome | Responsive behavior |
| `mobile` | Pixel 5 | Mobile viewport |
| `webkit-smoke` | Desktop Safari | Cross-browser smoke evidence |

## Notes on the OrangeHRM Demo

The public demo is periodically slow or reset (documented upstream). Tests therefore follow **self-contained data** discipline:

- every test creates its own uniquely-named data and cleans it up (fixtures),
- no test depends on pre-existing rows,
- parallel-safe via unique suffixes.

> **Known constraint**: the demo site serves render-blocking CSS slowly from some networks (e.g. mainland China). Local runs may take a while; CI (GitHub-hosted) is the canonical fast path. See `SETUP_TROUBLESHOOTING.md` if stalls persist.