# Backorders Module

Manages backorder requests when customers purchase out-of-stock products. Tracks the full lifecycle from request to delivery, with configurable per-product policies.

## Structure

```
src/
  index.ts          Factory: backorders(options?) => Module + admin nav
  schema.ts         Data models: backorder, backorderPolicy
  service.ts        BackordersController interface + types
  service-impl.ts   BackordersController implementation
  store/endpoints/
    create-backorder.ts     POST /backorders/create
    check-eligibility.ts    GET  /backorders/check/:productId
    my-backorders.ts        GET  /backorders/mine
    get-backorder.ts        GET  /backorders/:id
    cancel-backorder.ts     POST /backorders/:id/cancel
  store/components/         Customer-facing components
    _hooks.ts               API hooks (useBackordersApi)
    _utils.ts               Shared utilities
    index.tsx               Component exports
    *.tsx                   Component logic
    *.mdx                   Component templates
  admin/components/
    index.tsx               Admin UI (BackorderList, BackorderPolicies) — "use client"
  admin/endpoints/
    list-backorders.ts      GET  /admin/backorders
    get-backorder.ts        GET  /admin/backorders/:id
    backorder-summary.ts    GET  /admin/backorders/summary
    update-status.ts        POST /admin/backorders/:id/status
    cancel-backorder.ts     POST /admin/backorders/:id/cancel
    bulk-update-status.ts   POST /admin/backorders/bulk-status
    allocate-stock.ts       POST /admin/backorders/allocate
    list-policies.ts        GET  /admin/backorders/policies
    set-policy.ts           POST /admin/backorders/policies/set
    get-policy.ts           GET  /admin/backorders/policies/:productId
    delete-policy.ts        POST /admin/backorders/policies/:productId/delete
  __tests__/
    service-impl.test.ts    66 tests
```

## Options

```ts
BackordersOptions {
  defaultLeadDays?: string  // Default lead time for products without a policy
}
```

## Data models

- **backorder**: id, productId, productName, variantId?, variantLabel?, customerId, customerEmail, orderId?, quantity, status, estimatedAvailableAt?, allocatedAt?, shippedAt?, cancelledAt?, cancelReason?, notes?, createdAt, updatedAt
- **backorderPolicy**: id, productId, enabled, maxQuantityPerOrder?, maxTotalBackorders?, estimatedLeadDays?, autoConfirm, message?, createdAt, updatedAt

## Status lifecycle

`pending` → `confirmed` → `allocated` → `shipped` → `delivered`

Any active status can transition to `cancelled`.

## Key patterns

- Policies control backorder eligibility per product (quantity limits, total caps, auto-confirm)
- `allocateStock` fills confirmed backorders FIFO — oldest first, only if full quantity can be satisfied
- `checkEligibility` returns whether a product accepts backorders + estimated lead time
- When no policy exists, backorders default to `pending` status
- When `autoConfirm` is enabled, backorders skip `pending` → go straight to `confirmed`
- `maxTotalBackorders` counts only active statuses (pending, confirmed, allocated)

## Requires

- `inventory` — backorders complement inventory's `allowBackorder` flag

## Events

Emits: `backorder.created`, `backorder.confirmed`, `backorder.allocated`, `backorder.shipped`, `backorder.delivered`, `backorder.cancelled`
