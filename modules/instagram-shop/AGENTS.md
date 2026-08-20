# Instagram Shop Module

Instagram Shopping integration for product listings, media tagging, catalog sync, and order management.

## Structure

```
src/
  index.ts          Factory: instagramShop(options?) => Module + admin nav (Sales group)
  schema.ts         Zod models: listing, channelOrder, catalogSync
  service.ts        InstagramShopController interface
  service-impl.ts   InstagramShopController implementation via ModuleDataService
  store/endpoints/  /instagram-shop/webhooks
  admin/endpoints/  /admin/instagram-shop/listings (CRUD + tag/untag), /admin/instagram-shop/sync,
                    /admin/instagram-shop/syncs, /admin/instagram-shop/orders (list/get/status),
                    /admin/instagram-shop/stats
  admin/components/ (none)
  __tests__/        service-impl.test.ts
```

## Options

```ts
interface InstagramShopOptions extends ModuleConfig {
  accessToken?: string;
  businessId?: string;
  catalogId?: string;
}
```

## Data models

- **Listing** - localProductId, externalProductId, title, status (draft|pending|active|rejected|suspended), syncStatus (pending|synced|failed|outdated), instagramMediaIds[], metadata
- **ChannelOrder** - externalOrderId, instagramOrderId, igUsername, status (pending|confirmed|shipped|delivered|cancelled|refunded), items, subtotal, shippingFee, platformFee, total, customerName, shippingAddress, trackingNumber, trackingUrl
- **CatalogSync** - status (pending|syncing|synced|failed), totalProducts, syncedProducts, failedProducts
- **ChannelStats** - totalListings, activeListings, pendingListings, failedListings, totalOrders, pendingOrders, shippedOrders, deliveredOrders, cancelledOrders, totalRevenue

## Patterns

- Controller registered as `controllers.instagramShop`
- Unique feature: `tagProduct(listingId, mediaId)` / `untagProduct(listingId, mediaId)` for Instagram media product tagging
- `getProductTags(listingId)` returns array of Instagram media IDs tagged with this product
- Listings track `instagramMediaIds[]` for tagged posts/stories
- Similar architecture to facebook-shop module with added media tagging
- Events: `instagram.product.synced`, `instagram.product.tagged`, `instagram.order.received`, `instagram.catalog.synced`, `instagram.webhook.received`
