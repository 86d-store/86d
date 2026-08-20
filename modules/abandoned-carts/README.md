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

# Abandoned Carts Module

📚 **Documentation:** [86d.app/docs/modules/abandoned-carts](https://86d.app/docs/modules/abandoned-carts)

Tracks shopping carts that have been inactive beyond a configurable threshold and provides multi-channel recovery workflows (email, SMS, push notifications) to convert abandoned carts into orders.

## Installation

```sh
npm install @86d-app/abandoned-carts
```

## Usage

```ts
import abandonedCarts from "@86d-app/abandoned-carts";

const module = abandonedCarts({
  abandonmentThresholdMinutes: 60,
  maxRecoveryAttempts: 3,
  expirationDays: 30,
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `abandonmentThresholdMinutes` | `number` | `60` | Minutes of inactivity before a cart is considered abandoned |
| `maxRecoveryAttempts` | `number` | `3` | Maximum recovery attempts per cart (enforced at controller and endpoint level) |
| `expirationDays` | `number` | `30` | Default days for `bulkExpire()` when called without arguments |

All options are enforced at runtime:
- **`maxRecoveryAttempts`**: `recordAttempt()` throws an error and the send-recovery endpoint returns HTTP 400 when the limit is reached.
- **`expirationDays`**: `bulkExpire()` uses this value when no explicit `olderThanDays` argument is provided.
- **`abandonmentThresholdMinutes`**: Exposed via `getOptions()` for consumers to query the configured threshold.

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/abandoned-carts/track` | Report a cart as abandoned (emits `cart.abandoned`) |
| `GET` | `/abandoned-carts/recover/:token` | Recover a cart using a unique recovery token |

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/abandoned-carts` | List abandoned carts (filterable by status, email) |
| `GET` | `/admin/abandoned-carts/stats` | Get recovery statistics |
| `POST` | `/admin/abandoned-carts/bulk-expire` | Bulk-expire carts older than N days (defaults to `expirationDays`) |
| `GET` | `/admin/abandoned-carts/:id` | Get a single abandoned cart with recovery attempts |
| `POST` | `/admin/abandoned-carts/:id/recover` | Send a recovery message (emits `cart.recoveryAttempted`) |
| `POST` | `/admin/abandoned-carts/:id/dismiss` | Dismiss an abandoned cart |
| `DELETE` | `/admin/abandoned-carts/:id/delete` | Delete an abandoned cart and its attempts |

## Controller API

The `AbandonedCartController` interface is exported for inter-module use.

```ts
interface AbandonedCartController {
  create(params: CreateAbandonedCartParams): Promise<AbandonedCart>;
  get(id: string): Promise<AbandonedCart | null>;
  getByToken(token: string): Promise<AbandonedCart | null>;
  getByCartId(cartId: string): Promise<AbandonedCart | null>;
  list(params?: { status?: string; email?: string; take?: number; skip?: number }): Promise<AbandonedCart[]>;
  markRecovered(id: string, orderId: string): Promise<AbandonedCart | null>;
  markExpired(id: string): Promise<AbandonedCart | null>;
  dismiss(id: string): Promise<AbandonedCart | null>;
  delete(id: string): Promise<boolean>;
  recordAttempt(params: RecordAttemptParams): Promise<RecoveryAttempt>;
  updateAttemptStatus(attemptId: string, status: "delivered" | "opened" | "clicked" | "failed"): Promise<RecoveryAttempt | null>;
  listAttempts(abandonedCartId: string): Promise<RecoveryAttempt[]>;
  getWithAttempts(id: string): Promise<AbandonedCartWithAttempts | null>;
  getStats(): Promise<AbandonedCartStats>;
  countAll(): Promise<number>;
  bulkExpire(olderThanDays?: number): Promise<number>;
  getOptions(): AbandonedCartControllerOptions;
}
```

## Events

The module emits the following events:

| Event | Source | Payload |
|---|---|---|
| `cart.abandoned` | Track endpoint | `{ cartId, email, cartTotal, currency, itemCount }` |
| `cart.recoveryAttempted` | Send-recovery endpoint | `{ cartId, channel, recipient, attemptId }` |
| `cart.recovered` | `markRecovered()` controller | `{ cartId, orderId, email, cartTotal, currency }` |
| `cart.expired` | `markExpired()` / `bulkExpire()` | `{ cartId, email, cartTotal }` |
| `cart.dismissed` | `dismiss()` controller | `{ cartId, email, cartTotal }` |

## Types

```ts
interface AbandonedCart {
  id: string;
  cartId: string;
  customerId?: string;
  email?: string;
  items: CartItemSnapshot[];
  cartTotal: number;
  currency: string;
  status: "active" | "recovered" | "expired" | "dismissed";
  recoveryToken: string;
  attemptCount: number;
  lastActivityAt: Date;
  abandonedAt: Date;
  recoveredAt?: Date;
  recoveredOrderId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface CartItemSnapshot {
  productId: string;
  variantId?: string;
  name: string;
  sku?: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

interface RecoveryAttempt {
  id: string;
  abandonedCartId: string;
  channel: "email" | "sms" | "push";
  recipient: string;
  status: "sent" | "delivered" | "opened" | "clicked" | "failed";
  subject?: string;
  openedAt?: Date;
  clickedAt?: Date;
  sentAt: Date;
  createdAt: Date;
}

interface AbandonedCartStats {
  totalAbandoned: number;
  totalRecovered: number;
  totalExpired: number;
  totalDismissed: number;
  recoveryRate: number;
  totalRecoveredValue: number;
}

interface AbandonedCartControllerOptions {
  maxRecoveryAttempts: number;
  expirationDays: number;
  abandonmentThresholdMinutes: number;
}
```

## Store Components

### CartRecovery

Recovers an abandoned cart by its recovery token, displaying the saved cart items or an expiration notice if the token is no longer valid.

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `token` | `string` | Yes | Recovery token used to look up the abandoned cart |

#### Usage in MDX

```mdx
<CartRecovery token="abc123" />
```

Use this component on a dedicated cart recovery landing page linked from recovery emails.

## Notes

- Requires the `cart` module (reads cartItems, cartTotal) and `customers` module (reads customerEmail).
- Each abandoned cart gets a unique `recoveryToken` (UUID) used in recovery links.
- Recovery attempts track engagement: sent, delivered, opened, clicked, or failed.
- `maxRecoveryAttempts` is enforced both in the controller (`recordAttempt` throws) and in the send-recovery admin endpoint (returns 400).
- `bulkExpire()` called without arguments uses the configured `expirationDays` option (default 30).
- Cart items are stored as a JSON snapshot at the time of abandonment, decoupled from live cart data.
- Event emitter is injected at module init; controller uses a no-op fallback when no emitter is available.
