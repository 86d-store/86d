# Product Labels Module

Visual labels and badges for products — "New", "Sale", "Best Seller", "Limited Edition", etc. Supports scheduled labels, conditional assignment rules, and bulk operations.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

```
src/
  index.ts          Factory: productLabels(options?) => Module + admin nav
  schema.ts         Data model: label, productLabel
  service.ts        ProductLabelController interface + types
  service-impl.ts   ProductLabelController implementation
  mdx.d.ts          TypeScript MDX declarations
  store/
    endpoints/
      list-labels.ts         GET  /product-labels
      get-label.ts           GET  /product-labels/:slug
      get-product-labels.ts  GET  /product-labels/products/:productId
    components/
      _hooks.ts              useProductLabelsApi hook
      product-badges.tsx     Renders badges on product cards
      product-badges.mdx     Badge template
  admin/
    endpoints/
      list-labels.ts         GET  /admin/product-labels
      create-label.ts        POST /admin/product-labels/create
      update-label.ts        POST /admin/product-labels/:id/update
      delete-label.ts        POST /admin/product-labels/:id/delete
      assign-label.ts        POST /admin/product-labels/assign
      unassign-label.ts      POST /admin/product-labels/unassign
      bulk-assign.ts         POST /admin/product-labels/bulk-assign
      bulk-unassign.ts       POST /admin/product-labels/bulk-unassign
      product-labels.ts      GET  /admin/product-labels/products/:productId
      label-stats.ts         GET  /admin/product-labels/stats
    components/
      label-admin.tsx        Admin dashboard component
      label-admin.mdx        Admin template
  __tests__/
    service-impl.test.ts     54 tests
```

## Options

```ts
ProductLabelsOptions {
  maxLabelsPerProduct?: string  // Max labels per product. Default: 10.
}
```

## Data model

- **label**: id, name, slug, displayText, type (badge|tag|ribbon|banner|sticker|custom), color?, backgroundColor?, icon?, priority, isActive, startsAt?, endsAt?, conditions? (JSON), createdAt, updatedAt
- **productLabel**: id, productId, labelId, position? (top-left|top-right|bottom-left|bottom-right|center), assignedAt

## Patterns

- Labels sorted by priority descending (higher priority labels appear first)
- Duplicate slug check on create prevents conflicts
- Re-assigning a label to the same product updates the position instead of duplicating
- Deleting a label cascades to remove all product assignments
- `getActiveLabelsForProduct` filters by isActive + date range (startsAt/endsAt)
- Bulk assign/unassign skip already-assigned/unassigned products respectively
- `conditions` field stores rules for automatic label assignment (newWithinDays, discountMinPercent, lowStockThreshold, categories, priceMin, priceMax)
- Store endpoints only return active labels; admin endpoints return all
