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

# Inventory Module

📚 **Documentation:** [86d.app/docs/modules/inventory](https://86d.app/docs/modules/inventory)

Stock tracking for products and variants. Manages on-hand quantity, reservations, backorder support, and low-stock alerts.

![version](https://img.shields.io/badge/version-0.0.1-blue) ![license](https://img.shields.io/badge/license-MIT-green)

## Installation

```sh
npm install @86d-app/inventory
```

## Usage

```ts
import inventory from "@86d-app/inventory";
import { createModuleClient } from "@86d-app/core";

const client = createModuleClient([
  inventory({
    defaultLowStockThreshold: 5,
  }),
]);
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `defaultLowStockThreshold` | `number` | `undefined` | Default low-stock threshold applied to items without an explicit threshold |

## Composite Key

Inventory items are identified by a composite key: `productId:variantId:locationId`, using `_` as a placeholder for missing segments.

```
prod_1:_:_       — product-level, no variant, no location
prod_1:var_1:_   — specific variant
prod_1:_:loc_1   — product at a specific location
prod_1:var_1:loc_1 — variant at a specific location
```

`available` is always computed as `Math.max(0, quantity - reserved)` and is never negative.

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/inventory/check` | Check if a product/variant is in stock |

Query parameters: `productId` (required), `variantId`, `locationId`, `quantity`

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/inventory` | List all inventory items |
| `POST` | `/admin/inventory/set` | Set absolute stock level (upsert) |
| `POST` | `/admin/inventory/adjust` | Adjust stock by a signed delta |
| `GET` | `/admin/inventory/low-stock` | List items below their low-stock threshold |

## Controller API

```ts
// Get the inventory record for a product/variant/location
controller.getStock(params: {
  productId: string;
  variantId?: string;
  locationId?: string;
}): Promise<InventoryItem | null>

// Set an absolute stock level — creates the record if it does not exist
controller.setStock(params: {
  productId: string;
  variantId?: string;
  locationId?: string;
  quantity: number;
  lowStockThreshold?: number;
  allowBackorder?: boolean;
}): Promise<InventoryItem>

// Adjust stock by a signed delta (positive = restock, negative = shrinkage)
// Returns null if the item does not exist
controller.adjustStock(params: {
  productId: string;
  variantId?: string;
  locationId?: string;
  delta: number;
}): Promise<InventoryItem | null>

// Reserve units for a pending order
// Returns null if available < quantity and allowBackorder is false
controller.reserve(params: {
  productId: string;
  variantId?: string;
  locationId?: string;
  quantity: number;
}): Promise<InventoryItem | null>

// Release a previous reservation (e.g. order cancelled)
// Returns null if the item does not exist
controller.release(params: {
  productId: string;
  variantId?: string;
  locationId?: string;
  quantity: number;
}): Promise<InventoryItem | null>

// Fulfill a reservation: decrement both quantity and reserved
// Call this when an order is shipped or delivered
// Returns null if the item does not exist
controller.deduct(params: {
  productId: string;
  variantId?: string;
  locationId?: string;
  quantity: number;
}): Promise<InventoryItem | null>

// Check if sufficient stock is available
// Returns true if no tracking record exists (unmanaged product = always in stock)
controller.isInStock(params: {
  productId: string;
  variantId?: string;
  locationId?: string;
  quantity?: number;
}): Promise<boolean>

// List items below their low-stock threshold
// Only returns items that have a threshold explicitly set
controller.getLowStockItems(params?: {
  locationId?: string;
}): Promise<InventoryItem[]>

// List all inventory items with optional filters
controller.listItems(params?: {
  productId?: string;
  locationId?: string;
  take?: number;
  skip?: number;
}): Promise<InventoryItem[]>
```

## Order Fulfillment Flow

```ts
// 1. Customer places order — reserve stock
await inventory.reserve({ productId, quantity });

// 2. Order is cancelled — release reservation
await inventory.release({ productId, quantity });

// 3. Order is shipped — deduct both quantity and reservation
await inventory.deduct({ productId, quantity });
```

## Types

```ts
interface InventoryItem {
  id: string;
  productId: string;
  variantId?: string;
  locationId?: string;
  /** Total units on hand */
  quantity: number;
  /** Units reserved for pending orders */
  reserved: number;
  /** Computed: Math.max(0, quantity - reserved) */
  available: number;
  lowStockThreshold?: number;
  allowBackorder: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

## Store Components

### BackInStockForm

Standalone email subscription form that lets customers sign up to be notified when an out-of-stock product becomes available again.

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `productId` | `string` | Yes | ID of the product to subscribe for |
| `variantId` | `string` | No | Optional variant ID for variant-level tracking |
| `productName` | `string` | No | Display name shown in confirmation text (defaults to "this product") |

#### Usage in MDX

```mdx
<BackInStockForm productId="prod_123" productName="Widget Pro" />
```

Use this component on product detail pages or out-of-stock product listings to capture restock interest.

### StockAvailability

Displays detailed stock status for a product including quantity available, low-stock warnings, and backorder availability.

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `productId` | `string` | Yes | ID of the product to check stock for |
| `variantId` | `string` | No | Optional variant ID for variant-level stock checks |
| `showQuantity` | `boolean` | No | Whether to display the available quantity number (defaults to `false`) |

#### Usage in MDX

```mdx
<StockAvailability productId="prod_123" showQuantity />
```

Use this component on product detail pages to show a detailed availability indicator with optional quantity display.

### StockStatus

Displays a minimal stock status indicator (in stock, low stock, out of stock, or backorder) for a product.

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `productId` | `string` | Yes | ID of the product to check stock for |
| `variantId` | `string` | No | Optional variant ID for variant-level stock checks |

#### Usage in MDX

```mdx
<StockStatus productId="prod_123" />
```

Use this component on product cards or listing pages where a compact stock indicator is needed.
