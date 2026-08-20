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

# Bundles Module

📚 **Documentation:** [86d.app/docs/modules/bundles](https://86d.app/docs/modules/bundles)

Groups products into discounted bundles with support for fixed-price or percentage-off discounts, date-based availability windows, and configurable item limits.

## Installation

```sh
npm install @86d-app/bundles
```

## Usage

```ts
import bundles from "@86d-app/bundles";

const module = bundles({
  maxItemsPerBundle: 20,
  maxDiscountPercentage: 100,
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `maxItemsPerBundle` | `number` | `20` | Maximum number of products per bundle |
| `maxDiscountPercentage` | `number` | `100` | Maximum percentage discount allowed |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/bundles` | List all currently active bundles with items |
| `GET` | `/bundles/:slug` | Get a single active bundle by slug |

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/bundles` | List all bundles (filterable by status) |
| `POST` | `/admin/bundles/create` | Create a new bundle (starts as draft) |
| `GET` | `/admin/bundles/:id` | Get a bundle by ID |
| `PUT` | `/admin/bundles/:id/update` | Update bundle details |
| `DELETE` | `/admin/bundles/:id/delete` | Delete a bundle and its items |
| `GET` | `/admin/bundles/:id/items` | List items in a bundle |
| `POST` | `/admin/bundles/:id/items/add` | Add a product to a bundle |
| `DELETE` | `/admin/bundles/:id/items/:itemId/remove` | Remove an item from a bundle |
| `PUT` | `/admin/bundles/:id/items/:itemId/update` | Update item quantity or sort order |

## Controller API

The `BundleController` interface is exported for inter-module use.

```ts
interface BundleController {
  create(params: CreateBundleParams): Promise<Bundle>;
  get(id: string): Promise<Bundle | null>;
  getBySlug(slug: string): Promise<Bundle | null>;
  list(params?: { status?: string; take?: number; skip?: number }): Promise<Bundle[]>;
  update(id: string, data: Partial<Bundle>): Promise<Bundle | null>;
  delete(id: string): Promise<boolean>;
  addItem(params: AddBundleItemParams): Promise<BundleItem>;
  removeItem(itemId: string): Promise<boolean>;
  listItems(bundleId: string): Promise<BundleItem[]>;
  updateItem(itemId: string, data: Partial<Pick<BundleItem, "quantity" | "sortOrder">>): Promise<BundleItem | null>;
  getWithItems(id: string): Promise<BundleWithItems | null>;
  getActiveBySlug(slug: string): Promise<BundleWithItems | null>;
  listActive(params?: { take?: number; skip?: number }): Promise<BundleWithItems[]>;
  countAll(): Promise<number>;
}
```

## Types

```ts
interface Bundle {
  id: string;
  name: string;
  slug: string;
  description?: string;
  status: "active" | "draft" | "archived";
  discountType: "fixed" | "percentage";
  discountValue: number;
  minQuantity?: number;
  maxQuantity?: number;
  startsAt?: string;
  endsAt?: string;
  imageUrl?: string;
  sortOrder?: number;
  createdAt: Date;
  updatedAt: Date;
}

interface BundleItem {
  id: string;
  bundleId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  sortOrder?: number;
  createdAt: Date;
}

interface BundleWithItems extends Bundle {
  items: BundleItem[];
}
```

## Store Components

### BundleDetail

Fetches and displays a single product bundle by its slug, including bundle items and discount information.

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `slug` | `string` | Yes | URL slug of the bundle to display |

#### Usage in MDX

```mdx
<BundleDetail slug="starter-kit" />
```

Use this component on a dedicated bundle detail page to show a single bundle with its products and pricing.

### BundleList

Fetches and displays all available product bundles with their discount information.

#### Props

None. The component manages its own state and fetches data via the module client.

#### Usage in MDX

```mdx
<BundleList />
```

Use this component on a bundles landing page or promotional section to showcase all active bundles.

## Notes

- New bundles always start in `draft` status. Set `status: "active"` via update to publish.
- A bundle is considered "active" only if its status is `active` AND the current date falls within `startsAt`/`endsAt` (if set).
- Store endpoints return only active bundles; admin endpoints return all bundles.
- Store lookup uses the URL-safe `slug`; admin lookup uses `id`.
- Deleting a bundle cascades to its bundle items.
