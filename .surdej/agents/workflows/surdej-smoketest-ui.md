---
name: surdej-smoketest-ui
description: Run Playwright headless UI smoke tests (login, home page) and output results
---

# UI Smoke Tests

Runs pre-written Playwright smoke tests in **headless** mode against the frontend.
Tests verify that the login page loads, demo login works, and the home page renders.

## Prerequisites

- Frontend running locally (`http://localhost:4001`) or specify a target URL
- API running (for demo login to succeed)
- Node.js installed

## Step 1 — Ensure Playwright is installed

// turbo
```bash
cd tests && npx playwright install chromium --with-deps 2>/dev/null || npx playwright install chromium
```

## Step 2 — Run smoke tests in headless mode

Run the smoke test suite. Results are output to `tests/smoke-ui/`.

```bash
cd tests && npx playwright test --config playwright.smoke.config.ts --reporter=html --output=smoke-ui/results
```

The HTML report will be generated in `tests/smoke-ui/report/`.

## Step 3 — Review results

// turbo
```bash
cd tests && cat smoke-ui/results/summary.txt 2>/dev/null || echo "See HTML report in tests/smoke-ui/report/"
```

If any tests failed, investigate by checking:
1. The HTML report: `npx playwright show-report tests/smoke-ui/report`
2. Screenshots in `tests/smoke-ui/results/`
3. Whether the frontend and API are running

## Step 4 — Report to the user

Summarise the results:
- Total tests run
- Passed / failed / skipped counts
- Any failure details with screenshots

## Overriding the target URL

To run against a different environment:

```bash
cd tests && BASE_URL=https://ai.pdf-refinery.happymates.dk npx playwright test --config playwright.smoke.config.ts
```

> **Note:** Demo login only works in `dev` mode. When targeting production, the demo login test
> will be skipped automatically via the `SMOKE_SKIP_DEMO` env var.
