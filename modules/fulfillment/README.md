<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/logo" height="96" alt="86d" />
  </a>
</p>

<p align="center">
  The Modern Foundation for Commerce
</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use. Please proceed with caution. Use at your own risk.

# Fulfillment Module

📚 **Documentation:** [86d.app/docs/modules/fulfillment](https://86d.app/docs/modules/fulfillment)

Owns delivery obligations from packing through shipment tracking to delivery confirmation. Supports multiple obligations per order for partial and split delivery without making Orders or Shipping a second Fulfillment writer.

## Installation

```sh
npm install @86d-app/fulfillment
```

## Usage

```ts
import fulfillment from "@86d-app/fulfillment";

const module = fulfillment({
  autoShipOnTracking: true,
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `autoShipOnTracking` | `boolean` | `false` | Automatically transition status to "shipped" when tracking info is added to a pending or processing fulfillment |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/fulfillment/:id` | Get a single fulfillment by ID |
| `GET` | `/fulfillment/order/:orderId` | List all fulfillments for an order |

Store endpoints return a subset of fields — `notes` and `updatedAt` are excluded.

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/fulfillment` | List all fulfillments (filterable by status, limit, offset) |
| `POST` | `/admin/fulfillment/create` | Create a quantity-validated delivery obligation for an order |
| `GET` | `/admin/fulfillment/:id` | Get a fulfillment by ID |
| `POST` | `/admin/fulfillment/:id/status` | Contained: returns `FULFILLMENT_WORKFLOW_REQUIRED` |
| `POST` | `/admin/fulfillment/:id/tracking` | Contained: Shipping-owned tracking workflow required |
| `POST` | `/admin/fulfillment/:id/cancel` | Contained: durable cancellation workflow required |
| `GET` | `/admin/fulfillment/order/:orderId` | List fulfillments for an order (admin) |

## Status Lifecycle

```
pending → processing → shipped → delivered
  ↓          ↓           ↓
  └──────────┴───────────┴──→ cancelled
```

- **delivered** and **cancelled** are terminal states with no outward transitions.
- `shippedAt` is automatically set when status transitions to "shipped".
- `deliveredAt` is automatically set when status transitions to "delivered".
- `cancelFulfillment` is idempotent — calling it on an already-cancelled fulfillment returns the existing record.

## Events

The module emits the following domain events via `ScopedEventEmitter`:

| Event | Trigger | Payload |
|---|---|---|
| `fulfillment.created` | New fulfillment created | `{ fulfillmentId, orderId, items }` |
| `fulfillment.shipped` | Status → shipped | `{ fulfillmentId, orderId, carrier, trackingNumber }` |
| `fulfillment.delivered` | Status → delivered | `{ fulfillmentId, orderId }` |
| `fulfillment.cancelled` | Status → cancelled | `{ fulfillmentId, orderId }` |

Creation commits `fulfillment.created@1` to the durable outbox in the same transaction as its obligation row. Compatibility events fire-and-forget only after that commit and never determine whether the mutation succeeded. Legacy status, tracking, and cancellation controller methods remain in source, but their registered Admin routes fail closed until transactional durable workflows replace them. This is not the complete M5 lifecycle.

## Controller API

The `FulfillmentController` interface is exported for inter-module use.

```ts
interface FulfillmentController {
  createFulfillment(params: {
    orderId: string;
    items: FulfillmentItem[];
    notes?: string;
  }): Promise<Fulfillment>;

  getFulfillment(id: string): Promise<Fulfillment | null>;

  listByOrder(orderId: string): Promise<Fulfillment[]>;

  listFulfillments(params?: {
    status?: FulfillmentStatus;
    limit?: number;
    offset?: number;
  }): Promise<Fulfillment[]>;

  updateStatus(id: string, status: FulfillmentStatus): Promise<Fulfillment | null>;

  addTracking(id: string, params: {
    carrier: string;
    trackingNumber: string;
    trackingUrl?: string;
  }): Promise<Fulfillment | null>;

  cancelFulfillment(id: string): Promise<Fulfillment | null>;
}
```

## Types

```ts
type FulfillmentStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

interface FulfillmentItem {
  lineItemId: string;
  quantity: number;
}

interface Fulfillment {
  id: string;
  orderId: string;
  status: FulfillmentStatus;
  items: FulfillmentItem[];
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  notes?: string;
  shippedAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

## Store Components

### FulfillmentSummary

Displays all fulfillments for an order with status, item count, carrier, and tracking details.

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `orderId` | `string` | Yes | Order ID to look up fulfillments for |

#### Usage in MDX

```mdx
<FulfillmentSummary orderId="order_abc123" />
```

Use this component on an order detail or order confirmation page to show all fulfillment entries for a given order.

### FulfillmentTracker

Visual timeline showing fulfillment progress through each stage (pending, shipped, delivered), with timestamps and cancelled-state handling.

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `status` | `FulfillmentStatus` | Yes | Current fulfillment status |
| `createdAt` | `string \| Date` | Yes | When the fulfillment was created |
| `shippedAt` | `string \| Date \| null` | No | When it was shipped, if applicable |
| `deliveredAt` | `string \| Date \| null` | No | When it was delivered, if applicable |

#### Usage in MDX

```mdx
<FulfillmentTracker status="shipped" createdAt="2026-03-01T12:00:00Z" shippedAt="2026-03-03T09:30:00Z" />
```

Use this component on an order tracking page to visualize the fulfillment pipeline as a step-by-step timeline.

### TrackingInfo

Compact tracking card showing carrier name, tracking number with link, and current fulfillment status badge.

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `status` | `FulfillmentStatus` | Yes | Current fulfillment status |
| `carrier` | `string \| null` | No | Carrier name (e.g. UPS, FedEx) |
| `trackingNumber` | `string \| null` | No | Tracking number |
| `trackingUrl` | `string \| null` | No | Full tracking URL |

#### Usage in MDX

```mdx
<TrackingInfo status="shipped" carrier="UPS" trackingNumber="1Z999AA10123456784" trackingUrl="https://ups.com/track?num=1Z999AA10123456784" />
```

Use this component alongside order details to display shipping carrier and tracking information.

## Notes

- Requires the typed Orders line-quantity capability. It never reads the Orders database or controller directly.
- Creation fails closed if the capability, owner-local transaction, or row-locking support is unavailable.
- Multiple fulfillments can be created per order. Creation holds one owner-local lock per Order and rejects cumulative non-cancelled obligations above each accepted Order line quantity.
- Fulfillment items are stored as a JSON array (not a separate table).
- Generic fulfillments still require at least one positive-quantity Order line. Zero-line pickup, digital, and manual obligations need an explicit versioned obligation type and are not represented by empty item arrays.
- Store endpoints are read-only; all mutations require admin access.
- Endpoints return `{ error, status }` objects for not-found cases instead of throwing.
- Status, tracking, and cancellation routes are contained while their legacy controller writers await CAS plus durable lifecycle facts. Legacy Orders-owned fulfillment data also needs a backfill/read adapter, and Store reads still need Customer or scoped guest-proof authorization.
