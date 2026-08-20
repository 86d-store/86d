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

# DoorDash Module

📚 **Documentation:** [86d.app/docs/modules/doordash](https://86d.app/docs/modules/doordash)

DoorDash delivery integration for 86d. Manage deliveries, define delivery zones with radius-based availability checks, and track driver assignments in real time.

## Installation

```sh
npm install @86d-app/doordash
```

## Usage

```ts
import doordash from "@86d-app/doordash";

const module = doordash({
  apiKey: "your-doordash-api-key",
  businessId: "your-business-id",
  sandbox: "true",
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | — | DoorDash API key |
| `businessId` | `string` | — | DoorDash business ID |
| `sandbox` | `string` | `"true"` | Use sandbox mode |

## Store Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/doordash/deliveries` | Create a delivery |
| GET | `/doordash/deliveries/:id` | Get delivery by ID |
| POST | `/doordash/availability` | Check delivery availability by lat/lng |

## Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/doordash/deliveries` | List all deliveries |
| POST | `/admin/doordash/deliveries/create` | Create a delivery (admin) |
| POST | `/admin/doordash/deliveries/:id/status` | Update delivery status |
| GET | `/admin/doordash/zones` | List delivery zones |
| POST | `/admin/doordash/zones/create` | Create a delivery zone |
| POST | `/admin/doordash/zones/:id` | Update a delivery zone |
| POST | `/admin/doordash/zones/:id/delete` | Delete a delivery zone |

## Controller API

```ts
interface DoordashController extends ModuleController {
  createDelivery(params: {
    orderId: string;
    pickupAddress: Record<string, unknown>;
    dropoffAddress: Record<string, unknown>;
    fee: number;
    tip?: number;
    metadata?: Record<string, unknown>;
  }): Promise<Delivery>;

  getDelivery(id: string): Promise<Delivery | null>;
  cancelDelivery(id: string): Promise<Delivery | null>;
  updateDeliveryStatus(id: string, status: DeliveryStatus): Promise<Delivery | null>;
  listDeliveries(params?: { status?: DeliveryStatus; take?: number; skip?: number }): Promise<Delivery[]>;

  createZone(params: {
    name: string;
    radius: number;
    centerLat: number;
    centerLng: number;
    minOrderAmount?: number;
    deliveryFee: number;
    estimatedMinutes: number;
  }): Promise<DeliveryZone>;

  updateZone(id: string, params: Partial<DeliveryZone>): Promise<DeliveryZone | null>;
  deleteZone(id: string): Promise<boolean>;
  listZones(params?: { isActive?: boolean; take?: number; skip?: number }): Promise<DeliveryZone[]>;
  checkDeliveryAvailability(address: { lat: number; lng: number }): Promise<DeliveryAvailability>;
}
```

## Types

```ts
type DeliveryStatus = "pending" | "accepted" | "picked-up" | "delivered" | "cancelled";

interface Delivery {
  id: string;
  orderId: string;
  externalDeliveryId?: string;
  status: DeliveryStatus;
  pickupAddress: Record<string, unknown>;
  dropoffAddress: Record<string, unknown>;
  estimatedPickupTime?: Date;
  estimatedDeliveryTime?: Date;
  actualPickupTime?: Date;
  actualDeliveryTime?: Date;
  fee: number;
  tip: number;
  trackingUrl?: string;
  driverName?: string;
  driverPhone?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface DeliveryZone {
  id: string;
  name: string;
  isActive: boolean;
  radius: number;
  centerLat: number;
  centerLng: number;
  minOrderAmount: number;
  deliveryFee: number;
  estimatedMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

interface DeliveryAvailability {
  available: boolean;
  zone?: DeliveryZone;
  estimatedMinutes?: number;
  deliveryFee?: number;
}
```

## Notes

- Zone availability uses haversine distance calculation (miles) to match customer coordinates against zone radius.
- Deliveries in `delivered` or `cancelled` status cannot be further updated.
- `actualPickupTime` and `actualDeliveryTime` are automatically set when status transitions to `picked-up` or `delivered`.
- Events emitted: `doordash.delivery.created`, `doordash.delivery.picked-up`, `doordash.delivery.delivered`, `doordash.delivery.cancelled`, `doordash.webhook.received`.
