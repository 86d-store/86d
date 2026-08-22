# E2E Tests

Playwright suite for the Store Runtime against a live, seeded Store.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only. Parent [Testing](../../AGENTS.md#testing) waiting rules take precedence over any stale examples in this tree.

## Change protocol

1. **Route.** Read the parent guide (especially Testing) and this file. Visual coverage also follows workspace `prd/experience.md` via the parent.
2. **Implement** using the local patterns below. New tests use web-first assertions and `data-testid` selectors.
3. **Verify.** Run Playwright against an already running, seeded Store. Full pre-commit gates live in the parent guide. After `modules/` changes, prove `bun run generate:modules -- --frozen` from repo root.
   - Done when focused e2e coverage for the change passes and every required parent gate for the _slice_ is _green_.

## Structure

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

## Patterns

- Fixtures extend Playwright `test` with typed page-objects (`storefront`, `admin`, `dashboard`)
- Import from `./fixtures/test-fixtures`, not `@playwright/test` directly
- Prefer `data-testid` selectors (e.g. `stat-card`, `stat-value`) over CSS classes that may change styling
- Wait with **web-first assertions** (e.g. `expect(locator).toBeVisible()`). New tests never use `waitForTimeout()` or `waitForLoadState("networkidle")` — those patterns are stale and do not override the parent Testing section
- Out-of-stock catalog cases skip the rest of that test. Authenticated setup fails when the admin session cannot be created
- Credentials default to seed data: `admin@86d.app` / `password123`

## Config

- `tests/playwright.config.ts` (parent directory) is the executable source of truth
- Projects: `store-chromium`, `store-mobile`, `visual-desktop` / tablet / mobile
- Visual viewports: desktop 1280×720, tablet 768×1024, mobile 375×667 (light and dark)
- WebServer may auto-start `bun run dev:store` on port 3000; Playwright still needs a seeded Store

## Adding tests

1. Import from `./fixtures/test-fixtures` to get page-objects
2. Add new spec files to the appropriate `testMatch` array in `tests/playwright.config.ts`
3. Prefer `data-testid` over fragile CSS class selectors
4. Seed first: `bun run db:seed`
5. Cover every touched page route, empty state, and error state when the _slice_ adds UI surface
