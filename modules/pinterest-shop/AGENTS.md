# Pinterest Shop Module

Integrates with Pinterest for catalog management, shopping pin creation, and pin analytics tracking.

## Structure

```
src/
  index.ts          Factory: pinterestShop(options?) => Module + admin nav (Sales > Pinterest Shop)
  schema.ts         Zod models: catalogItem, shoppingPin, catalogSync
  service.ts        PinterestShopController interface
  service-impl.ts   PinterestShopController implementation via ModuleDataService
  store/endpoints/  webhooks.ts
  admin/endpoints/  create-catalog-item, get-catalog-item, list-catalog-items, update-catalog-item, delete-catalog-item, sync-catalog, list-syncs, create-pin, list-pins, stats
  admin/components/ index.tsx, pinterest-shop-admin.mdx, pinterest-shop-admin.tsx
  __tests__/        service-impl.test.ts
```

## Options

```ts
interface PinterestShopOptions extends ModuleConfig {
  accessToken?: string;   // Pinterest API access token
  adAccountId?: string;   // Pinterest ad account ID
  catalogId?: string;     // Pinterest catalog ID
}
```

## Data Models

- **CatalogItem** -- id, localProductId, pinterestItemId, title, description, status (active|inactive|disapproved), link, imageUrl, price, salePrice, availability (in-stock|out-of-stock|preorder), googleCategory, lastSyncedAt, error
- **ShoppingPin** -- id, catalogItemId, pinId, boardId, title, description, link, imageUrl, impressions, saves, clicks
- **CatalogSync** -- id, status (pending|syncing|synced|failed), totalItems, syncedItems, failedItems, error, startedAt, completedAt
- **PinAnalytics** -- impressions, saves, clicks, clickRate, saveRate
- **ChannelStats** -- totalCatalogItems, activeCatalogItems, totalPins, totalImpressions, totalClicks, totalSaves

## Patterns

- Controller key: `pinterestShop`
- Events emitted: `pinterest.product.synced`, `pinterest.pin.created`, `pinterest.order.received`, `pinterest.catalog.synced`, `pinterest.webhook.received`
- Exports read fields: `catalogItemTitle`, `catalogItemStatus`, `catalogItemPrice`, `pinterestItemId`
- `syncCatalog()` syncs only active items and immediately marks as synced

### Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/pinterest-shop/items` | List catalog items with optional filters |
| POST | `/admin/pinterest-shop/items/create` | Create a new catalog item |
| GET | `/admin/pinterest-shop/items/:id` | Get a single catalog item by ID |
| PUT | `/admin/pinterest-shop/items/:id/update` | Update catalog item fields |
| DELETE | `/admin/pinterest-shop/items/:id/delete` | Delete a catalog item |
| POST | `/admin/pinterest-shop/sync` | Trigger a catalog sync |
| GET | `/admin/pinterest-shop/syncs` | List catalog sync history |
| GET | `/admin/pinterest-shop/pins` | List shopping pins |
| POST | `/admin/pinterest-shop/pins/create` | Create a new shopping pin |
| GET | `/admin/pinterest-shop/stats` | Get channel stats |

### Store Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/pinterest-shop/webhooks` | Receive Pinterest webhook events |
- `getPinAnalytics()` computes clickRate and saveRate from impressions
