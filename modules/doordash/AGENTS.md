# DoorDash Module

DoorDash delivery integration with zone-based availability, delivery tracking, and driver info.

**Scope:** This guide owns Module-specific mechanics. In the 86d.store source checkout, read the repository root [`AGENTS.md`](../../AGENTS.md) for shared rules and gates. In another project, follow that project's instructions and the installed `@86d-store/core` contracts.

## Change protocol

1. **Route.** Read this guide and the Module's [`README.md`](./README.md). In the 86d.store source checkout, storage or cross-Module changes also follow the root [Module contracts](../../AGENTS.md#module-contracts) routes.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** In the 86d.store source checkout, run `bun run generate:modules` after a Module change, then `bun run generate:modules -- --frozen` and the parent gates. In another project, use that project's checks. Run the Module's focused tests when available.
   - Done when the current project's required checks pass; source-checkout work also requires a passing frozen registry check.

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
