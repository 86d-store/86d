# Price Lists Module

Tiered and group-specific pricing for products. Supports multiple price lists with priority-based resolution, quantity tiers, currency filtering, and customer group targeting.

## Structure

```
src/
  index.ts          Factory: priceLists(options?) => Module + admin nav
  schema.ts         Data models: priceList, priceEntry
  service.ts        PriceListController interface + types
  service-impl.ts   PriceListController implementation
  store/endpoints/
    get-price-list.ts     GET  /price-lists/:slug
    resolve-price.ts      GET  /prices/product/:productId
    resolve-prices.ts     POST /prices/products
  admin/endpoints/
    list-price-lists.ts   GET    /admin/price-lists
    get-price-list.ts     GET    /admin/price-lists/:id
    create-price-list.ts  POST   /admin/price-lists/create
    update-price-list.ts  PUT    /admin/price-lists/:id/update
    delete-price-list.ts  DELETE /admin/price-lists/:id/delete
    list-entries.ts       GET    /admin/price-lists/:id/entries
    set-entry.ts          POST   /admin/price-lists/:id/entries/set
    remove-entry.ts       DELETE /admin/price-lists/:id/entries/:productId/remove
    bulk-set-entries.ts   POST   /admin/price-lists/:id/entries/bulk
    get-stats.ts          GET    /admin/price-lists/stats
  admin/components/
    index.tsx             PriceListAdmin, PriceListCreate, PriceListDetail
```

## Options

```ts
PriceListsOptions {
  defaultCurrency?: string  // ISO 4217 currency code, default: none
}
```

## Data models

- **priceList**: id, name, slug (unique), description?, currency?, priority, status (active|inactive|scheduled), startsAt?, endsAt?, customerGroupId?, createdAt, updatedAt
- **priceEntry**: id, priceListId (indexed), productId (indexed), price, compareAtPrice?, minQuantity?, maxQuantity?, createdAt

## Admin components

| Component | Path | Description |
|-----------|------|-------------|
| `PriceListAdmin` | `/admin/price-lists` | Stats dashboard + filterable table (status, priority, currency, schedule) |
| `PriceListCreate` | `/admin/price-lists/create` | Create form with settings (currency, priority, status, schedule, customer group) |
| `PriceListDetail` | `/admin/price-lists/:id` | Detail view with entry table, add entry form, activate/deactivate, delete |

## Patterns

- Priority-based resolution: lowest priority number wins (0 = highest priority)
- Price resolution sorts active lists by priority, returns first match for the product
- Customer group filtering: lists with no group match all customers; lists with a group only match that group
- Quantity tiers: entries can specify min/max quantity ranges. Multiple overlapping tiers pick the lowest price
- Date-bounded activation: `startsAt`/`endsAt` fields control when a price list is active
- `setPrice` upserts: same product + same quantity tier = update existing entry
- `bulkSetPrices` processes up to 500 entries per call
- Deleting a price list cascades to remove all its entries

## Tests

- `controllers.test.ts` — controller unit tests
- `service-impl.test.ts` — service implementation tests
- `endpoint-security.test.ts` — 36 tests covering resolution visibility, customer group scoping, currency filtering, quantity tier matching, priority ordering, cascade deletion, nonexistent resource guards, CRUD integrity, bulk operations, stats accuracy, and update semantics

## Gotchas

- `exactOptionalPropertyTypes` is enabled — cast Zod-parsed bodies via `as Parameters<...>` when passing to controller methods
- Mock data service doesn't support `orderBy` — the controller sorts activeLists in-memory after filtering
- Currency filter is permissive: lists with no currency set match any currency request
