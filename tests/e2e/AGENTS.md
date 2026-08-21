# tests/e2e — E2E Test Suite

Playwright tests for the 86d store. Runs against a live dev server.

## File structure

```
tests/e2e/
  fixtures/test-fixtures.ts   Page-object helpers (StorefrontPage, AdminPage, DashboardPage)
  storefront.spec.ts           Homepage, products, cart, mobile
  checkout.spec.ts             Full checkout flow, edge cases
  admin.spec.ts                Admin auth, dashboard, navigation, module pages
  dashboard.spec.ts            Dashboard auth, store/module management
  accessibility.spec.ts        Landmarks, labels, keyboard navigation
  performance.spec.ts          Load time assertions
  visual.spec.ts               Screenshot regression
```

## Key patterns

- Fixtures extend Playwright `test` with typed page-objects (`storefront`, `admin`, `dashboard`)
- All tests use `waitForLoadState("networkidle")` — never `waitForTimeout()`
- Admin elements use `data-testid` (e.g., `stat-card`, `stat-value`) for stable selectors
- Out-of-stock catalog cases skip the rest of that test. Authenticated setup fails if the admin session cannot be created.
- Credentials default to seed data: `admin@86d.app` / `password123`

## Config

- `tests/playwright.config.ts` (parent directory)
- Projects: `store-chromium`, `store-mobile`, `visual-desktop/tablet/mobile`
- WebServer auto-starts `bun run dev:store` on port 3000

## Adding tests

1. Import from `./fixtures/test-fixtures` (not `@playwright/test` directly) to get page-objects
2. Add new spec files to the appropriate `testMatch` array in `tests/playwright.config.ts`
3. Prefer `data-testid` over CSS class selectors for elements that may change styling
4. Always seed data first: `bun run db:seed`
