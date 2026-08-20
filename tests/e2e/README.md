# E2E Tests

Playwright end-to-end tests for the 86d store. Config lives in [`../playwright.config.ts`](../playwright.config.ts).

## Prerequisites

1. **Database** — PostgreSQL with migrated schema
2. **Seed data** — Run `bun run db:seed` to populate demo products, admin user, etc.
3. **Store running** — Tests auto-start `bun run dev:store` (or set `E2E_STORE_URL`)

## Running tests

```bash
bun run test:e2e                          # all tests
bun run test:e2e:store                    # store-chromium project only
playwright test storefront.spec.ts        # single file
playwright test --project=visual-desktop  # specific project
playwright test --update-snapshots        # regenerate visual baselines
```

## Test suites

| File | Project | What it covers |
|------|---------|----------------|
| `storefront.spec.ts` | store-chromium, store-mobile | Homepage, products, detail, cart, mobile |
| `checkout.spec.ts` | store-chromium | Full checkout flow, order summary, edge cases |
| `admin.spec.ts` | store-chromium | Auth, dashboard stats, navigation, module pages |
| `dashboard.spec.ts` | store-chromium | Dashboard auth, store management, modules, settings |
| `accessibility.spec.ts` | store-chromium | Landmarks, labels, keyboard focus |
| `performance.spec.ts` | store-chromium | Load times, navigation timing |
| `visual.spec.ts` | visual-desktop/tablet/mobile | Screenshot regression |

## Fixtures

Tests use page-object fixtures from `fixtures/test-fixtures.ts`:

- **`storefront`** — `StorefrontPage` with nav, cart, product helpers
- **`admin`** — `AdminPage` with sign-in, navigation, stat card locators
- **`dashboard`** — `DashboardPage` with store management helpers

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `E2E_STORE_URL` | `http://localhost:3000` | Store base URL |
| `E2E_ADMIN_EMAIL` | `admin@example.com` | Admin sign-in email |
| `E2E_ADMIN_PASSWORD` | `password123` | Admin sign-in password |

## Seed data

Run `bun run db:seed` to create:
- Admin user (`admin@example.com` / `password123`)
- 16 luxury demo products across 6 categories
- 6 collections (House Icons, Leather Atelier, Timepiece Gallery, Travel Salon, Evening Edit, Gift Selection)
- 3 demo customers, brand/content/merchandising data, store settings, inventory, navigation, and 1 demo order

## Conventions

- Use `waitForLoadState("networkidle")` instead of `waitForTimeout()`
- Use `data-testid` attributes for selectors that target styled elements
- Skip tests gracefully when preconditions aren't met (e.g., out-of-stock products)
- Visual snapshots need baseline generation on first run: `--update-snapshots`
