# Analytics Module

Event tracking and reporting for the 86d store. Records page views, product views, cart events, purchases, and custom events. Provides admin endpoints for stats, top-product reports, and raw event access.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

```
src/
  schema / models   event — type, optional productId/customerId/sessionId/orderId, numeric value, arbitrary data payload
  store/endpoints/  POST /analytics/events
  admin/endpoints/  GET /admin/analytics/events, /stats, /top-products
```

## Event types

Built-in: `pageView`, `productView`, `addToCart`, `removeFromCart`, `checkout`, `purchase`, `search`. Any custom string is also valid.

## Endpoints

### Store (public)

- `POST /analytics/events` — track an event

### Admin (protected)

- `GET /admin/analytics/events` — list events (type/product/customer/session/date filters, pagination)
- `GET /admin/analytics/stats` — event counts by type (optional date range)
- `GET /admin/analytics/top-products` — most-viewed and most-purchased products

## Usage

```ts
import analytics from "@86d-app/analytics";

const store = createStore({
  modules: [analytics()],
});
```

## Controller

`ctx.controllers.analytics` implements `AnalyticsController`:

- `track(params)` — record an event, returns the stored `AnalyticsEvent`
- `listEvents(params?)` — paginated event list with filters
- `getStats(params?)` — `EventStats[]` sorted by count descending
- `getTopProducts(params?)` — `ProductStats[]` sorted by total activity descending
