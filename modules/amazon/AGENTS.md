# Amazon Module

Amazon Seller Central integration for listing management, order fulfillment, and inventory sync.

## Structure

```
src/
  index.ts          Factory: amazon(options?) => Module + admin nav (Sales group)
  schema.ts         Zod models: listing, amazonOrder, inventorySync
  service.ts        AmazonController interface
  service-impl.ts   AmazonController implementation via ModuleDataService
  store/endpoints/  /amazon/webhooks
  admin/endpoints/  /admin/amazon/listings (CRUD), /admin/amazon/orders (list/ship/cancel),
                    /admin/amazon/inventory/sync, /admin/amazon/inventory/health, /admin/amazon/stats
  admin/components/ index.tsx, amazon-admin.mdx, amazon-inventory.mdx
  __tests__/        controllers.test.ts
```

## Options

```ts
interface AmazonOptions extends ModuleConfig {
  sellerId?: string;
  mwsAuthToken?: string;
  marketplaceId?: string;
  region?: string; // default: "NA"
}
```

## Data models

- **Listing** - localProductId, asin, sku, title, status (active|inactive|suppressed|incomplete), fulfillmentChannel (FBA|FBM), price, quantity, condition, buyBoxOwned, metadata
- **AmazonOrder** - amazonOrderId, status (pending|unshipped|shipped|cancelled|returned), fulfillmentChannel, items, orderTotal, shippingTotal, marketplaceFee, netProceeds, buyerName, shippingAddress, trackingNumber, carrier
- **InventorySync** - status (pending|syncing|synced|failed), totalSkus, updatedSkus, failedSkus
- **ChannelStats** - totalListings, active/inactive/suppressed/incomplete counts, fba/fbm counts, totalOrders, totalRevenue
- **InventoryHealth** - totalSkus, lowStock, outOfStock, fbaCount, fbmCount

## Patterns

- Controller registered as `controllers.amazon`
- Listing lookup by product ID (`getListingByProduct`) and by ASIN (`getListingByAsin`)
- `syncInventory()` creates a sync record; actual sync is placeholder (returns pending status)
- Admin pages: `/admin/amazon` (overview), `/admin/amazon/inventory` (inventory health)
- Events: `amazon.listing.synced`, `amazon.listing.suppressed`, `amazon.order.received`, `amazon.order.shipped`, `amazon.inventory.updated`, `amazon.feed.submitted`
- No store endpoints beyond webhooks
