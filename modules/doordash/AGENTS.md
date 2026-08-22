# DoorDash Module

DoorDash delivery integration with zone-based availability, delivery tracking, and driver info.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

```
src/
  index.ts          Factory: doordash(options?) => Module + admin nav (Fulfillment)
  schema.ts         Zod models: delivery, deliveryZone
  service.ts        DoordashController interface
  service-impl.ts   DoordashController implementation (haversine distance for zone matching)
  store/endpoints/
    /doordash/deliveries          Create delivery
    /doordash/deliveries/:id      Get delivery
    /doordash/availability        Check delivery availability by lat/lng
  store/components/  index.tsx
  admin/endpoints/
    /admin/doordash/deliveries              List deliveries
    /admin/doordash/deliveries/create       Create delivery (admin)
    /admin/doordash/deliveries/:id/status   Update delivery status
    /admin/doordash/zones                   List zones
    /admin/doordash/zones/create            Create zone
    /admin/doordash/zones/:id               Update zone
    /admin/doordash/zones/:id/delete        Delete zone
  admin/components/  doordash-admin.tsx, doordash-admin.mdx, index.tsx
  __tests__/         controllers.test.ts, endpoint-security.test.ts, events.test.ts
```

## Options

```ts
interface DoordashOptions extends ModuleConfig {
  apiKey?: string;        // DoorDash API key
  businessId?: string;    // DoorDash business ID
  sandbox?: string;       // Use sandbox mode (default: "true")
}
```

## Data models

- **Delivery** — id, orderId, externalDeliveryId, status (pending|accepted|picked-up|delivered|cancelled), pickupAddress, dropoffAddress, estimatedPickupTime, estimatedDeliveryTime, actualPickupTime, actualDeliveryTime, fee, tip, trackingUrl, driverName, driverPhone, metadata
- **DeliveryZone** — id, name, isActive, radius, centerLat, centerLng, minOrderAmount, deliveryFee, estimatedMinutes
- **DeliveryAvailability** — available, zone?, estimatedMinutes?, deliveryFee?

## Patterns

- Zone matching uses haversine distance (miles) against zone radius
- Status transitions are guarded: delivered/cancelled deliveries cannot be updated
- Events emitted: `doordash.delivery.created`, `doordash.delivery.picked-up`, `doordash.delivery.delivered`, `doordash.delivery.cancelled`, `doordash.webhook.received`
- Exports read values: `deliveryStatus`, `deliveryTrackingUrl`
- `actualPickupTime`/`actualDeliveryTime` auto-set on status transitions
