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

# Flash Sales Module

📚 **Documentation:** [86d.app/docs/modules/flash-sales](https://86d.app/docs/modules/flash-sales)

Time-limited promotional events with per-product sale pricing, stock limits, and countdown timers. Creates urgency-driven shopping experiences with automatic availability based on date ranges and stock levels.

## Installation

```sh
npm install @86d-app/flash-sales
```

## Usage

```ts
import flashSales from "@86d-app/flash-sales";

const module = flashSales({
  maxProductsPerSale: 50,
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `maxProductsPerSale` | `number` | none | Maximum products allowed per flash sale |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/flash-sales` | List all currently active flash sales with products |
| `GET` | `/flash-sales/:slug` | Get a single active flash sale by slug |
| `GET` | `/flash-sales/product/:productId` | Check if a product has an active flash sale deal |
| `POST` | `/flash-sales/products` | Check multiple products for active deals (batch) |

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/flash-sales` | List flash sales (filterable by status, paginated) |
| `GET` | `/admin/flash-sales/stats` | Get flash sale statistics |
| `POST` | `/admin/flash-sales/create` | Create a new flash sale |
| `GET` | `/admin/flash-sales/:id` | Get flash sale details with products |
| `POST` | `/admin/flash-sales/:id/update` | Update a flash sale |
| `POST` | `/admin/flash-sales/:id/delete` | Delete a flash sale and all its products |
| `GET` | `/admin/flash-sales/:id/products` | List products in a flash sale (paginated) |
| `POST` | `/admin/flash-sales/:id/products/add` | Add a product to a flash sale |
| `POST` | `/admin/flash-sales/:id/products/:productId/remove` | Remove a product from a flash sale |
| `POST` | `/admin/flash-sales/:id/products/bulk` | Bulk add products to a flash sale |

## Store Components

| Component | Description |
|---|---|
| `FlashSaleListing` | Full-page listing of all active flash sales with product grids, countdown timers, discount badges, and stock progress bars |
| `FlashSaleDetail` | Single flash sale detail page with breadcrumb navigation, countdown, and product grid with add-to-cart buttons |
| `FlashSaleProductCard` | Individual product card showing discount badge, sale/original pricing, stock remaining bar, and add-to-cart |
| `FlashDealBadge` | Embeddable badge for product detail pages — shows flash sale name, pricing, countdown timer, and stock remaining |
| `Countdown` | Reusable live countdown timer (days/hours/minutes/seconds) with optional label and `onExpire` callback |

## Admin Pages

| Path | Component | Group | Description |
|------|-----------|-------|-------------|
| `/admin/flash-sales` | FlashSaleList | Sales | Stats dashboard (total/active/scheduled/products/units sold), status filter, sale list with status badges and date ranges, inline create form with datetime pickers |
| `/admin/flash-sales/:id` | FlashSaleDetail | — | Edit sale details (name, slug, description, status, start/end dates), product management with add form (product ID, original and sale prices in cents, stock limit) and product list showing discount percentages and stock tracking |

## Controller API

The `FlashSaleController` interface is exported for use in inter-module contracts.

```ts
interface FlashSaleController {
  // Flash sale CRUD
  createFlashSale(params): Promise<FlashSale>;
  getFlashSale(id: string): Promise<FlashSale | null>;
  getFlashSaleBySlug(slug: string): Promise<FlashSale | null>;
  updateFlashSale(id: string, params): Promise<FlashSale | null>;
  deleteFlashSale(id: string): Promise<boolean>;
  listFlashSales(params?): Promise<FlashSale[]>;
  countFlashSales(params?): Promise<number>;

  // Product management
  addProduct(params): Promise<FlashSaleProduct>;
  updateProduct(flashSaleId, productId, params): Promise<FlashSaleProduct | null>;
  removeProduct(flashSaleId, productId): Promise<boolean>;
  listProducts(flashSaleId, params?): Promise<FlashSaleProduct[]>;
  countProducts(flashSaleId): Promise<number>;
  bulkAddProducts(flashSaleId, products): Promise<FlashSaleProduct[]>;

  // Stock tracking
  recordSale(flashSaleId, productId, quantity): Promise<FlashSaleProduct | null>;

  // Storefront queries
  getActiveSales(): Promise<FlashSaleWithProducts[]>;
  getActiveProductDeal(productId): Promise<ActiveFlashSaleProduct | null>;
  getActiveProductDeals(productIds): Promise<Record<string, ActiveFlashSaleProduct>>;

  // Stats
  getStats(): Promise<FlashSaleStats>;
}
```

## Types

```ts
type FlashSaleStatus = "draft" | "scheduled" | "active" | "ended";

interface FlashSale {
  id: string;
  name: string;
  slug: string;
  description?: string;
  status: FlashSaleStatus;
  startsAt: Date;
  endsAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface FlashSaleProduct {
  id: string;
  flashSaleId: string;
  productId: string;
  salePrice: number;
  originalPrice: number;
  stockLimit?: number;
  stockSold: number;
  sortOrder: number;
  createdAt: Date;
}

interface ActiveFlashSaleProduct {
  productId: string;
  salePrice: number;
  originalPrice: number;
  discountPercent: number;
  stockLimit: number | null;
  stockSold: number;
  stockRemaining: number | null;
  flashSaleId: string;
  flashSaleName: string;
  endsAt: Date;
}

interface FlashSaleStats {
  totalSales: number;
  draftSales: number;
  scheduledSales: number;
  activeSales: number;
  endedSales: number;
  totalProducts: number;
  totalUnitsSold: number;
}
```

## Notes

- A flash sale is visible on the storefront only when `status` is `"active"` and the current time falls between `startsAt` and `endsAt`.
- Products are uniquely keyed by `flashSaleId + productId` — adding a product that already exists updates its pricing while preserving its `stockSold` count.
- When a product's `stockSold` reaches its `stockLimit`, it no longer appears in `getActiveProductDeal` results.
- Deleting a flash sale cascades to all its product entries.
- The `discountPercent` field is computed as `round((originalPrice - salePrice) / originalPrice * 100)`.
