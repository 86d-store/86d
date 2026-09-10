# Browser smoke tests

This Playwright suite exercises browser-only seams against a live, seeded Store Runtime. Unit, integration, and rendered-state tests are the CI base; this suite stays deliberately small and does not inventory every route or visual state.

## Run locally

Prepare PostgreSQL, apply migrations, seed demo data, and start the Store Runtime before running:

```bash
bun run db:migrate
bun run db:seed
BROWSER_START_SERVER=1 bun run test:browser
```

Set `BROWSER_START_SERVER=1` to let Playwright build and start the production Store, or set `BROWSER_STORE_URL` when the Store runs elsewhere. Browser authentication uses `BROWSER_ADMIN_EMAIL` and `BROWSER_ADMIN_PASSWORD` when set, then falls back to the `APP_ADMIN_EMAIL` and `APP_ADMIN_PASSWORD` values used by the seed. The fixture route requires `BROWSER_MERCHANT_UI_FIXTURES=true` at both build and runtime; the self-starting command supplies it to both phases.

Use `bun run test:browser:ui` for Playwright's interactive runner. The CI workflow builds and starts the production Store before executing the same suite.

## Scope

The single Chromium project covers 16 browser cases:

- authentication redirects and a reusable successful session;
- catalog-to-checkout navigation and persisted cart state;
- exact browser request contracts for product tiers and pickup windows;
- two authenticated reporting-query contracts that exercise browser request construction;
- scoped storefront and store-admin semantic Axe scans;
- keyboard focus, mobile menu focus/theme/resize behavior, labeled account navigation, mobile action reachability, table overflow recovery, and checkout/page recovery behavior.

Add a browser case only when the regression depends on navigation, storage, focus, responsive layout, browser request construction, or another real-browser boundary. Put route logic, data transformations, component states, and broad page coverage in unit, integration, or rendered-state tests.

The two semantic scans inspect only the primary `main` landmark and fail on serious or critical WCAG A/AA violations. They disable only Axe's `color-contrast` rule because existing light-theme muted text and primary-action contrast remain separately tracked debt. Do not broaden that exclusion; contrast requires dedicated visual review and remediation across the shared stylesheet.

## Visual review

For affected UI, agents visually inspect the running Store in Chrome at 1280×720 and 375×667. Review light and dark color schemes, required loading/empty/error/populated states, keyboard focus, overflow, and recovery paths relevant to the change. The fixture route at `/__merchant_ui_fixtures__` remains available for deterministic state inspection when enabled.

Screenshots are temporary review artifacts. Do not commit them as pixel baselines, and do not treat screenshots or a passing browser smoke run as launch evidence.

## Conventions

- Import `test` from `./fixtures/test-fixtures`.
- Prefer role, label, and `data-testid` locators over styling classes.
- Use web-first assertions; do not add arbitrary delays or `networkidle` waits.
- Fail closed when the seeded Store or authenticated session is unavailable.
- Use viewport overrides only inside tests for mobile-specific behavior.
