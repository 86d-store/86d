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

# Shipping Module

📚 **Documentation:** [86d.app/docs/modules/shipping](https://86d.app/docs/modules/shipping)

Shipping configuration and a dormant authoritative v2 foundation for the 86d commerce platform. Legacy zone, method, and carrier configuration remains available; shopper quotes/tracking and shipment mutations are contained until fulfillment-linked, Connection-bound durable operations are activated.

![version](https://img.shields.io/badge/version-0.1.0-blue) ![license](https://img.shields.io/badge/license-MIT-green)

## Installation

```sh
npm install @86d-app/shipping
```

## Usage

```ts
import shipping from "@86d-app/shipping";
import { createModuleClient } from "@86d-app/core";

const client = createModuleClient([
  shipping({
    currency: "USD",
  }),
]);
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `currency` | `string` | `undefined` | Default currency for shipping prices |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/shipping/calculate` | Contained: returns `SHIPPING_QUOTE_V2_REQUIRED` |
| `GET` | `/shipping/methods` | List active shipping methods sorted by display order |
| `GET` | `/shipping/carriers` | List active shipping carriers |
| `GET` | `/shipping/track/:id` | Contained: verified Customer/guest continuity required |

When EasyPost is configured, `POST /shipping/webhook` preserves strict v2 HMAC, path, and timestamp verification. Missing verification configuration returns `503`, and missing or invalid signatures return `401`. A verified callback returns `503 SHIPPING_WEBHOOK_DURABILITY_REQUIRED` so EasyPost retries; it does not mutate Shipping state. The legacy process-local tracking-number handler remains deliberately unregistered until durable receipts, ordering, Connection identity, and `fulfillmentId` linkage are available.

### POST /shipping/calculate

Returns `503 SHIPPING_QUOTE_V2_REQUIRED`. The legacy controller remains migration compatibility; a browser-supplied order amount is not an accepted Shipping quote.

### GET /shipping/track/:id

Returns `503 SHIPPING_CUSTOMER_CONTINUITY_REQUIRED` until tracking is linked to a Fulfillment and authorized by verified Store Customer identity or scoped guest proof.

## Admin Endpoints

### Zones

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/shipping/zones` | List all shipping zones |
| `POST` | `/admin/shipping/zones/create` | Create a new shipping zone |
| `PUT` | `/admin/shipping/zones/:id/update` | Update a shipping zone |
| `DELETE` | `/admin/shipping/zones/:id/delete` | Delete a zone and all its rates |
| `GET` | `/admin/shipping/zones/:id/rates` | List rates for a zone |
| `POST` | `/admin/shipping/zones/:id/rates/add` | Add a rate to a zone |
| `PUT` | `/admin/shipping/rates/:id/update` | Update a shipping rate |
| `DELETE` | `/admin/shipping/rates/:id/delete` | Delete a shipping rate |

### Methods

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/shipping/methods` | List shipping methods |
| `POST` | `/admin/shipping/methods/create` | Create a shipping method |
| `PUT` | `/admin/shipping/methods/:id/update` | Update a shipping method |
| `DELETE` | `/admin/shipping/methods/:id/delete` | Delete a shipping method |

### Carriers

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/shipping/carriers` | List shipping carriers |
| `POST` | `/admin/shipping/carriers/create` | Create a shipping carrier |
| `PUT` | `/admin/shipping/carriers/:id/update` | Update a shipping carrier |
| `DELETE` | `/admin/shipping/carriers/:id/delete` | Delete a shipping carrier |

### Shipments

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/shipping/shipments` | List shipments (filter by orderId, status) |
| `POST` | `/admin/shipping/shipments/create` | Contained: fulfillment-linked durable operation required |
| `GET` | `/admin/shipping/shipments/:id` | Get shipment details + tracking URL |
| `PUT` | `/admin/shipping/shipments/:id/update` | Contained: fulfillment-linked durable operation required |
| `PUT` | `/admin/shipping/shipments/:id/status` | Contained: provider receipt/workflow required |
| `DELETE` | `/admin/shipping/shipments/:id/delete` | Contained: audited reversal workflow required |

## Rate Calculation

`calculateRates` matches zones by country code, then filters each zone's rates by order amount and weight constraints:

1. Zones with an empty `countries: []` array match all destinations (wildcard / "rest of world").
2. Rate conditions are optional — if not set, the condition is always satisfied.
3. Results are sorted cheapest first.

```ts
const rates = await controller.calculateRates({
  country: "US",
  orderAmount: 5000, // in cents
  weight: 1200,      // optional, in grams
});
// => [{ rateId, zoneName, rateName, price }, ...]
```

## Shipment Status Lifecycle

```
pending → shipped → in_transit → delivered → returned
   ↓        ↓          ↓
 failed   failed     failed
   ↓
 pending (retry)
```

Status transitions are enforced — invalid transitions return `null`. Timestamps `shippedAt` and `deliveredAt` are auto-set on the corresponding transitions.

## Controller API

```ts
// ── Zones ──────────────────────────────────────────────────────────────

controller.createZone(params: {
  name: string;
  countries?: string[]; // ISO 3166-1 alpha-2 codes; empty = wildcard
  isActive?: boolean;
}): Promise<ShippingZone>

controller.getZone(id: string): Promise<ShippingZone | null>
controller.listZones(params?: { activeOnly?: boolean }): Promise<ShippingZone[]>
controller.updateZone(id, params): Promise<ShippingZone | null>
controller.deleteZone(id: string): Promise<boolean> // cascades rates

// ── Rates ──────────────────────────────────────────────────────────────

controller.addRate(params: {
  zoneId: string;
  name: string;
  price: number;         // in cents
  minOrderAmount?: number;
  maxOrderAmount?: number;
  minWeight?: number;
  maxWeight?: number;
  isActive?: boolean;
}): Promise<ShippingRate>

controller.getRate(id: string): Promise<ShippingRate | null>
controller.listRates(params: { zoneId: string; activeOnly?: boolean }): Promise<ShippingRate[]>
controller.updateRate(id, params): Promise<ShippingRate | null>
controller.deleteRate(id: string): Promise<boolean>
controller.calculateRates(params: { country: string; orderAmount: number; weight?: number }): Promise<CalculatedRate[]>

// ── Methods ────────────────────────────────────────────────────────────

controller.createMethod(params: {
  name: string;
  description?: string;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  isActive?: boolean;
  sortOrder?: number;
}): Promise<ShippingMethod>

controller.getMethod(id: string): Promise<ShippingMethod | null>
controller.listMethods(params?: { activeOnly?: boolean }): Promise<ShippingMethod[]>
controller.updateMethod(id, params): Promise<ShippingMethod | null>
controller.deleteMethod(id: string): Promise<boolean>

// ── Carriers ───────────────────────────────────────────────────────────

controller.createCarrier(params: {
  name: string;
  code: string;                    // normalized to lowercase
  trackingUrlTemplate?: string;    // e.g. "https://track.ups.com/{tracking}"
  isActive?: boolean;
}): Promise<ShippingCarrier>

controller.getCarrier(id: string): Promise<ShippingCarrier | null>
controller.listCarriers(params?: { activeOnly?: boolean }): Promise<ShippingCarrier[]>
controller.updateCarrier(id, params): Promise<ShippingCarrier | null>
controller.deleteCarrier(id: string): Promise<boolean>

// ── Shipments ──────────────────────────────────────────────────────────

controller.createShipment(params: {
  orderId: string;
  carrierId?: string;
  methodId?: string;
  trackingNumber?: string;
  estimatedDelivery?: Date;
  notes?: string;
}): Promise<Shipment>

controller.getShipment(id: string): Promise<Shipment | null>
controller.listShipments(params?: { orderId?: string; status?: ShipmentStatus }): Promise<Shipment[]>
controller.updateShipment(id, params): Promise<Shipment | null>
controller.updateShipmentStatus(id, status: ShipmentStatus): Promise<Shipment | null>
controller.deleteShipment(id: string): Promise<boolean>
controller.getTrackingUrl(shipmentId: string): Promise<string | null>
```

## Example: Multi-zone Setup with Carriers

```ts
// Create carriers
const fedex = await controller.createCarrier({
  name: "FedEx",
  code: "fedex",
  trackingUrlTemplate: "https://www.fedex.com/fedextrack/?trknbr={tracking}",
});
const ups = await controller.createCarrier({
  name: "UPS",
  code: "ups",
  trackingUrlTemplate: "https://www.ups.com/track?tracknum={tracking}",
});

// Create shipping methods
await controller.createMethod({
  name: "Standard Shipping",
  estimatedDaysMin: 5,
  estimatedDaysMax: 7,
  sortOrder: 2,
});
await controller.createMethod({
  name: "Express Shipping",
  estimatedDaysMin: 1,
  estimatedDaysMax: 2,
  sortOrder: 1,
});

// Create zones and rates
const us = await controller.createZone({ name: "United States", countries: ["US"] });
await controller.addRate({ zoneId: us.id, name: "Standard", price: 599 });
await controller.addRate({ zoneId: us.id, name: "Free Shipping", price: 0, minOrderAmount: 5000 });

// Create a shipment for an order
const shipment = await controller.createShipment({
  orderId: "order-42",
  carrierId: fedex.id,
  trackingNumber: "794644790132",
});

// Advance through lifecycle
await controller.updateShipmentStatus(shipment.id, "shipped");
await controller.updateShipmentStatus(shipment.id, "in_transit");
await controller.updateShipmentStatus(shipment.id, "delivered");

// Get tracking URL
const url = await controller.getTrackingUrl(shipment.id);
// => "https://www.fedex.com/fedextrack/?trknbr=794644790132"
```

## Types

```ts
interface ShippingZone {
  id: string;
  name: string;
  countries: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ShippingRate {
  id: string;
  zoneId: string;
  name: string;
  price: number;
  minOrderAmount?: number;
  maxOrderAmount?: number;
  minWeight?: number;
  maxWeight?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ShippingMethod {
  id: string;
  name: string;
  description?: string;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ShippingCarrier {
  id: string;
  name: string;
  code: string;
  trackingUrlTemplate?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type ShipmentStatus = "pending" | "shipped" | "in_transit" | "delivered" | "returned" | "failed";

interface Shipment {
  id: string;
  orderId: string;
  carrierId?: string;
  methodId?: string;
  trackingNumber?: string;
  status: ShipmentStatus;
  shippedAt?: Date;
  deliveredAt?: Date;
  estimatedDelivery?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface CalculatedRate {
  rateId: string;
  zoneName: string;
  rateName: string;
  price: number;
}
```

## Store Components

### ShippingEstimator

Shipping cost estimator form. Customers select a country and optionally enter an order total to see available shipping rates and prices.

#### Usage in MDX

```mdx
<ShippingEstimator />
```

### ShippingOptions

Displays available shipping rates as selectable radio buttons. Auto-fetches rates based on provided country and order amount. Selects the cheapest option by default.

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `country` | `string` | Yes | ISO 3166-1 alpha-2 country code |
| `orderAmount` | `number` | Yes | Cart total in cents |
| `weight` | `number` | No | Total weight in grams |
| `onSelect` | `(rate) => void` | No | Callback when a rate is selected |
| `selectedRateId` | `string` | No | Pre-selected rate ID |

### ShippingRateSummary

Displays a selected shipping method and its cost. Free shipping is highlighted in green.

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `rateName` | `string` | Yes | Name of the selected rate |
| `zoneName` | `string` | No | Name of the shipping zone |
| `price` | `number` | Yes | Price in cents (0 = free) |

## Notes

- All prices are in cents (integer). Convert to display currency on the frontend.
- Carrier codes are always normalized to lowercase.
- Shipment status transitions are enforced — invalid transitions return null.
- Zone deletion cascades to all associated rates.
- Weight fields use grams as the unit.
