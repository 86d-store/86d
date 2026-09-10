# Comparisons Module

Product comparison for side-by-side feature/price/attribute comparison. Supports guest and registered customers with configurable product limits.

**Scope:** This guide owns Module-specific mechanics. In the 86d.store source checkout, read the repository root [`AGENTS.md`](../../AGENTS.md) for shared rules and gates. In another project, follow that project's instructions and the installed `@86d-store/core` contracts.

## Change protocol

1. **Route.** Read this guide and the Module's [`README.md`](./README.md). In the 86d.store source checkout, storage or cross-Module changes also follow the root [Module contracts](../../AGENTS.md#module-contracts) routes.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** In the 86d.store source checkout, run `bun run generate:modules` after a Module change, then `bun run generate:modules -- --frozen` and the parent gates. In another project, use that project's checks. Run the Module's focused tests when available.
   - Done when the current project's required checks pass; source-checkout work also requires a passing frozen registry check.

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
