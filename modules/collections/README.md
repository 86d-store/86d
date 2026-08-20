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

# Collections Module

📚 **Documentation:** [86d.app/docs/modules/collections](https://86d.app/docs/modules/collections)

Curated product collections for merchandising. Create manual collections with hand-picked products, or automatic collections with rule-based conditions. Supports featured collections, SEO fields, product ordering, and bulk operations.

## Installation

```sh
npm install @86d-app/collections
```

## Usage

```ts
import collections from "@86d-app/collections";

const module = collections({
  maxProductsPerCollection: "500",
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `maxProductsPerCollection` | `string` | `"500"` | Maximum products allowed per collection |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/collections` | List active collections (filterable by type, featured) |
| `GET` | `/collections/featured` | Get featured collections |
| `GET` | `/collections/:slug` | Get a single collection by slug |
| `GET` | `/collections/:slug/products` | Get products in a collection (paginated) |
| `GET` | `/collections/product/:productId` | Get all collections containing a product |

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/collections` | List all collections (filterable, paginated) |
| `GET` | `/admin/collections/stats` | Get collection statistics |
| `POST` | `/admin/collections/create` | Create a new collection |
| `POST` | `/admin/collections/:id/update` | Update a collection |
| `POST` | `/admin/collections/:id/delete` | Delete a collection and its product associations |
| `GET` | `/admin/collections/:id/products` | List products in a collection (paginated) |
| `POST` | `/admin/collections/:id/products/add` | Add products to a collection |
| `POST` | `/admin/collections/:id/products/remove` | Remove products from a collection |
| `POST` | `/admin/collections/:id/products/reorder` | Reorder products within a collection |

## Controller API

```ts
interface CollectionController {
  createCollection(params: {
    title: string;
    slug: string;
    type: CollectionType;
    description?: string;
    image?: string;
    sortOrder?: CollectionSortOrder;
    isActive?: boolean;
    isFeatured?: boolean;
    position?: number;
    conditions?: CollectionConditions;
    seoTitle?: string;
    seoDescription?: string;
    publishedAt?: Date;
  }): Promise<Collection>;

  getCollection(id: string): Promise<Collection | null>;
  getCollectionBySlug(slug: string): Promise<Collection | null>;

  updateCollection(id: string, params: {
    title?: string;
    slug?: string;
    description?: string | null;
    image?: string | null;
    type?: CollectionType;
    sortOrder?: CollectionSortOrder;
    isActive?: boolean;
    isFeatured?: boolean;
    position?: number;
    conditions?: CollectionConditions | null;
    seoTitle?: string | null;
    seoDescription?: string | null;
    publishedAt?: Date | null;
  }): Promise<Collection | null>;

  deleteCollection(id: string): Promise<boolean>;

  listCollections(params?: {
    isActive?: boolean;
    isFeatured?: boolean;
    type?: CollectionType;
    take?: number;
    skip?: number;
  }): Promise<Collection[]>;

  countCollections(params?: {
    isActive?: boolean;
    isFeatured?: boolean;
    type?: CollectionType;
  }): Promise<number>;

  addProduct(params: {
    collectionId: string;
    productId: string;
    position?: number;
  }): Promise<CollectionProduct>;

  removeProduct(params: {
    collectionId: string;
    productId: string;
  }): Promise<boolean>;

  getCollectionProducts(params: {
    collectionId: string;
    take?: number;
    skip?: number;
  }): Promise<CollectionProduct[]>;

  countCollectionProducts(collectionId: string): Promise<number>;

  reorderProducts(params: {
    collectionId: string;
    productIds: string[];
  }): Promise<void>;

  bulkAddProducts(params: {
    collectionId: string;
    productIds: string[];
  }): Promise<number>;

  bulkRemoveProducts(params: {
    collectionId: string;
    productIds: string[];
  }): Promise<number>;

  getFeaturedCollections(limit?: number): Promise<Collection[]>;
  getCollectionsForProduct(productId: string): Promise<Collection[]>;
  getStats(): Promise<CollectionStats>;
}
```

## Types

```ts
type CollectionType = "manual" | "automatic";

type CollectionSortOrder =
  | "manual" | "title-asc" | "title-desc"
  | "price-asc" | "price-desc"
  | "created-asc" | "created-desc"
  | "best-selling";

interface Collection {
  id: string;
  title: string;
  slug: string;
  description?: string;
  image?: string;
  type: CollectionType;
  sortOrder: CollectionSortOrder;
  isActive: boolean;
  isFeatured: boolean;
  position: number;
  conditions?: CollectionConditions;
  seoTitle?: string;
  seoDescription?: string;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface CollectionProduct {
  id: string;
  collectionId: string;
  productId: string;
  position: number;
  addedAt: Date;
}

interface CollectionConditions {
  match: "all" | "any";
  rules: CollectionCondition[];
}

interface CollectionCondition {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "starts_with"
    | "ends_with" | "greater_than" | "less_than" | "in" | "not_in";
  value: string | number | string[];
}

interface CollectionStats {
  totalCollections: number;
  activeCollections: number;
  featuredCollections: number;
  manualCollections: number;
  automaticCollections: number;
  totalProducts: number;
}
```

## Notes

- Slugs are unique and validated on create/update. Use slugs for customer-facing URLs.
- Adding a product that already exists in a collection is idempotent — returns the existing entry.
- Deleting a collection cascades — all associated product memberships are removed.
- Automatic collections store conditions as JSON. The runtime evaluates these conditions at query time.
- Store endpoints only return active collections. Admin endpoints return all collections.
- Products within a collection are ordered by `position` (ascending).
