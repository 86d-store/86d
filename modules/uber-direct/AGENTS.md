# Uber Direct Module

Uber Direct delivery integration with quote-based pricing, courier tracking, and delivery stats.

## Structure

```
src/
  index.ts          Factory: uberDirect(options?) => Module + admin nav (Fulfillment)
  schema.ts         Zod models: delivery, quote
  service.ts        UberDirectController interface
  service-impl.ts   UberDirectController implementation
  store/endpoints/
    /uber-direct/quotes            Request a delivery quote
    /uber-direct/deliveries        Create delivery (from quote)
    /uber-direct/deliveries/:id    Get delivery
  store/components/  index.tsx
  admin/endpoints/
    /admin/uber-direct/deliveries              List deliveries
    /admin/uber-direct/deliveries/:id/status   Update delivery status
    /admin/uber-direct/quotes                  List quotes
    /admin/uber-direct/stats                   Get delivery stats
  admin/components/  uber-direct-admin.tsx, uber-direct-admin.mdx, index.tsx
  __tests__/         controllers.test.ts, endpoint-security.test.ts, events.test.ts
```

## Options

```ts
interface UberDirectOptions extends ModuleConfig {
  clientId?: string;       // Uber Direct client ID
  clientSecret?: string;   // Uber Direct client secret
  customerId?: string;     // Uber Direct customer ID
  sandbox?: string;        // Use sandbox mode (default: "true")
}
```

## Data models

- **Delivery** — id, orderId, externalId, status (pending|quoted|accepted|picked-up|delivered|cancelled|failed), pickupAddress, dropoffAddress, pickupNotes, dropoffNotes, estimatedPickupTime, estimatedDeliveryTime, actualPickupTime, actualDeliveryTime, fee, tip, trackingUrl, courierName, courierPhone, courierVehicle, metadata
- **Quote** — id, pickupAddress, dropoffAddress, fee, estimatedMinutes, expiresAt, status (active|expired|used)
- **DeliveryStats** — totalDeliveries, totalPending, totalAccepted, totalPickedUp, totalDelivered, totalCancelled, totalFailed, totalFees, totalTips

## Patterns

- Quote-first flow: request a quote, then create delivery using quoteId
- Quotes expire after 15 minutes and can only be used once
- Delivery creation validates quote is active and not expired
- Status updates accept optional courier info (courierName, courierPhone, courierVehicle, trackingUrl, externalId, actualPickupTime, actualDeliveryTime)
- Delivered/cancelled/failed deliveries cannot be updated
- Events emitted: `uber-direct.delivery.created`, `uber-direct.delivery.picked-up`, `uber-direct.delivery.delivered`, `uber-direct.delivery.cancelled`, `uber-direct.quote.created`, `uber-direct.webhook.received`
- Exports read values: `deliveryStatus`, `deliveryTracking`
