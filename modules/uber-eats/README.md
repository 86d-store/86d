<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/logo" height="96" alt="86d" />
  </a>
</p>

<p align="center">Dynamic Commerce</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use.

# Uber Eats Module

📚 **Documentation:** [86d.app/docs/modules/uber-eats](https://86d.app/docs/modules/uber-eats)

Uber Eats marketplace integration for 86d. Receive and manage orders from Uber Eats, sync menus, and track order statistics.

## Installation

```sh
npm install @86d-app/uber-eats
```

## Usage

```ts
import uberEats from "@86d-app/uber-eats";

const module = uberEats({
  clientId: "your-client-id",
  clientSecret: "your-client-secret",
  restaurantId: "your-restaurant-id",
  sandbox: "true",
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `clientId` | `string` | — | Uber Eats client ID |
| `clientSecret` | `string` | — | Uber Eats client secret |
| `restaurantId` | `string` | — | Uber Eats restaurant ID |
| `sandbox` | `string` | `"true"` | Use sandbox mode |

## Store Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/uber-eats/orders` | Receive an order |
| GET | `/uber-eats/orders/:id` | Get order by ID |
| POST | `/uber-eats/orders/:id/accept` | Accept an order |
| POST | `/uber-eats/orders/:id/ready` | Mark order as ready |
| POST | `/uber-eats/orders/:id/cancel` | Cancel an order |

## Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/uber-eats/orders` | List all orders |
| GET | `/admin/uber-eats/stats` | Get order statistics |
| GET | `/admin/uber-eats/menu-syncs` | List menu sync history |
| POST | `/admin/uber-eats/menu-syncs/create` | Trigger a menu sync |

## Controller API

```ts
interface UberEatsController extends ModuleController {
  receiveOrder(params: {
    externalOrderId: string;
    items: Array<Record<string, unknown>>;
    subtotal: number;
    deliveryFee: number;
    tax: number;
    total: number;
    customerName?: string;
    customerPhone?: string;
    specialInstructions?: string;
  }): Promise<UberOrder>;

  acceptOrder(id: string): Promise<UberOrder | null>;
  markReady(id: string): Promise<UberOrder | null>;
  cancelOrder(id: string): Promise<UberOrder | null>;
  getOrder(id: string): Promise<UberOrder | null>;
  listOrders(params?: { status?: UberOrderStatus; take?: number; skip?: number }): Promise<UberOrder[]>;

  syncMenu(itemCount: number): Promise<MenuSync>;
  getLastMenuSync(): Promise<MenuSync | null>;
  listMenuSyncs(params?: { take?: number; skip?: number }): Promise<MenuSync[]>;
  getOrderStats(): Promise<OrderStats>;
}
```

## Types

```ts
type UberOrderStatus = "pending" | "accepted" | "preparing" | "ready" | "picked-up" | "delivered" | "cancelled";
type MenuSyncStatus = "pending" | "syncing" | "synced" | "failed";

interface UberOrder {
  id: string;
  externalOrderId: string;
  status: UberOrderStatus;
  items: Array<Record<string, unknown>>;
  subtotal: number;
  deliveryFee: number;
  tax: number;
  total: number;
  customerName?: string;
  customerPhone?: string;
  estimatedReadyTime?: Date;
  specialInstructions?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MenuSync {
  id: string;
  status: MenuSyncStatus;
  itemCount: number;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
}

interface OrderStats {
  total: number;
  pending: number;
  accepted: number;
  preparing: number;
  ready: number;
  delivered: number;
  cancelled: number;
  totalRevenue: number;
}
```

## Notes

- Order flow: `pending` -> `accepted` -> `preparing` -> `ready` -> `picked-up` -> `delivered`.
- Only `pending` orders can be accepted; only `accepted` or `preparing` orders can be marked ready.
- Orders in `delivered`, `cancelled`, or `picked-up` status cannot be cancelled.
- Revenue in `OrderStats` excludes cancelled orders.
- Events emitted: `ubereats.order.received`, `ubereats.order.accepted`, `ubereats.order.ready`, `ubereats.order.cancelled`, `ubereats.menu.synced`, `ubereats.webhook.received`.
