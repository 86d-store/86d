# TikTok Shop Module

Integrates with TikTok Shop for product listing sync, order management, and catalog synchronization.

**Scope:** This guide owns Module-specific mechanics. In the 86d.store source checkout, read the repository root [`AGENTS.md`](../../AGENTS.md) for shared rules and gates. In another project, follow that project's instructions and the installed `@86d-app/core` contracts.

## Change protocol

1. **Route.** Read this guide and the Module's [`README.md`](./README.md). In the 86d.store source checkout, storage or cross-Module changes also follow the root [Module contracts](../../AGENTS.md#module-contracts) routes.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** In the 86d.store source checkout, run `bun run generate:modules` after a Module change, then `bun run generate:modules -- --frozen` and the parent gates. In another project, use that project's checks. Run the Module's focused tests when available.
   - Done when the current project's required checks pass; source-checkout work also requires a passing frozen registry check.

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
