# Brands Module

Product brand management. Organize products by manufacturer or brand with brand pages, featured brands, and SEO metadata.

## Structure

```
src/
  index.ts          Factory: brands(options?) => Module + admin nav registration
  schema.ts         Data models: brand, brandProduct
  service.ts        BrandController interface
  service-impl.ts   BrandController implementation
  store/
    endpoints/      Customer-facing
      list-brands.ts          GET  /brands
      get-featured.ts         GET  /brands/featured
      get-brand.ts            GET  /brands/:slug
      get-brand-products.ts   GET  /brands/:slug/products
      get-product-brand.ts    GET  /brands/product/:productId
    components/     Store template components (placeholder)
  admin/
    endpoints/      Protected
      list-brands.ts          GET  /admin/brands
      get-brand.ts            GET  /admin/brands/:id — brand detail + productCount
      get-stats.ts            GET  /admin/brands/stats
      create-brand.ts         POST /admin/brands/create
      update-brand.ts         POST /admin/brands/:id/update
      delete-brand.ts         POST /admin/brands/:id/delete
      get-brand-products.ts   GET  /admin/brands/:id/products
      assign-products.ts      POST /admin/brands/:id/products/assign
      unassign-products.ts    POST /admin/brands/:id/products/unassign
    components/     Admin UI components (placeholder)
  __tests__/
    service-impl.test.ts  65 tests covering all controller methods + edge cases + integration
```

## Options

```ts
BrandsOptions {
  maxProductsPerPage?: string  // default 100
}
```

## Data models

- **brand**: id, name, slug (unique), description?, logo?, bannerImage?, website?, isActive, isFeatured, position, seoTitle?, seoDescription?, createdAt, updatedAt
- **brandProduct**: id, brandId (indexed), productId (indexed), assignedAt

## Key behaviors

- A product can belong to only one brand — assigning to a new brand automatically removes from the old one
- Store endpoints only return active brands
- `getBrandForProduct` returns null for inactive brands
- Deleting a brand cascades to remove all brand-product links
- Bulk operations skip already-assigned products and count only new assignments

## Events

| Event | Trigger | Payload |
|---|---|---|
| `brand.created` | Brand created via admin endpoint | `brandId`, `name`, `slug` |
| `brand.updated` | Brand updated via admin endpoint | `brandId`, `name`, `slug` |
| `brand.deleted` | Brand deleted via admin endpoint | `brandId` |
| `brand.product.assigned` | Product assigned to a brand | `brandId`, `productId` |
| `brand.product.unassigned` | Product unassigned from a brand | `brandId`, `productId` |
