# Uber Eats Module

Uber Eats marketplace integration with order management, menu syncing, and order statistics.

## Structure

```
src/
  index.ts          Factory: uberEats(options?) => Module + admin nav (Sales)
  schema.ts         Zod models: uberOrder, menuSync
  service.ts        UberEatsController interface
  service-impl.ts   UberEatsController implementation
  store/endpoints/
    /uber-eats/orders                Receive order
    /uber-eats/orders/:id            Get order
    /uber-eats/orders/:id/accept     Accept order
    /uber-eats/orders/:id/ready      Mark order ready
    /uber-eats/orders/:id/cancel     Cancel order
  store/components/  index.tsx
  admin/endpoints/
    /admin/uber-eats/orders              List orders
    /admin/uber-eats/stats               Get order stats
    /admin/uber-eats/menu-syncs          List menu syncs
    /admin/uber-eats/menu-syncs/create   Trigger menu sync
  admin/components/  uber-eats-admin.tsx, uber-eats-admin.mdx, index.tsx
  __tests__/         controllers.test.ts, endpoint-security.test.ts, events.test.ts
```

## Options

```ts
interface UberEatsOptions extends ModuleConfig {
  clientId?: string;       // Uber Eats client ID
  clientSecret?: string;   // Uber Eats client secret
  restaurantId?: string;   // Uber Eats restaurant ID
  sandbox?: string;        // Use sandbox mode (default: "true")
}
```

## Data models

- **UberOrder** — id, externalOrderId, status (pending|accepted|preparing|ready|picked-up|delivered|cancelled), items (JSON array), subtotal, deliveryFee, tax, total, customerName, customerPhone, estimatedReadyTime, specialInstructions
- **MenuSync** — id, status (pending|syncing|synced|failed), itemCount, error, startedAt, completedAt
- **OrderStats** — total, pending, accepted, preparing, ready, delivered, cancelled, totalRevenue

## Patterns

- Order flow: receive -> accept -> ready -> picked-up -> delivered
- Only pending orders can be accepted; only accepted/preparing orders can be marked ready
- Orders in delivered/cancelled/picked-up status cannot be cancelled
- Revenue excludes cancelled orders in stats
- Menu sync creates a record with immediate `synced` status
- Events emitted: `ubereats.order.received`, `ubereats.order.accepted`, `ubereats.order.ready`, `ubereats.order.cancelled`, `ubereats.menu.synced`, `ubereats.webhook.received`
- Exports read values: `uberOrderStatus`, `uberOrderTotal`
