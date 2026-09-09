# Facebook Shop Module

Facebook/Meta Commerce integration for catalog sync, product listings, order management, and collections.

**Scope:** This guide owns Module-specific mechanics. In the 86d.store source checkout, read the repository root [`AGENTS.md`](../../AGENTS.md) for shared rules and gates. In another project, follow that project's instructions and the installed `@86d-app/core` contracts.

## Change protocol

1. **Route.** Read this guide and the Module's [`README.md`](./README.md). In the 86d.store source checkout, storage or cross-Module changes also follow the root [Module contracts](../../AGENTS.md#module-contracts) routes.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** In the 86d.store source checkout, run `bun run generate:modules` after a Module change, then `bun run generate:modules -- --frozen` and the parent gates. In another project, use that project's checks. Run the Module's focused tests when available.
   - Done when the current project's required checks pass; source-checkout work also requires a passing frozen registry check.

## Structure

```
src/
  index.ts          Factory: facebookShop(options?) => Module + admin nav (Sales group)
  schema.ts         Zod models: listing, channelOrder, catalogSync, collection
  service.ts        FacebookShopController interface
  service-impl.ts   FacebookShopController implementation via ModuleDataService
  store/endpoints/  /facebook-shop/webhooks
  admin/endpoints/  /admin/facebook-shop/listings (CRUD), /admin/facebook-shop/sync,
                    /admin/facebook-shop/syncs, /admin/facebook-shop/orders (list/get/status),
                    /admin/facebook-shop/collections (create/list/delete), /admin/facebook-shop/stats
  admin/components/ (none)
  __tests__/        service-impl.test.ts
```

## Options

```ts
interface FacebookShopOptions extends ModuleConfig {
  accessToken?: string;
  pageId?: string;
  catalogId?: string;
  commerceAccountId?: string;
}
```

## Data models

- **Listing** — localProductId, externalProductId, title, status (draft|pending|active|rejected|suspended), syncStatus (pending|synced|failed|outdated), metadata
- **ChannelOrder** — externalOrderId, status (pending|confirmed|shipped|delivered|cancelled|refunded), items, subtotal, shippingFee, platformFee, total, customerName, shippingAddress, trackingNumber, trackingUrl
- **CatalogSync** — status (pending|syncing|synced|failed), totalProducts, syncedProducts, failedProducts
- **Collection** — name, externalId, productIds[], status (active|inactive)
- **ChannelStats** — totalListings, activeListings, pendingListings, failedListings, totalOrders, pendingOrders, shippedOrders, deliveredOrders, cancelledOrders, totalRevenue

## Patterns

- Controller registered as `controllers.facebookShop`
- Listings have both `status` (platform review state) and `syncStatus` (data sync state)
- `syncCatalog()` creates a sync record with status "syncing"; connect to Meta API for actual sync
- Collections group product IDs for Facebook Shop organization
- Revenue excludes cancelled and refunded orders
- Events: `facebook.product.synced`, `facebook.collection.synced`, `facebook.order.received`, `facebook.catalog.synced`, `facebook.webhook.received`
