# X Shop Module

Integrates with X (Twitter) Commerce for product listings, order management, and product drop campaigns.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

```
src/
  index.ts          Factory: xShop(options?) => Module + admin nav (Sales > X Shop)
  schema.ts         Zod models: listing, channelOrder, productDrop
  service.ts        XShopController interface
  service-impl.ts   XShopController implementation via ModuleDataService
  store/endpoints/  /x-shop/webhooks
  admin/endpoints/  listings CRUD, orders, order status, drops CRUD, drop stats, channel stats
  __tests__/        service-impl.test.ts
```

## Options

```ts
interface XShopOptions extends ModuleConfig {
  apiKey?: string;      // X/Twitter API key
  apiSecret?: string;   // X/Twitter API secret
  merchantId?: string;  // X Commerce merchant ID
}
```

## Data models

- **Listing** -- id, localProductId, externalProductId, title, status (draft|pending|active|rejected|suspended), syncStatus (pending|synced|failed|outdated), lastSyncedAt, error, metadata
- **ChannelOrder** -- id, externalOrderId, status (pending|confirmed|shipped|delivered|cancelled|refunded), items, subtotal, shippingFee, platformFee, total, customerName, shippingAddress, trackingNumber, trackingUrl
- **ProductDrop** -- id, name, description, productIds[], launchDate, endDate, status (scheduled|live|ended|cancelled), tweetId, impressions, clicks, conversions
- **DropStats** -- impressions, clicks, conversions, conversionRate
- **ChannelStats** -- totalListings, activeListings, pendingListings, failedListings, totalOrders, pendingOrders, shippedOrders, deliveredOrders, cancelledOrders, totalRevenue

## Patterns

- Controller key: `xShop`
- Events emitted: `x.product.listed`, `x.product.unlisted`, `x.order.received`, `x.drop.launched`, `x.webhook.received`
- Exports read fields: `listingTitle`, `listingStatus`, `listingSyncStatus`
- ProductDrop is unique to this module -- scheduled product launches with tweet association and engagement tracking
- `cancelDrop()` sets drop status to `cancelled`
- `getDropStats()` computes conversionRate from impressions
