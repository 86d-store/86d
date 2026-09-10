# Favor Module

Favor delivery integration with zip-code-based service areas, runner tracking, and delivery stats.

**Scope:** This guide owns Module-specific mechanics. In the 86d.store source checkout, read the repository root [`AGENTS.md`](../../AGENTS.md) for shared rules and gates. In another project, follow that project's instructions and the installed `@86d-store/core` contracts.

## Change protocol

1. **Route.** Read this guide and the Module's [`README.md`](./README.md). In the 86d.store source checkout, storage or cross-Module changes also follow the root [Module contracts](../../AGENTS.md#module-contracts) routes.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** In the 86d.store source checkout, run `bun run generate:modules` after a Module change, then `bun run generate:modules -- --frozen` and the parent gates. In another project, use that project's checks. Run the Module's focused tests when available.
   - Done when the current project's required checks pass; source-checkout work also requires a passing frozen registry check.

## Structure

```
src/
  index.ts          Factory: favor(options?) => Module + admin nav (Fulfillment)
  schema.ts         Zod models: delivery, serviceArea
  service.ts        FavorController interface
  service-impl.ts   FavorController implementation
  store/endpoints/
    /favor/deliveries          Create delivery
    /favor/deliveries/:id      Get delivery
    /favor/availability        Check availability by zip code
  store/components/  index.tsx
  admin/endpoints/
    /admin/favor/deliveries              List deliveries
    /admin/favor/deliveries/:id/status   Update delivery status
    /admin/favor/service-areas           List service areas
    /admin/favor/service-areas/create    Create service area
    /admin/favor/stats                   Get delivery stats
  admin/components/  favor-admin.tsx, favor-admin.mdx, index.tsx
  __tests__/         controllers.test.ts, endpoint-security.test.ts, events.test.ts
```

## Options

```ts
interface FavorOptions extends ModuleConfig {
  apiKey?: string;       // Favor API key
  merchantId?: string;   // Favor merchant ID
  sandbox?: string;      // Use sandbox mode (default: "true")
}
```

## Data models

- **FavorDelivery** — id, orderId, externalId, status (pending|assigned|en-route|arrived|completed|cancelled), pickupAddress, dropoffAddress, estimatedArrival, actualArrival, fee, tip, runnerName, runnerPhone, trackingUrl, specialInstructions, metadata
- **ServiceArea** — id, name, isActive, zipCodes (string[]), minOrderAmount, deliveryFee, estimatedMinutes
- **FavorDeliveryStats** — totalDeliveries, totalPending, totalAssigned, totalEnRoute, totalCompleted, totalCancelled, totalFees, totalTips

## Patterns

- Availability check matches zip codes against active service areas
- Status updates accept optional runner info (runnerName, runnerPhone, trackingUrl, estimatedArrival, actualArrival, externalId)
- Completed/cancelled deliveries cannot be cancelled again
- Events emitted: `favor.delivery.created`, `favor.delivery.assigned`, `favor.delivery.completed`, `favor.delivery.cancelled`, `favor.webhook.received`
- Exports read values: `deliveryStatus`, `serviceAvailability`
- Stats aggregated in-memory from all deliveries (no pre-computed counters)
