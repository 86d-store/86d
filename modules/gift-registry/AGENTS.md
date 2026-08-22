# Gift Registry Module

Customer-created gift registries (wedding, baby, birthday, etc.) that visitors can purchase from.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

```
src/
  index.ts              Module factory, options, page definitions
  schema.ts             Data models: registry, registryItem, registryPurchase
  service.ts            Types + GiftRegistryController interface
  service-impl.ts       Business logic implementation
  mdx.d.ts              MDX type declaration
  admin/
    endpoints/
      index.ts           Endpoint map (7 endpoints)
      list-registries.ts GET  /admin/gift-registry
      get-registry.ts    GET  /admin/gift-registry/:id
      delete-registry.ts POST /admin/gift-registry/:id/delete
      archive-registry.ts POST /admin/gift-registry/:id/archive
      registry-summary.ts GET  /admin/gift-registry/summary
      list-items.ts      GET  /admin/gift-registry/:id/items
      list-purchases.ts  GET  /admin/gift-registry/:id/purchases
    components/
      index.tsx          Re-exports
      registries-list.tsx + .mdx  Admin list with summary cards
      registry-detail.tsx + .mdx  Detail with items + purchases
  store/
    endpoints/
      index.ts            Endpoint map (8 endpoints)
      browse-registries.ts GET  /gift-registry (public only)
      get-registry.ts      GET  /gift-registry/:slug
      create-registry.ts   POST /gift-registry/create (auth)
      update-registry.ts   POST /gift-registry/update (auth, owner)
      add-item.ts          POST /gift-registry/items/add (auth, owner)
      remove-item.ts       POST /gift-registry/items/remove (auth, owner)
      purchase-item.ts     POST /gift-registry/purchase
      my-registries.ts     GET  /gift-registry/mine (auth)
    components/
      index.tsx           Re-exports
      registry-browse.tsx + .mdx  Public registry listing
      registry-page.tsx + .mdx    Single registry with items
  __tests__/
    service-impl.test.ts  91 tests
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `maxRegistriesPerCustomer` | `number` | `0` | Max registries per customer (0 = unlimited) |

## Data models

- **registry** — Owner, title, type, slug, visibility, status, event date, item/purchase counts
- **registryItem** — Product reference, price, quantity desired/received, priority, note
- **registryPurchase** — Purchaser, quantity, amount, gift message, anonymous flag

## Patterns

- Registries are accessed by **slug** on the storefront, by **ID** in admin
- Visibility: `public` (browsable), `unlisted` (link only), `private` (owner only)
- Auto-completes to `"completed"` status when all items reach `quantityReceived >= quantityDesired`
- `recalculateCounts()` runs after every item add/remove/purchase to keep denormalized counts accurate
- Store endpoints enforce ownership via `customerId !== userId` checks
- Slugs are auto-generated with UUID suffix to avoid collisions, or user-specified
- `exactOptionalPropertyTypes` is on — build objects conditionally, never pass `undefined`
- Slug uniqueness is checked on create; changing slugs after creation is not supported
- Purchases from guests (no session) still allowed — `purchaserId` is optional
- Archived registries reject both item additions and purchases
- Sanitize user-facing text fields (`title`, `description`, `thankYouMessage`, `productName`, `variantName`, `note`, `purchaserName`, `giftMessage`) with `.transform(sanitizeText)` from `@86d-app/core/sanitize` (parent owns the sanitize rule; this list is the local field inventory)
