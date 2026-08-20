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

# Favor Module

📚 **Documentation:** [86d.app/docs/modules/favor](https://86d.app/docs/modules/favor)

Favor delivery integration for 86d. Manage deliveries with zip-code-based service areas, runner assignment tracking, and delivery statistics.

## Installation

```sh
npm install @86d-app/favor
```

## Usage

```ts
import favor from "@86d-app/favor";

const module = favor({
  apiKey: "your-favor-api-key",
  merchantId: "your-merchant-id",
  sandbox: "true",
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | — | Favor API key |
| `merchantId` | `string` | — | Favor merchant ID |
| `sandbox` | `string` | `"true"` | Use sandbox mode |

## Store Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/favor/deliveries` | Create a delivery |
| GET | `/favor/deliveries/:id` | Get delivery by ID |
| POST | `/favor/availability` | Check availability by zip code |

## Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/favor/deliveries` | List all deliveries |
| POST | `/admin/favor/deliveries/:id/status` | Update delivery status |
| GET | `/admin/favor/service-areas` | List service areas |
| POST | `/admin/favor/service-areas/create` | Create a service area |
| GET | `/admin/favor/stats` | Get delivery stats |

## Controller API

```ts
interface FavorController extends ModuleController {
  createDelivery(params: CreateFavorDeliveryParams): Promise<FavorDelivery>;
  getDelivery(id: string): Promise<FavorDelivery | null>;
  cancelDelivery(id: string): Promise<FavorDelivery | null>;

  updateDeliveryStatus(
    id: string,
    status: FavorDelivery["status"],
    updates?: Partial<Pick<FavorDelivery,
      "externalId" | "runnerName" | "runnerPhone" | "trackingUrl" | "estimatedArrival" | "actualArrival"
    >>,
  ): Promise<FavorDelivery | null>;

  listDeliveries(params?: { status?: string; orderId?: string; take?: number; skip?: number }): Promise<FavorDelivery[]>;

  createServiceArea(params: CreateServiceAreaParams): Promise<ServiceArea>;
  updateServiceArea(id: string, params: UpdateServiceAreaParams): Promise<ServiceArea | null>;
  deleteServiceArea(id: string): Promise<boolean>;
  listServiceAreas(params?: { isActive?: boolean; take?: number; skip?: number }): Promise<ServiceArea[]>;

  checkAvailability(zipCode: string): Promise<{ available: boolean; area: ServiceArea | null }>;
  getDeliveryStats(): Promise<FavorDeliveryStats>;
}
```

## Types

```ts
interface FavorDelivery {
  id: string;
  orderId: string;
  externalId?: string;
  status: "pending" | "assigned" | "en-route" | "arrived" | "completed" | "cancelled";
  pickupAddress: Record<string, unknown>;
  dropoffAddress: Record<string, unknown>;
  estimatedArrival?: Date;
  actualArrival?: Date;
  fee: number;
  tip: number;
  runnerName?: string;
  runnerPhone?: string;
  trackingUrl?: string;
  specialInstructions?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface ServiceArea {
  id: string;
  name: string;
  isActive: boolean;
  zipCodes: string[];
  minOrderAmount: number;
  deliveryFee: number;
  estimatedMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

interface FavorDeliveryStats {
  totalDeliveries: number;
  totalPending: number;
  totalAssigned: number;
  totalEnRoute: number;
  totalCompleted: number;
  totalCancelled: number;
  totalFees: number;
  totalTips: number;
}
```

## Notes

- Availability is determined by matching a zip code against active service areas' `zipCodes` arrays.
- Deliveries in `completed` or `cancelled` status cannot be cancelled.
- Status updates can optionally include runner info (name, phone, tracking URL) and arrival times.
- Events emitted: `favor.delivery.created`, `favor.delivery.assigned`, `favor.delivery.completed`, `favor.delivery.cancelled`, `favor.webhook.received`.
