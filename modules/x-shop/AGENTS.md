# X Shop Module

Integrates with X (Twitter) Commerce for product listings, order management, and product drop campaigns.

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

## Data Models

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
