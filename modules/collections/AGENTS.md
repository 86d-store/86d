# Collections Module

Curated product collections for merchandising. Supports manual (hand-picked) and automatic (rule-based) groupings with featured collection highlighting, SEO fields, and drag-and-drop product ordering.

## Structure

```
src/
  index.ts          Factory: collections(options?) => Module + admin nav
  schema.ts         Models: collection, collectionProduct
  service.ts        CollectionController interface + domain types
  service-impl.ts   CollectionController implementation
  store/
    endpoints/
      list-collections.ts          GET  /collections
      get-collection.ts            GET  /collections/:slug
      get-collection-products.ts   GET  /collections/:slug/products
      get-featured.ts              GET  /collections/featured
      get-product-collections.ts   GET  /collections/product/:productId
    components/
      _hooks.ts                    useCollectionsApi() hook
      collection-list.tsx          Grid of collections
      featured-collections.tsx     Featured collection cards
      *.mdx                        Templates
  admin/
    endpoints/
      list-collections.ts           GET  /admin/collections
      create-collection.ts          POST /admin/collections/create
      update-collection.ts          POST /admin/collections/:id/update
      delete-collection.ts          POST /admin/collections/:id/delete
      get-collection-products.ts    GET  /admin/collections/:id/products
      add-products.ts               POST /admin/collections/:id/products/add
      remove-products.ts            POST /admin/collections/:id/products/remove
      reorder-products.ts           POST /admin/collections/:id/products/reorder
      get-stats.ts                  GET  /admin/collections/stats
    components/
      collection-admin.tsx          Admin dashboard with stats + CRUD
      collection-admin.mdx          Admin template
```

## Options

```ts
CollectionsOptions {
  maxProductsPerCollection?: string  // Default: 500
}
```

## Data models

- **collection**: id, title, slug (unique), description?, image?, type (manual|automatic), sortOrder, isActive, isFeatured, position, conditions? (JSON), seoTitle?, seoDescription?, publishedAt?, createdAt, updatedAt
- **collectionProduct**: id, collectionId (indexed), productId (indexed), position, addedAt

## Key types

- `CollectionType`: "manual" | "automatic"
- `CollectionSortOrder`: "manual" | "title-asc" | "title-desc" | "price-asc" | "price-desc" | "created-asc" | "created-desc" | "best-selling"
- `CollectionConditions`: `{ match: "all"|"any", rules: CollectionCondition[] }` — used for automatic collections
- `CollectionCondition`: `{ field, operator, value }` — operators include equals, contains, greater_than, in, etc.

## Patterns

- Manual collections use the `collectionProduct` join table for explicit product membership
- Automatic collections store `conditions` JSON — matching is expected to be evaluated at query time by the runtime
- `addProduct` is idempotent — adding a duplicate returns the existing entry
- `deleteCollection` cascades — removes all associated collectionProduct records
- Position-based ordering for both collections (global) and products within collections
- Store endpoints only return active collections; admin endpoints return all
- `buildFindOptions` helper strips undefined take/skip to satisfy `exactOptionalPropertyTypes`

## Gotchas

- `exactOptionalPropertyTypes` is enabled — never assign `undefined` to optional properties; use conditional spread or conditional assignment instead
- Biome auto-formats — run `check:fix` after writing code
- Slug must be unique — create/update endpoints check for duplicates
