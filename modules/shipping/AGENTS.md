# Shipping Module

Shipping zone/rate configuration plus a dormant v2 foundation for Connection-bound, fulfillment-linked quotes, labels, tracking, refunds, and adjustments. Shopper quote/tracking and legacy shipment mutation routes are contained until that foundation is durably activated.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

```
src/
  index.ts          Factory: shipping(options?) => Module
  schema.ts         Models: shippingZone, shippingRate, shippingMethod, shippingCarrier, shipment
  service.ts        ShippingController interface + types
  service-impl.ts   ShippingController implementation
  store/endpoints/
    calculate-rates.ts    POST /shipping/calculate
    list-methods.ts       GET  /shipping/methods
    list-carriers.ts      GET  /shipping/carriers
    track-shipment.ts     GET  /shipping/track/:id
  admin/endpoints/
    # Zones (8 endpoints)
    list-zones.ts         GET    /admin/shipping/zones
    create-zone.ts        POST   /admin/shipping/zones/create
    update-zone.ts        PUT    /admin/shipping/zones/:id/update
    delete-zone.ts        DELETE /admin/shipping/zones/:id/delete
    list-rates.ts         GET    /admin/shipping/zones/:id/rates
    add-rate.ts           POST   /admin/shipping/zones/:id/rates/add
    update-rate.ts        PUT    /admin/shipping/rates/:id/update
    delete-rate.ts        DELETE /admin/shipping/rates/:id/delete
    # Methods (4 endpoints)
    list-methods.ts       GET    /admin/shipping/methods
    create-method.ts      POST   /admin/shipping/methods/create
    update-method.ts      PUT    /admin/shipping/methods/:id/update
    delete-method.ts      DELETE /admin/shipping/methods/:id/delete
    # Carriers (4 endpoints)
    list-carriers.ts      GET    /admin/shipping/carriers
    create-carrier.ts     POST   /admin/shipping/carriers/create
    update-carrier.ts     PUT    /admin/shipping/carriers/:id/update
    delete-carrier.ts     DELETE /admin/shipping/carriers/:id/delete
    # Shipments (6 endpoints)
    list-shipments.ts     GET    /admin/shipping/shipments
    create-shipment.ts    POST   /admin/shipping/shipments/create
    get-shipment.ts       GET    /admin/shipping/shipments/:id
    update-shipment.ts    PUT    /admin/shipping/shipments/:id/update
    update-shipment-status.ts PUT /admin/shipping/shipments/:id/status
    delete-shipment.ts    DELETE /admin/shipping/shipments/:id/delete
  __tests__/
    service-impl.test.ts    45 tests (zone/rate CRUD, calculateRates core)
    controllers.test.ts     23 tests (edge cases, boundaries, multi-zone)
    endpoint-security.test.ts 14 tests (country matching, rate conditions)
    admin.test.ts           56 tests (admin workflows for all entities)
    methods.test.ts         21 tests (method CRUD)
    carriers.test.ts        20 tests (carrier CRUD)
    shipments.test.ts       48 tests (shipment lifecycle, tracking URLs)
```

## Data models

- **shippingZone**: id, name, countries (string[], ISO 3166-1 alpha-2), isActive, createdAt, updatedAt
- **shippingRate**: id, zoneId (FK → shippingZone, cascade), name, price (cents), minOrderAmount?, maxOrderAmount?, minWeight?, maxWeight?, isActive, createdAt, updatedAt
- **shippingMethod**: id, name, description?, estimatedDaysMin, estimatedDaysMax, isActive, sortOrder, createdAt, updatedAt
- **shippingCarrier**: id, name, code (unique, lowercase), trackingUrlTemplate? (uses `{tracking}` placeholder), isActive, createdAt, updatedAt
- **shipment**: id, orderId, carrierId?, methodId?, trackingNumber?, status, shippedAt?, deliveredAt?, estimatedDelivery?, notes?, createdAt, updatedAt
- **CalculatedRate** (return type): rateId, zoneName, rateName, price

## Rate calculation

`calculateRates({ country, orderAmount, weight? })`:
1. Fetch all active zones where `countries` includes the given country OR `countries` is empty (wildcard)
2. For each matched zone, fetch active rates where order amount and weight conditions are satisfied
3. Return applicable rates sorted cheapest first

## Shipment status transitions

Valid transitions are enforced by `VALID_SHIPMENT_TRANSITIONS`:
- `pending` → `shipped`, `failed`
- `shipped` → `in_transit`, `delivered`, `returned`, `failed`
- `in_transit` → `delivered`, `returned`, `failed`
- `delivered` → `returned`
- `returned` → (terminal)
- `failed` → `pending`

`updateShipmentStatus` auto-sets `shippedAt` on `shipped` and `deliveredAt` on `delivered`.

## Tracking URLs

`getTrackingUrl(shipmentId)` resolves the carrier's `trackingUrlTemplate` by replacing `{tracking}` with the shipment's `trackingNumber`. Returns null if any piece is missing.

## Exports

Types: `ShippingZone`, `ShippingRate`, `CalculatedRate`, `ShippingMethod`, `ShippingCarrier`, `Shipment`, `ShipmentStatus`, `ShippingController`

## Patterns

- `deleteZone` cascades: removes all rates for the zone first
- Carrier `code` always normalized to lowercase on create/update
- `countries` stored as JSON array in the data service
- `exactOptionalPropertyTypes` compatible: all optional params use `T | undefined`
- The registered EasyPost webhook preserves strict v2 HMAC/path/timestamp verification, then returns `503 SHIPPING_WEBHOOK_DURABILITY_REQUIRED` so EasyPost retries. It does not update a Shipment from process-local state.
- The legacy tracking-number lookup handler remains in source for migration reference but is deliberately unregistered until durable receipts, ordering, Connection identity, and `fulfillmentId` linkage exist.
- Registered shopper calculation and tracking routes return explicit v2-required errors; browser order amount, origin, packing, or an ID alone is not Shipping authority.
- Registered shipment create/update/status/delete routes return `SHIPPING_FULFILLMENT_WORKFLOW_REQUIRED`. Legacy controller methods remain compatibility-only.
