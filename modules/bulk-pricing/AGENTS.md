# Bulk Pricing Module

Quantity-based tiered pricing module. Define rules that give customers lower per-unit prices when they buy in larger quantities.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

```
src/
  index.ts              Module factory + re-exports
  schema.ts             2 models: pricingRule, pricingTier
  service.ts            Types + BulkPricingController interface
  service-impl.ts       Controller implementation
  store/
    endpoints/          2 customer endpoints (resolve, product tiers)
    components/
      index.tsx           Store UI exports (BulkPricingTiers) — "use client"
      _hooks.ts           useBulkPricingApi() hook
      _utils.ts           formatPrice helper
      bulk-pricing-tiers.tsx  Volume pricing table for product pages
      bulk-pricing-tiers.mdx  Presentation template
  admin/
    endpoints/          12 admin endpoints (rules CRUD, tiers CRUD, preview, summary)
  __tests__/
    service-impl.test.ts   91 tests
```

## Data models

- **pricingRule** — scoped pricing rule (product, variant, collection, or global) with priority, date range, active flag
- **pricingTier** — quantity break within a rule (minQuantity, maxQuantity, discountType, discountValue)

## Options

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `defaultPriority` | `number` | `0` | Default priority for new pricing rules |

## Discount types

- `percentage` — reduce price by N% (0-100)
- `fixed_amount` — subtract N from base price
- `fixed_price` — set unit price to N regardless of base

## Price resolution

1. Fetch all active rules matching the product/variant/collection
2. Sort by priority descending (highest wins)
3. For each rule, find the highest-minQuantity tier the quantity qualifies for
4. Apply the first match and return

## Patterns

- Rules have scopes: `product`, `variant`, `collection`, `global`
- Non-global rules require `targetId`; global rules must not have one
- Tiers sorted by `minQuantity` asc in lists, desc during resolution
- `maxQuantity` is optional — omit for "N+ units" tiers
- Unit price floors at 0 (never negative)
- Date-range scheduling via `startsAt`/`endsAt` on rules
- Results include in-memory sort after `findMany` (mock DataService does not implement `orderBy`)
- `exactOptionalPropertyTypes` is on — use conditional assignment, not `?? undefined`
- Requires: `products`
- Controller key: `bulkPricing`
