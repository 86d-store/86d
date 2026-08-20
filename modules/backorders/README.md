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

# Backorders Module

📚 **Documentation:** [86d.app/docs/modules/backorders](https://86d.app/docs/modules/backorders)

Backorder management for out-of-stock products. Allows customers to place orders for unavailable items, with configurable per-product policies, capacity limits, and a full status lifecycle from request through delivery.

## Installation

```sh
npm install @86d-app/backorders
```

## Usage

```ts
import backorders from "@86d-app/backorders";

const module = backorders({
  defaultLeadDays: "14",
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `defaultLeadDays` | `string` | — | Default lead time in days for products without a specific policy |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/backorders/create` | Place a backorder for an out-of-stock product |
| `GET` | `/backorders/check/:productId` | Check if a product is eligible for backorder |
| `GET` | `/backorders/mine` | List the current customer's backorders |
| `GET` | `/backorders/:id` | Get a specific backorder's details |
| `POST` | `/backorders/:id/cancel` | Cancel a backorder |

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/backorders` | List all backorders (filterable, paginated) |
| `GET` | `/admin/backorders/:id` | Get backorder details |
| `GET` | `/admin/backorders/summary` | Dashboard summary with status counts and top products |
| `POST` | `/admin/backorders/:id/status` | Update a backorder's status |
| `POST` | `/admin/backorders/:id/cancel` | Cancel a backorder with optional reason |
| `POST` | `/admin/backorders/bulk-status` | Bulk update status for multiple backorders |
| `POST` | `/admin/backorders/allocate` | Allocate incoming stock to confirmed backorders (FIFO) |
| `GET` | `/admin/backorders/policies` | List all backorder policies |
| `POST` | `/admin/backorders/policies/set` | Create or update a product's backorder policy |
| `GET` | `/admin/backorders/policies/:productId` | Get a product's backorder policy |
| `POST` | `/admin/backorders/policies/:productId/delete` | Delete a product's backorder policy |

## Admin UI

The module includes admin UI components in `src/admin/components/index.tsx` (client components using `useModuleClient`):

| Page | Component | Description |
|------|-----------|-------------|
| `/admin/backorders` | `BackorderList` | Backorder list with status filters, status updates, and stock allocation |
| `/admin/backorders/policies` | `BackorderPolicies` | Per-product backorder policy management |

## Controller API

```ts
interface BackordersController {
  createBackorder(params: {
    productId: string;
    productName: string;
    variantId?: string;
    variantLabel?: string;
    customerId: string;
    customerEmail: string;
    orderId?: string;
    quantity: number;
    estimatedAvailableAt?: Date;
    notes?: string;
  }): Promise<Backorder | null>;

  getBackorder(id: string): Promise<Backorder | null>;
  listBackorders(params?: { productId?; customerId?; status?; take?; skip? }): Promise<Backorder[]>;
  countByProduct(productId: string): Promise<number>;
  updateStatus(id: string, status: BackorderStatus, reason?: string): Promise<Backorder | null>;
  bulkUpdateStatus(ids: string[], status: BackorderStatus): Promise<{ updated: number }>;
  allocateStock(productId: string, quantity: number): Promise<{ allocated: number; backorderIds: string[] }>;
  cancelBackorder(id: string, reason?: string): Promise<Backorder | null>;
  getCustomerBackorders(customerId: string, params?: { take?; skip? }): Promise<Backorder[]>;

  setPolicy(params: { productId; enabled; maxQuantityPerOrder?; maxTotalBackorders?; estimatedLeadDays?; autoConfirm?; message? }): Promise<BackorderPolicy>;
  getPolicy(productId: string): Promise<BackorderPolicy | null>;
  listPolicies(params?: { enabled?; take?; skip? }): Promise<BackorderPolicy[]>;
  deletePolicy(productId: string): Promise<boolean>;

  checkEligibility(productId: string, quantity: number): Promise<{ eligible: boolean; reason?; estimatedLeadDays?; message? }>;
  getSummary(): Promise<BackorderSummary>;
}
```

## Types

```ts
type BackorderStatus = "pending" | "confirmed" | "allocated" | "shipped" | "delivered" | "cancelled";

interface Backorder {
  id: string;
  productId: string;
  productName: string;
  variantId?: string;
  variantLabel?: string;
  customerId: string;
  customerEmail: string;
  orderId?: string;
  quantity: number;
  status: BackorderStatus;
  estimatedAvailableAt?: Date;
  allocatedAt?: Date;
  shippedAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface BackorderPolicy {
  id: string;
  productId: string;
  enabled: boolean;
  maxQuantityPerOrder?: number;
  maxTotalBackorders?: number;
  estimatedLeadDays?: number;
  autoConfirm: boolean;
  message?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface BackorderSummary {
  totalPending: number;
  totalConfirmed: number;
  totalAllocated: number;
  totalShipped: number;
  totalDelivered: number;
  totalCancelled: number;
  topProducts: Array<{ productId: string; productName: string; count: number }>;
}
```

## Status Lifecycle

```
pending → confirmed → allocated → shipped → delivered
    ↘         ↘           ↘
              cancelled
```

- **pending**: Customer placed backorder, awaiting admin review
- **confirmed**: Admin approved (or auto-confirmed by policy)
- **allocated**: Stock has arrived and been assigned to this backorder
- **shipped**: Backorder has been shipped to customer
- **delivered**: Customer received the order
- **cancelled**: Backorder was cancelled (any active status)

## Store Components

| Component | Description |
|-----------|-------------|
| `BackorderButton` | Button to place a backorder for an out-of-stock product |
| `MyBackorders` | List of the current customer's backorders with status tracking |

### Usage

```tsx
import { BackorderButton, MyBackorders } from "@86d-app/backorders/store/components";

<BackorderButton productId="abc-123" />
<MyBackorders customerId="customer-456" />
```

## Notes

- Backorder policies are per-product. Products without a policy accept backorders with `pending` status.
- `allocateStock` processes confirmed backorders FIFO (oldest first). It only allocates if the full quantity can be satisfied.
- `maxTotalBackorders` limits are checked against active backorders only (pending + confirmed + allocated). Cancelled and delivered backorders don't count.
- The module requires the `inventory` module and complements its `allowBackorder` flag.
