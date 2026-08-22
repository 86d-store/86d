# Comparisons Module

Product comparison for side-by-side feature/price/attribute comparison. Supports guest and registered customers with configurable product limits.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

```
src/
  index.ts          Factory: comparisons(options?) => Module + admin nav
  schema.ts         Data model: comparisonItem
  service.ts        ComparisonController interface
  service-impl.ts   ComparisonController implementation
  mdx.d.ts          TypeScript MDX declarations
  store/
    endpoints/
      add-product.ts       POST /comparisons/add
      list-comparison.ts   GET  /comparisons
      remove-product.ts    POST /comparisons/remove
      clear-comparison.ts  POST /comparisons/clear
      merge-comparison.ts  POST /comparisons/merge
    components/
      _hooks.ts                useComparisonApi hook
      _utils.ts                formatPrice, extractError, collectAttributeKeys
      comparison-bar.tsx       Fixed bottom bar with compared products
      comparison-bar.mdx       Bar template
      comparison-table.tsx     Side-by-side comparison table
      comparison-table.mdx     Table template
  admin/
    endpoints/
      list-items.ts          GET    /admin/comparisons
      frequent-products.ts   GET    /admin/comparisons/frequent
      customer-items.ts      GET    /admin/comparisons/customer/:id
      delete-item.ts         DELETE /admin/comparisons/:id/delete
    components/
      comparison-admin.tsx   Admin dashboard component
      comparison-admin.mdx   Admin template
  __tests__/
    service-impl.test.ts     41 tests
```

## Options

```ts
ComparisonsOptions {
  maxProducts?: string  // Max products per comparison list. Default: 4.
}
```

## Data models

- **comparisonItem**: id, customerId?, sessionId?, productId, productName, productSlug, productImage?, productPrice?, productCategory?, attributes? (JSON key-value), addedAt

## Patterns

- Max products enforced per customer/session (default 4, configurable)
- Duplicate products update snapshot data instead of creating new items
- Comparison items sorted by addedAt ascending (stable order for side-by-side display)
- `attributes` field stores arbitrary key-value pairs for cross-product comparison rows
- `collectAttributeKeys()` utility merges all attribute keys across items for table columns
- Session-to-customer merge on login respects max limit and skips duplicates
- Admin "frequently compared" aggregates across all customers
