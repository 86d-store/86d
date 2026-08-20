# Fulfillment Module

Authoritative delivery-obligation foundation with quantity-validated creation. Shipping owns parcels, labels, and tracking; Orders owns only the accepted commercial lines. Direct status, tracking, and cancellation transport is contained until durable workflows own those transitions.

## Structure

```
src/
  index.ts          Factory: fulfillment(options?) => Module
  schema.ts         ModuleSchema: fulfillment entity
  service.ts        FulfillmentController interface + types
  service-impl.ts   FulfillmentController implementation (7 methods)
  store/
    endpoints/      Customer-facing (read-only, filtered fields)
      get-fulfillment.ts          GET /fulfillment/:id
      list-by-order.ts            GET /fulfillment/order/:orderId
    components/     FulfillmentTracker, FulfillmentSummary, TrackingInfo
  admin/
    endpoints/      Protected
      list-fulfillments.ts        GET  /admin/fulfillment
      create-fulfillment.ts       POST /admin/fulfillment/create
      get-fulfillment.ts          GET  /admin/fulfillment/:id
      update-status.ts            POST /admin/fulfillment/:id/status
      add-tracking.ts             POST /admin/fulfillment/:id/tracking
      cancel-fulfillment.ts       POST /admin/fulfillment/:id/cancel
      list-by-order.ts            GET  /admin/fulfillment/order/:orderId
    components/     FulfillmentAdmin
  __tests__/
    service-impl.test.ts          67 tests (transitions, events, autoShip, lifecycle)
    controllers.test.ts           51 tests (edge cases, isolation, event emission)
```

## Options

```ts
FulfillmentOptions {
  autoShipOnTracking?: boolean  // Auto-transition pending/processing → shipped when tracking added
}
```

## Data models

- **fulfillment**: id, orderId, status (pending|processing|shipped|delivered|cancelled), items (JSON: [{lineItemId, quantity}]), carrier?, trackingNumber?, trackingUrl?, notes?, shippedAt?, deliveredAt?, createdAt, updatedAt
- **fulfillmentOrderLock**: one internal owner-local serialization row per Order; it is not a commerce projection or public API

## Status state machine

```
pending → processing → shipped → delivered
  ↓          ↓           ↓
  └──────────┴───────────┴──→ cancelled
```

- `delivered` and `cancelled` are terminal — no transitions out
- `shippedAt` auto-set on → shipped; `deliveredAt` on → delivered
- Invalid transitions throw an Error
- `cancelFulfillment` is idempotent — returns existing if already cancelled
- Cannot cancel delivered fulfillments (throws)

## Key patterns

- Requires the typed `orders.line-quantities.validate@1.0.0` capability; no Orders data is read directly
- Creation fails closed without the Orders capability, transactions, or row locking
- Creation normalizes duplicate requested lines, serializes by Order, and rejects cumulative non-cancelled obligations above accepted Order quantities
- Creation commits `fulfillment.created@1` to the durable outbox in the same owner-local transaction as the obligation row
- Cancelled obligations no longer consume a line allocation
- Items stored as JSON array (not separate entity)
- `createFulfillment` rejects an empty items array. Explicit zero-line pickup, digital, and manual obligation types remain unmodeled and must not be simulated with an empty generic Fulfillment.
- Store endpoints strip `notes` and `updatedAt` from responses
- `autoShipOnTracking` only applies to pending/processing fulfillments
- Events emitter is optional — controller works without it (graceful no-op)

## Remaining authority gaps

- Legacy controller methods for status, tracking, and cancellation remain for compatibility, but their registered Admin routes return `FULFILLMENT_WORKFLOW_REQUIRED`. They are not CAS-protected or transactionally paired with durable facts, so the full Fulfillment lifecycle is not yet M5-complete.
- Existing fulfillment rows have no migration/backfill adapter from the legacy Orders-owned tables.
- Store reads still need Customer or scoped guest-proof authorization before they are safe as the canonical account surface.

## Events emitted

`fulfillment.created`, `fulfillment.shipped`, `fulfillment.delivered`, `fulfillment.cancelled`

## Gotchas

- `exactOptionalPropertyTypes` is on — use `| undefined` for optional interface fields
- Admin endpoints use POST for mutations (not PUT) despite REST conventions
- notes field is admin-only — store endpoints strip it from responses
