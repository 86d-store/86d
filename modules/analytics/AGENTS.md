# Analytics Module

Event tracking and reporting for the 86d store. Records page views, product views, cart events, purchases, and custom events. Provides admin endpoints for stats, top-product reports, and raw event access.

**Scope:** This guide owns Module-specific mechanics. In the 86d.store source checkout, read the repository root [`AGENTS.md`](../../AGENTS.md) for shared rules and gates. In another project, follow that project's instructions and the installed `@86d-app/core` contracts.

## Change protocol

1. **Route.** Read this guide and the Module's [`README.md`](./README.md). In the 86d.store source checkout, storage or cross-Module changes also follow the root [Module contracts](../../AGENTS.md#module-contracts) routes.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** In the 86d.store source checkout, run `bun run generate:modules` after a Module change, then `bun run generate:modules -- --frozen` and the parent gates. In another project, use that project's checks. Run the Module's focused tests when available.
   - Done when the current project's required checks pass; source-checkout work also requires a passing frozen registry check.

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
