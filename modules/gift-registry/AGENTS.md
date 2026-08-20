# Gift Registry Module

Customer-created gift registries (wedding, baby, birthday, etc.) that visitors can purchase from.

## File structure

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
      registry-summary.ts GET /admin/gift-registry/summary
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
|--------|------|---------|-------------|
| `maxRegistriesPerCustomer` | `number` | `0` | Max registries per customer (0 = unlimited) |

## Data models

- **registry** — Owner, title, type, slug, visibility, status, event date, item/purchase counts
- **registryItem** — Product reference, price, quantity desired/received, priority, note
- **registryPurchase** — Purchaser, quantity, amount, gift message, anonymous flag

## Key patterns

- Registries are accessed by **slug** on the storefront, by **ID** in admin
- Visibility: `public` (browsable), `unlisted` (link only), `private` (owner only)
- Auto-completes to `"completed"` status when all items reach `quantityReceived >= quantityDesired`
- `recalculateCounts()` runs after every item add/remove/purchase to keep denormalized counts accurate
- Store endpoints enforce ownership via `customerId !== userId` checks
- Slugs are auto-generated with UUID suffix to avoid collisions, or user-specified
- `exactOptionalPropertyTypes` is on — build objects conditionally, never pass `undefined`

## Security

- All user-facing text inputs (`title`, `description`, `thankYouMessage`, `productName`, `variantName`, `note`, `purchaserName`, `giftMessage`) are sanitized via `sanitizeText` transform
- Prevents stored XSS when registry content is displayed to visitors

## Gotchas

- Slug uniqueness is checked on create; changing slugs after creation is not supported
- Purchases from guests (no session) still allowed — `purchaserId` is optional
- Archived registries reject both item additions and purchases
- Always import `sanitizeText` from `@86d-app/core` when adding new text fields to store endpoints
