# Analytics Module

Event tracking and reporting for the 86d store. Records page views, product views, cart events, purchases, and custom events. Provides admin endpoints for stats, top-product reports, and raw event access.

## Schema

- `event` — analytics event with type, optional productId/customerId/sessionId/orderId, numeric value, and arbitrary data payload

## Event Types

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
