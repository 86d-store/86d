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

# Products Module

> [!IMPORTANT]
> New Product and Variant prices are integer minor units. Inventory owns stock,
> so Product stock mutations are rejected. Collections owns Collection writes;
> the Products collection routes are compatibility reads only. Direct import is
> unavailable while its upload, diagnostics, diff, and Review transport remain
> unfinished. The owner-local immutable revision and presentation projection
> exist, but import, admin CRUD, and live product-feed generation have not moved
> to that path yet.

📚 **Documentation:** [86d.app/docs/modules/products](https://86d.app/docs/modules/products)

Product catalog module with variants and hierarchical categories. Full CRUD for the admin panel and read-only browsing with search and filtering for the storefront.

## Installation

```sh
npm install @86d-app/products
```

## Usage

```ts
import products from "@86d-app/products";

const module = products({
  defaultPageSize: 20,
  maxPageSize: 100,
  trackInventory: true,
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `defaultPageSize` | `number` | `20` | Default number of products per page |
| `maxPageSize` | `number` | `100` | Maximum products per page |
| `trackInventory` | `boolean` | `true` | Enable inventory tracking by default |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/products` | List active products (paginated, filterable) |
| `GET` | `/products/featured` | Get featured products |
| `GET` | `/products/:slug` | Get a single product by slug (includes variants) |
| `GET` | `/products/search?q=` | Search products by name, description, or tags |
| `GET` | `/products/store-search` | Full-text product search |
| `GET` | `/products/related/:id` | Get related products by category/tag scoring |
| `GET` | `/categories` | List visible categories |
| `GET` | `/categories/:slug` | Get a single category by slug |
| `GET` | `/collections` | List visible collections |
| `GET` | `/collections/:slug` | Get a collection with its active products |

Query parameters for `GET /products`:

| Param | Type | Description |
|---|---|---|
| `page` | `number` | Page number (default `1`) |
| `limit` | `number` | Items per page (capped at `maxPageSize`) |
| `category` | `string` | Filter by category slug |
| `status` | `string` | Product status (storefront always uses `active`) |
| `featured` | `boolean` | Filter featured products |

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/admin/products` | Create a new product |
| `GET` | `/admin/products/list` | List all products (all statuses) |
| `GET` | `/admin/products/:id` | Get a product by ID |
| `PUT` | `/admin/products/:id` | Update a product |
| `DELETE` | `/admin/products/:id` | Delete a product |
| `POST` | `/admin/products/:productId/variants` | Add a variant to a product |
| `PUT` | `/admin/variants/:id` | Update a variant |
| `DELETE` | `/admin/variants/:id` | Delete a variant |
| `POST` | `/admin/categories` | Create a category |
| `GET` | `/admin/categories/list` | List all categories |
| `PUT` | `/admin/categories/:id` | Update a category |
| `DELETE` | `/admin/categories/:id` | Delete a category |
| `GET` | `/admin/collections/list` | List all collections |
| `POST` | `/admin/products/bulk-action` | Bulk update status or delete |
| `POST` | `/admin/products/import` | Contained; returns `PRODUCT_IMPORT_REVIEW_REQUIRED` |
| `POST` | `/admin/catalog/revisions/create` | Create an immutable Catalog draft |
| `GET` | `/admin/catalog/revisions/list` | List revision summaries |
| `GET` | `/admin/catalog/revisions/:id` | Read one immutable revision and its content |
| `POST` | `/admin/catalog/revisions/:id/review` | Review the expected content digest |
| `POST` | `/admin/catalog/revisions/:id/publish` | Publish against the recorded base revision |

## Service API

A typed service layer is available via `createProductController(data)` from `service-impl.ts`:

```ts
import { createProductController } from "@86d-app/products/service-impl";

const ctrl = createProductController(dataService);
const product = await ctrl.createProduct({ name: "Widget", slug: "widget", price: 2999 });
const variants = await ctrl.getVariantsByProduct(product.id);
await ctrl.addProductToCollection(collectionId, product.id);
const result = await ctrl.importProducts([{ name: "Gadget", price: 1999 }]);
```

## Catalog revision foundation

`applyCatalogRevisionOperation(transaction, input, context)` is the narrow,
Products-owned interface for future Catalog Commands. It accepts normalized
Product, Variant, accepted Category, currency, and integer-minor-unit facts and
supports these transitions:

```text
create_draft -> draft -> review -> reviewed -> publish -> published
                    \-> fail -> failed       \-> fail -> failed
published -> superseded (only when its reviewed successor publishes)
```

Revision content and its SHA-256 digest never change after draft creation. Every
operation locks the owner-local Catalog aggregate, records its actor and
authority in an audit row, and writes a replay receipt. Publish compares the
draft's recorded base revision to the locked published head; a stale base returns
`stale_base_revision` without changing state. The new revision, supersession of
the prior revision, audit rows, replay receipt, and `catalog.published@1` outbox
fact commit in the caller's transaction.

The authenticated Store Admin transport derives its Account actor, Store
authority, and Store target from the session. Callers provide a stable operation
ID; review and publish also provide the server-issued content digest. All writes
return 503 unless the Runtime supplies owner-local locking and transactional
durable-event storage. Reads validate stored data and list bounded summaries.

Direct spreadsheet import continues to return
`PRODUCT_IMPORT_REVIEW_REQUIRED`, and product-feed generation continues to fail
closed until its projection adapter is connected. Existing Product CRUD is
migration state and does not claim to be revision-backed.

### Published Catalog presentation

The Products Module registers `products.catalog-presentation.v1` as a durable
consumer of `catalog.published@1`. It validates the event against the immutable
revision, recomputes the content digest, and replaces one owner-local
`catalogPresentation` row. That row contains three views built from the same
revision: active and visible Storefront data, product search documents, and
feed-facing product data with explicit minor-unit prices.

An exact replay is a no-op. A publication below the projected revision sequence
is ignored, while a conflicting sequence or mismatched revision fails delivery.
The runtime runs the handler and its delivery receipt in one transaction, so a
failure leaves the last good presentation readable and visible in the durable
delivery retry or dead-letter state. Repairing a transient source problem lets
the same event replay successfully.

Use `readCatalogPresentation(data)` to read and validate the current projection.
The consumer is fully standalone and makes no 86d.app or Control Plane call.
Legacy Storefront endpoints, the Search Module's external index, and generated
channel feeds still require explicit adapters before they become revision-backed.

## Controller API

Controllers are accessed via the runtime context. Five sub-controllers are available: `product`, `variant`, `category`, `bulk`, `collection`, and `import`.

```ts
// product controller
context.controllers.product.getById(ctx)        // Product | null
context.controllers.product.getBySlug(ctx)       // Product | null
context.controllers.product.getWithVariants(ctx) // ProductWithVariants | null
context.controllers.product.list(ctx)            // { products: Product[]; total: number }
context.controllers.product.create(ctx)          // Product
context.controllers.product.update(ctx)          // Product | null
context.controllers.product.delete(ctx)          // void

// variant controller
context.controllers.variant.create(ctx)          // ProductVariant
context.controllers.variant.update(ctx)          // ProductVariant | null
context.controllers.variant.delete(ctx)          // void

// category controller
context.controllers.category.getById(ctx)        // Category | null
context.controllers.category.getBySlug(ctx)      // Category | null
context.controllers.category.list(ctx)           // { categories: Category[]; total: number }
context.controllers.category.getTree(ctx)        // Category[]  (hierarchical)
context.controllers.category.create(ctx)         // Category
context.controllers.category.update(ctx)         // Category | null
context.controllers.category.delete(ctx)         // void
```

Each controller method receives a `ctx` object:

```ts
{
  context: { data: ModuleDataService };
  params: Record<string, string>;
  query: Record<string, string>;
  body: Record<string, unknown>;
}
```

## Types

```ts
interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  price: number;               // in cents
  compareAtPrice?: number;
  costPrice?: number;
  sku?: string;
  barcode?: string;
  inventory: number;
  trackInventory: boolean;
  allowBackorder: boolean;
  status: "draft" | "active" | "archived";
  categoryId?: string;
  images: string[];
  tags: string[];
  isFeatured: boolean;
  weight?: number;
  weightUnit?: "kg" | "lb" | "oz" | "g";
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku?: string;
  price: number;
  compareAtPrice?: number;
  costPrice?: number;
  inventory: number;
  options: Record<string, string>; // e.g. { size: "M", color: "Blue" }
  images: string[];
  position: number;
  weight?: number;
  weightUnit?: "kg" | "lb" | "oz" | "g";
  createdAt: Date;
  updatedAt: Date;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;           // Self-referential for nested categories
  image?: string;
  position: number;
  isVisible: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface ProductWithVariants extends Product {
  variants: ProductVariant[];
  category?: Category;
}
```

## Store Components

### ProductCard

Displays a single product card with image, name, price, discount badge, and optional "Add to Cart" button.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `product` | `Product` | — | Product object with id, name, slug, price, images, etc. |
| `showAddToCart` | `boolean` | `true` | Show the "Add to Cart" button |

#### Usage in MDX

```mdx
<ProductCard product={product} />

<ProductCard product={product} showAddToCart={false} />
```

### FeaturedProducts

Displays a responsive grid of featured products. Fetches its own data.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `limit` | `number` | — | Max number of featured products to display |
| `title` | `string` | — | Section heading |

#### Usage in MDX

```mdx
<FeaturedProducts />

<FeaturedProducts limit={4} title="Staff Picks" />
```

### ProductListing

Full product listing with search, category/price/stock/tag filters, sorting, and pagination. Fetches its own data.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `initialCategory` | `string` | — | Pre-select a category filter |
| `initialSearch` | `string` | — | Pre-fill the search query |
| `pageSize` | `number` | — | Products per page |

#### Usage in MDX

```mdx
<ProductListing />

<ProductListing initialCategory="shoes" pageSize={12} />
```

### ProductDetail

Full product detail page with image gallery, variant selector, pricing, inventory status, reviews, and related products. Fetches its own data.

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `slug` | `string` | Product slug (from URL) |
| `params` | `Record<string, string>` | Route params (params.slug) |

#### Usage

Loaded dynamically by the store catch-all route for `/products/:slug`.

### RelatedProducts

Horizontal grid of related products for a given product. Fetches its own data.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `productId` | `string` | — | Product ID to find related products for |
| `limit` | `number` | — | Max related products to show |
| `title` | `string` | — | Section heading |

#### Usage in MDX

```mdx
<RelatedProducts productId={product.id} />

<RelatedProducts productId={product.id} limit={4} title="You may also like" />
```

### CollectionCard

Displays a single collection card with image, name, and description.

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `collection` | `CollectionCardData` | Collection object with id, name, slug, description, image |

#### Usage in MDX

```mdx
<CollectionCard collection={collection} />
```

### CollectionGrid

Grid of collections with optional featured-only filtering. Fetches its own data.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | — | Section heading |
| `featured` | `boolean` | — | Only show featured collections |

#### Usage in MDX

```mdx
<CollectionGrid />

<CollectionGrid title="Shop by Category" featured={true} />
```

### CollectionDetail

Full collection page with image, description, product count, and products grid. Fetches its own data.

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `slug` | `string` | Collection slug (from URL) |
| `params` | `Record<string, string>` | Route params (params.slug) |

#### Usage

Loaded dynamically by the store catch-all route for `/collections/:slug`.

### FilterChip

Small removable tag displaying an active filter. Used internally by ProductListing.

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `label` | `string` | Filter display text |
| `onRemove` | `() => void` | Callback when the chip is dismissed |

#### Usage in MDX

```mdx
<FilterChip label="Shoes" onRemove={handleRemove} />
```

### StarDisplay

Read-only star rating display.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `rating` | `number` | — | Rating value (0–5) |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Star size |

#### Usage in MDX

```mdx
<StarDisplay rating={4.5} />

<StarDisplay rating={product.averageRating} size="sm" />
```

### StarPicker

Interactive star rating input for review submission.

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `value` | `number` | Current rating value |
| `onChange` | `(n: number) => void` | Callback when user selects a rating |

#### Usage in MDX

```mdx
<StarPicker value={rating} onChange={setRating} />
```

### StockBadge

Inventory status badge. Shows "Out of stock", "Only X left", or "In stock".

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `inventory` | `number` | Available inventory count |

#### Usage in MDX

```mdx
<StockBadge inventory={product.inventory} />
```

### ProductReviewsSection

Complete review section with rating summary, review list with pagination, and review submission form. Fetches its own data.

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `productId` | `string` | Product ID to show reviews for |

#### Usage in MDX

```mdx
<ProductReviewsSection productId={product.id} />
```

## Notes

- Store endpoints return only `active` products; admin endpoints return all statuses (`draft`, `active`, `archived`).
- Product IDs are prefixed: `prod_` (UUID in service-impl, timestamp in raw controllers). Variant: `var_`, Category: `cat_`, Collection: `col_`.
- Deleting a category orphans its child categories and products (sets `categoryId`/`parentId` to `undefined`) rather than cascading.
- Deleting a product cascades to all its variants. Deleting a collection cascades to collection-product links.
- `getTree()` builds a hierarchical category tree from the flat list using `parentId` references.
- `addProductToCollection` prevents duplicates — returns existing link if product is already in the collection.
- Import converts dollar prices to cents (`price * 100`), resolves categories by name (case-insensitive), and deduplicates slugs.
- Inventory decrement has no floor — inventory can go negative (documented behavior).
- Products with `trackInventory: false` skip all inventory decrement/increment operations.
