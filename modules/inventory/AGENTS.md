# Inventory Module

Stock tracking for products across variants and locations. Supports reservations, deductions, low-stock alerts, back-in-stock subscriptions, and backorder control.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

```
src/
  index.ts          Factory: inventory(options?) => Module
  schema.ts         Zod models: inventoryItem, backInStockSubscription
  service.ts        InventoryController interface + types
  service-impl.ts   InventoryController implementation (17 methods)
  store/
    endpoints/      Customer-facing
      check-stock.ts              GET  /inventory/check
      back-in-stock-subscribe.ts  POST /inventory/back-in-stock/subscribe
      back-in-stock-unsubscribe.ts POST /inventory/back-in-stock/unsubscribe
      back-in-stock-check.ts      GET  /inventory/back-in-stock/check
    components/     StockStatus, StockAvailability, BackInStockForm
  admin/
    endpoints/      Protected
      list-items.ts               GET    /admin/inventory
      set-stock.ts                POST   /admin/inventory/set
      adjust-stock.ts             POST   /admin/inventory/adjust
      low-stock.ts                GET    /admin/inventory/low-stock
      back-in-stock-list.ts       GET    /admin/inventory/back-in-stock
      back-in-stock-stats.ts      GET    /admin/inventory/back-in-stock/stats
      back-in-stock-delete.ts     DELETE /admin/inventory/back-in-stock/:id
    components/     InventoryList, BackInStockAdmin
  __tests__/
    service-impl.test.ts          86 tests (core logic, events, subscriptions)
    controllers.test.ts           38 tests (edge cases, isolation, lifecycle)
```

## Options

```ts
InventoryOptions {
  defaultLowStockThreshold?: number
}
```

## Data models

- **inventoryItem**: id (composite: productId:variantId:locationId), productId, variantId?, locationId?, quantity, reserved, available (computed: max(0, quantity - reserved)), lowStockThreshold?, allowBackorder, createdAt, updatedAt
- **backInStockSubscription**: id (composite: productId:variantId:email), productId, variantId?, email (lowercase), customerId?, productName?, status (active|notified), subscribedAt, notifiedAt?

## Composite key

Items identified by `productId:variantId:locationId` (uses `_` as placeholder). E.g. `prod_1:_:_`, `prod_1:var_1:loc_1`.

## Patterns

- `available` is computed, never stored: `Math.max(0, quantity - reserved)`
- The admin adjust route is an authenticated transport adapter to `inventory.stock.adjust@1`; its Module handler fails closed so there is no second direct writer
- Absolute set-stock remains contained until a corresponding Inventory Command is registered
- `reserve` returns null if available < requested AND allowBackorder is false
- `deduct` decrements both quantity and reserved (used at fulfillment)
- `release` floors reserved at zero (safe over-release)
- Untracked products (`getStock` returns null) are treated as always in stock
- Subscriptions are idempotent: same productId+variantId+email returns existing active sub
- Email is normalized to lowercase for subscription IDs
- `exactOptionalPropertyTypes` compatible: all optional params use `T | undefined`
- `findMany` uses spread pattern for optional take/skip

## Events

- `inventory.updated` — on any stock mutation (set, adjust, reserve, release, deduct)
- `inventory.low` — when available ≤ lowStockThreshold (only if threshold is set)
- `inventory.back-in-stock` — when stock transitions from 0 to >0; includes subscriber list; auto-marks as notified

## Exports

read: `stockQuantity`, `stockAvailability`; readWrite: `stockReservation`
