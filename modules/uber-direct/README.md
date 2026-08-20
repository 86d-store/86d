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

# Uber Direct Module

📚 **Documentation:** [86d.app/docs/modules/uber-direct](https://86d.app/docs/modules/uber-direct)

Uber Direct delivery integration for 86d. Request delivery quotes, create deliveries from quotes, track courier assignments, and view delivery statistics.

## Installation

```sh
npm install @86d-app/uber-direct
```

## Usage

```ts
import uberDirect from "@86d-app/uber-direct";

const module = uberDirect({
  clientId: "your-client-id",
  clientSecret: "your-client-secret",
  customerId: "your-customer-id",
  sandbox: "true",
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `clientId` | `string` | — | Uber Direct client ID |
| `clientSecret` | `string` | — | Uber Direct client secret |
| `customerId` | `string` | — | Uber Direct customer ID |
| `sandbox` | `string` | `"true"` | Use sandbox mode |

## Store Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/uber-direct/quotes` | Request a delivery quote |
| POST | `/uber-direct/deliveries` | Create delivery from a quote |
| GET | `/uber-direct/deliveries/:id` | Get delivery by ID |

## Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/uber-direct/deliveries` | List all deliveries |
| POST | `/admin/uber-direct/deliveries/:id/status` | Update delivery status |
| GET | `/admin/uber-direct/quotes` | List all quotes |
| GET | `/admin/uber-direct/stats` | Get delivery stats |

## Controller API

```ts
interface UberDirectController extends ModuleController {
  requestQuote(params: RequestQuoteParams): Promise<Quote>;
  createDelivery(params: CreateDeliveryParams): Promise<Delivery | null>;
  getDelivery(id: string): Promise<Delivery | null>;
  cancelDelivery(id: string): Promise<Delivery | null>;

  updateDeliveryStatus(
    id: string,
    status: Delivery["status"],
    updates?: Partial<Pick<Delivery,
      "externalId" | "trackingUrl" | "courierName" | "courierPhone" | "courierVehicle" | "actualPickupTime" | "actualDeliveryTime"
    >>,
  ): Promise<Delivery | null>;

  listDeliveries(params?: { status?: string; orderId?: string; take?: number; skip?: number }): Promise<Delivery[]>;
  getQuote(id: string): Promise<Quote | null>;
  listQuotes(params?: { status?: string; take?: number; skip?: number }): Promise<Quote[]>;
  getDeliveryStats(): Promise<DeliveryStats>;
}
```

## Types

```ts
interface Delivery {
  id: string;
  orderId: string;
  externalId?: string;
  status: "pending" | "quoted" | "accepted" | "picked-up" | "delivered" | "cancelled" | "failed";
  pickupAddress: Record<string, unknown>;
  dropoffAddress: Record<string, unknown>;
  pickupNotes?: string;
  dropoffNotes?: string;
  estimatedPickupTime?: Date;
  estimatedDeliveryTime?: Date;
  actualPickupTime?: Date;
  actualDeliveryTime?: Date;
  fee: number;
  tip: number;
  trackingUrl?: string;
  courierName?: string;
  courierPhone?: string;
  courierVehicle?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface Quote {
  id: string;
  pickupAddress: Record<string, unknown>;
  dropoffAddress: Record<string, unknown>;
  fee: number;
  estimatedMinutes: number;
  expiresAt: Date;
  status: "active" | "expired" | "used";
  createdAt: Date;
}

interface DeliveryStats {
  totalDeliveries: number;
  totalPending: number;
  totalAccepted: number;
  totalPickedUp: number;
  totalDelivered: number;
  totalCancelled: number;
  totalFailed: number;
  totalFees: number;
  totalTips: number;
}
```

## Notes

- Follows a quote-first flow: request a quote, then create a delivery referencing the `quoteId`.
- Quotes expire after 15 minutes and can only be used once (status transitions from `active` to `used`).
- Delivery creation validates the quote is `active` and not expired before proceeding.
- Deliveries in `delivered`, `cancelled`, or `failed` status cannot be updated.
- Events emitted: `uber-direct.delivery.created`, `uber-direct.delivery.picked-up`, `uber-direct.delivery.delivered`, `uber-direct.delivery.cancelled`, `uber-direct.quote.created`, `uber-direct.webhook.received`.
