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

# Price Lists Module

📚 **Documentation:** [86d.app/docs/modules/price-lists](https://86d.app/docs/modules/price-lists)

Tiered and group-specific pricing for products. Create multiple price lists with priority-based resolution, quantity tiers, currency filtering, and customer group targeting.

## Installation

```sh
npm install @86d-app/price-lists
```

## Usage

```ts
import priceLists from "@86d-app/price-lists";

const module = priceLists({
  defaultCurrency: "USD",
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `defaultCurrency` | `string` | — | Default ISO 4217 currency code for new price lists |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/price-lists/:slug` | Get a price list by slug |
| `GET` | `/prices/product/:productId` | Resolve the best price for a single product |
| `POST` | `/prices/products` | Resolve prices for multiple products at once |

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/price-lists` | List all price lists (paginated, filterable) |
| `GET` | `/admin/price-lists/stats` | Get aggregate statistics |
| `POST` | `/admin/price-lists/create` | Create a new price list |
| `GET` | `/admin/price-lists/:id` | Get a price list by ID |
| `PUT` | `/admin/price-lists/:id/update` | Update a price list |
| `DELETE` | `/admin/price-lists/:id/delete` | Delete a price list and all its entries |
| `GET` | `/admin/price-lists/:id/entries` | List price entries in a list |
| `POST` | `/admin/price-lists/:id/entries/set` | Set a price entry (upserts) |
| `DELETE` | `/admin/price-lists/:id/entries/:productId/remove` | Remove a product's entries |
| `POST` | `/admin/price-lists/:id/entries/bulk` | Bulk set up to 500 entries |

## Controller API

The `PriceListController` interface is exported for use in inter-module contracts.

```ts
interface PriceListController {
  // Price Lists
  createPriceList(params: { name, slug, description?, currency?, priority?, status?, startsAt?, endsAt?, customerGroupId? }): Promise<PriceList>;
  getPriceList(id: string): Promise<PriceList | null>;
  getPriceListBySlug(slug: string): Promise<PriceList | null>;
  updatePriceList(id: string, params: { name?, slug?, description?, currency?, priority?, status?, startsAt?, endsAt?, customerGroupId? }): Promise<PriceList | null>;
  deletePriceList(id: string): Promise<boolean>;
  listPriceLists(params?: { status?, customerGroupId?, take?, skip? }): Promise<PriceList[]>;
  countPriceLists(params?: { status?, customerGroupId? }): Promise<number>;

  // Price Entries
  setPrice(params: { priceListId, productId, price, compareAtPrice?, minQuantity?, maxQuantity? }): Promise<PriceEntry>;
  getPrice(priceListId, productId): Promise<PriceEntry | null>;
  removePrice(priceListId, productId): Promise<boolean>;
  listPrices(priceListId, params?: { take?, skip? }): Promise<PriceEntry[]>;
  countPrices(priceListId): Promise<number>;
  bulkSetPrices(priceListId, entries: Array<{ productId, price, compareAtPrice?, minQuantity?, maxQuantity? }>): Promise<PriceEntry[]>;

  // Price Resolution
  resolvePrice(productId, params?: { customerGroupId?, quantity?, currency? }): Promise<ResolvedPrice | null>;
  resolvePrices(productIds, params?: { customerGroupId?, quantity?, currency? }): Promise<Record<string, ResolvedPrice>>;

  // Stats
  getStats(): Promise<PriceListStats>;
}
```

## Types

```ts
type PriceListStatus = "active" | "inactive" | "scheduled";

interface PriceList {
  id: string;
  name: string;
  slug: string;
  description?: string;
  currency?: string;
  priority: number;
  status: PriceListStatus;
  startsAt?: Date;
  endsAt?: Date;
  customerGroupId?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface PriceEntry {
  id: string;
  priceListId: string;
  productId: string;
  price: number;
  compareAtPrice?: number;
  minQuantity?: number;
  maxQuantity?: number;
  createdAt: Date;
}

interface ResolvedPrice {
  price: number;
  compareAtPrice: number | null;
  priceListId: string;
  priceListName: string;
}

interface PriceListStats {
  totalPriceLists: number;
  activePriceLists: number;
  scheduledPriceLists: number;
  inactivePriceLists: number;
  totalEntries: number;
  priceListsWithEntries: number;
}
```

## Admin Pages

| Page | Path | Description |
|------|------|-------------|
| Price Lists | `/admin/price-lists` | Dashboard with stats (active, scheduled, entries) and filterable list |
| Create | `/admin/price-lists/create` | Form with currency, priority, status, schedule dates, and customer group |
| Detail | `/admin/price-lists/:id` | View entries table with pricing, compare-at, qty ranges; add/remove entries inline; activate/deactivate/delete |

## Notes

- **Priority-based resolution**: Lower priority number = higher priority. The first matching price list wins.
- **Customer groups**: Lists with no `customerGroupId` are available to all customers. Lists with a group only match when that group is specified.
- **Quantity tiers**: A single product can have multiple price entries with different `minQuantity`/`maxQuantity` ranges. When multiple entries match, the lowest price wins.
- **Date-bounded lists**: Use `startsAt`/`endsAt` to schedule promotional pricing. Lists outside their date range are excluded from resolution even if `status` is "active".
- **Upsert behavior**: `setPrice` updates an existing entry if one exists for the same product and quantity tier.
- **Cascading delete**: Deleting a price list removes all associated price entries.
