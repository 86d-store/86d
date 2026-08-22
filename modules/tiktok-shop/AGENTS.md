# TikTok Shop Module

Integrates with TikTok Shop for product listing sync, order management, and catalog synchronization.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

```
src/
  index.ts          Factory: tiktokShop(options?) => Module + admin nav (Sales > TikTok Shop)
  schema.ts         Zod models: listing, channelOrder, catalogSync
  service.ts        TikTokShopController interface
  service-impl.ts   TikTokShopController implementation via ModuleDataService
  store/endpoints/  /tiktok-shop/webhooks
  admin/endpoints/  listings CRUD, sync, syncs, orders, order status, stats
  __tests__/        service-impl.test.ts
```

## Options

```ts
interface TikTokShopOptions extends ModuleConfig {
  appKey?: string;       // TikTok Shop app key
  appSecret?: string;    // TikTok Shop app secret
  shopId?: string;       // TikTok Shop ID
  sandbox?: string;      // Use sandbox environment (default: "true")
}
```

## Data models

- **Listing** -- id, localProductId, externalProductId, title, status (draft|pending|active|rejected|suspended), syncStatus (pending|synced|failed|outdated), lastSyncedAt, error, metadata
- **ChannelOrder** -- id, externalOrderId, status (pending|confirmed|shipped|delivered|cancelled|refunded), items, subtotal, shippingFee, platformFee, total, customerName, shippingAddress, trackingNumber, trackingUrl
- **CatalogSync** -- id, status (pending|syncing|synced|failed), totalProducts, syncedProducts, failedProducts, error, startedAt, completedAt
- **ChannelStats** -- totalListings, activeListings, pendingListings, failedListings, totalOrders, pendingOrders, shippedOrders, deliveredOrders, cancelledOrders, totalRevenue

## Patterns

- Controller key: `tiktokShop`
- Events emitted: `tiktok.product.synced`, `tiktok.product.failed`, `tiktok.order.received`, `tiktok.order.shipped`, `tiktok.catalog.synced`, `tiktok.webhook.received`
- Exports read fields: `listingTitle`, `listingStatus`, `listingSyncStatus`
- Revenue calculation excludes cancelled and refunded orders
