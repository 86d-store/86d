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

# Vendors Module

📚 **Documentation:** [86d.app/docs/modules/vendors](https://86d.app/docs/modules/vendors)

Multi-vendor marketplace module for managing vendor profiles, product assignments, commission rates, and payout tracking. Enables store owners to operate a marketplace where multiple vendors sell through a single storefront.

## Installation

```sh
npm install @86d-app/vendors
```

## Usage

```ts
import vendors from "@86d-app/vendors";

const module = vendors({
  defaultCommissionRate: "15",
  requireApproval: "true",
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `defaultCommissionRate` | `string` | `"10"` | Default commission percentage for new vendors |
| `requireApproval` | `string` | `"true"` | Whether new vendor applications require admin approval |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/vendors` | List active vendors (paginated) |
| `GET` | `/vendors/:slug` | Get a vendor profile by slug |
| `GET` | `/vendors/:vendorId/products` | List active products for a vendor |
| `POST` | `/vendors/apply` | Submit a vendor application |

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/vendors` | List all vendors with optional status filter |
| `POST` | `/admin/vendors/create` | Create a new vendor |
| `GET` | `/admin/vendors/stats` | Get marketplace statistics |
| `GET` | `/admin/vendors/:id` | Get vendor details |
| `PATCH` | `/admin/vendors/:id/update` | Update vendor profile |
| `DELETE` | `/admin/vendors/:id/delete` | Delete vendor (cascades to products and payouts) |
| `PATCH` | `/admin/vendors/:id/status` | Update vendor status |
| `GET` | `/admin/vendors/:vendorId/products` | List vendor's product assignments |
| `POST` | `/admin/vendors/:vendorId/products/assign` | Assign a product to a vendor |
| `DELETE` | `/admin/vendors/:vendorId/products/:productId/unassign` | Unassign a product |
| `GET` | `/admin/vendors/:vendorId/payouts` | List vendor payouts |
| `POST` | `/admin/vendors/:vendorId/payouts/create` | Create a payout for a vendor |
| `PATCH` | `/admin/vendors/payouts/:id/status` | Update payout status |
| `GET` | `/admin/vendors/payouts/stats` | Get payout statistics |

## Admin UI

The module includes admin UI components in `src/admin/components/index.tsx` (client components using `useModuleClient`):

| Page | Component | Description |
|------|-----------|-------------|
| `/admin/vendors` | `VendorAdmin` | Vendor list with status filters, create/edit forms, and status management |
| `/admin/vendors/payouts` | `VendorPayouts` | Payout list with status tracking and payout creation |

## Controller API

The `VendorController` interface is exported for inter-module contracts.

```ts
interface VendorController {
  // Vendors
  createVendor(params: { name, slug, email, ... }): Promise<Vendor>;
  getVendor(id: string): Promise<Vendor | null>;
  getVendorBySlug(slug: string): Promise<Vendor | null>;
  updateVendor(id: string, params: { ... }): Promise<Vendor | null>;
  deleteVendor(id: string): Promise<boolean>;
  listVendors(params?: { status?, take?, skip? }): Promise<Vendor[]>;
  countVendors(params?: { status? }): Promise<number>;
  updateVendorStatus(id: string, status: VendorStatus): Promise<Vendor | null>;

  // Product assignments
  assignProduct(params: { vendorId, productId, commissionOverride? }): Promise<VendorProduct>;
  unassignProduct(params: { vendorId, productId }): Promise<boolean>;
  listVendorProducts(params: { vendorId, status?, take?, skip? }): Promise<VendorProduct[]>;
  countVendorProducts(params: { vendorId, status? }): Promise<number>;
  getProductVendor(productId: string): Promise<Vendor | null>;

  // Payouts
  createPayout(params: { vendorId, amount, currency, ... }): Promise<VendorPayout>;
  getPayout(id: string): Promise<VendorPayout | null>;
  updatePayoutStatus(id: string, status: PayoutStatus): Promise<VendorPayout | null>;
  listPayouts(params?: { vendorId?, status?, take?, skip? }): Promise<VendorPayout[]>;
  countPayouts(params?: { vendorId?, status? }): Promise<number>;
  getPayoutStats(vendorId?: string): Promise<PayoutStats>;

  // Admin
  getStats(): Promise<VendorStats>;
}
```

## Types

```ts
type VendorStatus = "pending" | "active" | "suspended" | "closed";
type VendorProductStatus = "active" | "paused";
type PayoutStatus = "pending" | "processing" | "completed" | "failed";

interface Vendor {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone?: string;
  description?: string;
  logo?: string;
  banner?: string;
  website?: string;
  commissionRate: number;
  status: VendorStatus;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  metadata?: Record<string, unknown>;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface VendorProduct {
  id: string;
  vendorId: string;
  productId: string;
  commissionOverride?: number;
  status: VendorProductStatus;
  createdAt: Date;
}

interface VendorPayout {
  id: string;
  vendorId: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  method?: string;
  reference?: string;
  periodStart: Date;
  periodEnd: Date;
  notes?: string;
  createdAt: Date;
  completedAt?: Date;
}
```

## Notes

- Vendors start as `pending` and must be approved by an admin (status → `active`) before they appear in store endpoints.
- Product assignment is idempotent — assigning the same product twice returns the existing record.
- Deleting a vendor cascades to all product assignments and payouts.
- Commission can be overridden per-product via `commissionOverride` on the product assignment.
- The `completedAt` timestamp is automatically set when a payout status transitions to `completed`.
