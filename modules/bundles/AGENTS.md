# Bundles Module

Groups products into discounted bundles with fixed-price or percentage-off pricing and date-based availability.

## Structure

```
src/
  index.ts          Factory: bundles(options?) => Module
  schema.ts         Zod models: bundle, bundleItem
  service.ts        BundleController interface + types
  service-impl.ts   BundleController implementation (isActive helper)
  store/
    components/     Bundle list + detail MDX + TSX components
    endpoints/
      list-active-bundles.ts    GET  /bundles
      get-bundle.ts             GET  /bundles/:slug
  admin/
    components/     Bundle overview MDX + TSX
    endpoints/
      list-bundles.ts                GET    /admin/bundles
      create-bundle.ts               POST   /admin/bundles/create
      get-bundle.ts                  GET    /admin/bundles/:id
      update-bundle.ts               PUT    /admin/bundles/:id/update
      delete-bundle.ts               DELETE /admin/bundles/:id/delete
      list-bundle-items.ts           GET    /admin/bundles/:id/items
      add-bundle-item.ts             POST   /admin/bundles/:id/items/add
      remove-bundle-item.ts          DELETE /admin/bundles/:id/items/:itemId/remove
      update-bundle-item.ts          PUT    /admin/bundles/:id/items/:itemId/update
```

## Options

```ts
BundleOptions {
  maxItemsPerBundle?: number      // default 20
  maxDiscountPercentage?: number  // default 100
}
```

## Data models

- **bundle**: id, name, slug, description?, status (active|draft|archived), discountType (fixed|percentage), discountValue, minQuantity?, maxQuantity?, startsAt?, endsAt?, imageUrl?, sortOrder?, createdAt, updatedAt
- **bundleItem**: id, bundleId (FK), productId, variantId?, quantity, sortOrder?, createdAt

## Patterns

- Requires `products` module (reads productDetails)
- New bundles always start in `draft` status
- `isActive()` checks status=active AND current date is within startsAt/endsAt range
- Store endpoints only return active bundles (filtered by `isActive`)
- Store lookup uses slug, admin uses ID
- Deleting a bundle cascades to its items (manual loop, not DB cascade)
- Events: bundle.created, bundle.updated, bundle.activated, bundle.archived, bundle.itemAdded, bundle.itemRemoved
