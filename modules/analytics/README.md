<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/logo" height="96" alt="86d" />
  </a>
</p>

<p align="center">
  Dynamic Commerce
</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use. Please proceed with caution. Use at your own risk.

# Analytics Module

📚 **Documentation:** [86d.app/docs/modules/analytics](https://86d.app/docs/modules/analytics)

Event tracking and reporting module for 86d stores. Records page views, product views, cart events, purchases, and custom events. Provides admin endpoints for stats aggregation, top-product reports, and raw event access.

## Installation

```ts
import analytics from "@86d-app/analytics";
import { createStore } from "@86d-app/core";

const store = createStore({
  modules: [analytics()],
});
```

## Store Endpoints

### Track an event
```
POST /analytics/events
```

**Body:**
```json
{
  "type": "productView",
  "sessionId": "sess_abc123",
  "customerId": "cust_xyz",
  "productId": "prod_456",
  "value": 2999,
  "data": { "referrer": "google" }
}
```

**Response:**
```json
{
  "event": {
    "id": "evt_...",
    "type": "productView",
    "sessionId": "sess_abc123",
    "productId": "prod_456",
    "value": 2999,
    "data": { "referrer": "google" },
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

## Admin Endpoints

### List events
```
GET /admin/analytics/events?type=productView&productId=prod_456&page=1&limit=100
```

Query params: `type`, `productId`, `customerId`, `sessionId`, `since` (ISO date), `until` (ISO date), `page`, `limit` (max 500).

### Get stats
```
GET /admin/analytics/stats?since=2026-01-01&until=2026-01-31
```

**Response:**
```json
{
  "stats": [
    { "type": "pageView", "count": 1842 },
    { "type": "productView", "count": 634 },
    { "type": "purchase", "count": 87 }
  ]
}
```

### Top products
```
GET /admin/analytics/top-products?limit=10&since=2026-01-01
```

**Response:**
```json
{
  "products": [
    { "productId": "prod_abc", "views": 312, "purchases": 41 },
    { "productId": "prod_xyz", "views": 189, "purchases": 22 }
  ]
}
```

## Event Types

Built-in types (any string is also valid for custom events):

| Type | Description |
|---|---|
| `pageView` | Customer viewed a page |
| `productView` | Customer viewed a product |
| `addToCart` | Customer added item to cart |
| `removeFromCart` | Customer removed item from cart |
| `checkout` | Customer started checkout |
| `purchase` | Order was completed |
| `search` | Customer performed a search |

## Controller API

Access via `ctx.controllers.analytics`:

```ts
// Track an event
const event = await controller.track({
  type: "purchase",
  customerId: "cust_123",
  orderId: "ord_456",
  productId: "prod_789",
  value: 5999,          // in cents
  data: { coupon: "SAVE10" },
});

// List events with filters
const events = await controller.listEvents({
  type: "purchase",
  since: new Date("2026-01-01"),
  take: 50,
  skip: 0,
});

// Get event counts by type
const stats = await controller.getStats({
  since: new Date("2026-01-01"),
  until: new Date("2026-01-31"),
});
// => [{ type: "pageView", count: 1842 }, ...]

// Get top products
const topProducts = await controller.getTopProducts({ limit: 10 });
// => [{ productId: "prod_abc", views: 312, purchases: 41 }, ...]
```

## Types

```ts
interface AnalyticsEvent {
  id: string;
  type: string;
  sessionId?: string;
  customerId?: string;
  productId?: string;
  orderId?: string;
  value?: number;       // arbitrary numeric value (e.g., amount in cents)
  data: Record<string, unknown>;
  createdAt: Date;
}

interface EventStats {
  type: string;
  count: number;
}

interface ProductStats {
  productId: string;
  views: number;
  purchases: number;
}
```

## Configuration

```ts
analytics({
  maxEvents: "10000",  // for documentation purposes; not enforced at module level
})
```
