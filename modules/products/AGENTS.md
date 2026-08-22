# Products Module

Product and Variant catalog with accepted Categories. New price writes use integer minor units. Inventory is authoritative for stock, and Collections is authoritative for Collection writes; the similarly named Products fields/tables are temporary read projections. Direct spreadsheet import is contained until the reviewed revision pipeline exists.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

```
src/
  index.ts          Factory: products(options?) => Module + admin nav
  schema.ts         Zod models: product, productVariant, category, collection, collectionProduct
  catalog-revisions.ts  Immutable Catalog revision transition and publish interface
  catalog-presentation.ts  Durable publication consumer + atomic presentation read model
  controllers.ts    Raw module controllers (ctx pattern for endpoint system)
  service.ts        TypeScript interface (ProductController)
  service-impl.ts   Clean typed implementation (createProductController)
  state.ts          MobX UI state (filters, sort, view mode)
  store/
    endpoints/      Customer-facing (9 endpoints)
    components/     Store MDX components
  admin/
    endpoints/      Protected (23 endpoints)
    components/     Admin UI components
  __tests__/
    controllers.test.ts          Raw controller tests (135 tests)
    service-impl.test.ts         Service layer tests (134 tests)
    endpoint-security.test.ts    Data integrity invariants
    state.test.ts                MobX state tests
```

## Options

```ts
ProductsOptions {
  defaultPageSize?: number   // default 20
  maxPageSize?: number       // default 100
  trackInventory?: boolean   // default true
}
```

## Data models

- **product**: id, name, slug (unique), price, compareAtPrice, costPrice, sku?, inventory, trackInventory, allowBackorder, status (draft|active|archived), categoryId?, images[], tags[], metadata, weight/weightUnit, isFeatured
- **productVariant**: id, productId (FK cascade), name, sku?, price, inventory, options (Record<string,string>), images[], position
- **category**: id, name, slug (unique), parentId? (self-referential), position, isVisible, metadata
- **collection**: id, name, slug (unique), isFeatured, isVisible, position, metadata
- **collectionProduct**: id, collectionId (FK cascade), productId (FK cascade), position

## Patterns

- Two controller layers: `controllers.ts` (raw ctx pattern for endpoints) and `service-impl.ts` (clean typed API with `createProductController(data)`)
- Service-impl uses `crypto.randomUUID()` for IDs; raw controllers use `Date.now()`
- Store endpoints only return active products; admin endpoints return all statuses
- Variant writes update parent product's `updatedAt`
- Category deletion orphans children and products (sets categoryId/parentId to undefined)
- Collection `getWithProducts` returns only active products; `listCollectionProducts` returns all
- `addProductToCollection` prevents duplicates (returns existing link)
- Import resolves categories by name (case-insensitive), deduplicates slugs, updates existing products by SKU
- Inventory decrement has NO floor — can go negative (documented behavior)
- Product and Variant endpoints reject stock mutations with `INVENTORY_OPERATION_REQUIRED`.
- Catalog revision content contains Product, Variant, accepted Category, currency,
  and integer-minor-unit facts only; it contains no Inventory or Collection truth.
- `applyCatalogRevisionOperation` requires a caller-owned locking transaction.
  Draft content is immutable, transition retries use durable operation receipts,
  and publish rejects a stale base before atomically advancing the Catalog head.
- Authenticated Store Admin revision endpoints are thin transport adapters. They
  derive actor, authority, permissions, and Store target from the session and
  fail closed without the owner transaction/outbox seam.
- Successful publish emits `catalog.published@1` from the same transaction as the
  revision, supersession, audit, and operation receipt.
- `products.catalog-presentation.v1` verifies each publication against its
  immutable revision and rebuilds Storefront, search, and feed-facing data in one
  `catalogPresentation` row. Exact replays and older revisions converge without
  replacing current state; mismatches throw so the dispatcher records retry or
  dead-letter state while the last good projection remains readable.
- Related products scored: same category (+10), shared tags (+1 each)

## Caveats

- `exactOptionalPropertyTypes` is on — use `undefined` carefully for optional fields
- Direct import returns `PRODUCT_IMPORT_REVIEW_REQUIRED` before mutation.
- Catalog revision create/review/publish/read transport is active for Store
  Admin. Existing Product CRUD, import, search indexing, and product feeds are
  not revision-backed yet.
- The presentation read model is registered in the standalone Runtime, but
  legacy Storefront endpoints and the Search and Product Feeds Module adapters
  have not switched to it yet.
- Category tree only includes visible categories
- Search is case-insensitive across name, description, and tags
