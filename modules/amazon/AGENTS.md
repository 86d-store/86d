# Amazon Module

Amazon Seller Central integration for listing management, order fulfillment, and inventory sync.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

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

- **Listing** — localProductId, asin, sku, title, status (active|inactive|suppressed|incomplete), fulfillmentChannel (FBA|FBM), price, quantity, condition, buyBoxOwned, metadata
- **AmazonOrder** — amazonOrderId, status (pending|unshipped|shipped|cancelled|returned), fulfillmentChannel, items, orderTotal, shippingTotal, marketplaceFee, netProceeds, buyerName, shippingAddress, trackingNumber, carrier
- **InventorySync** — status (pending|syncing|synced|failed), totalSkus, updatedSkus, failedSkus
- **ChannelStats** — totalListings, active/inactive/suppressed/incomplete counts, fba/fbm counts, totalOrders, totalRevenue
- **InventoryHealth** — totalSkus, lowStock, outOfStock, fbaCount, fbmCount

## Patterns

- Controller registered as `controllers.amazon`
- Listing lookup by product ID (`getListingByProduct`) and by ASIN (`getListingByAsin`)
- `syncInventory()` creates a sync record; actual sync is placeholder (returns pending status)
- Admin pages: `/admin/amazon` (overview), `/admin/amazon/inventory` (inventory health)
- Events: `amazon.listing.synced`, `amazon.listing.suppressed`, `amazon.order.received`, `amazon.order.shipped`, `amazon.inventory.updated`, `amazon.feed.submitted`
- No store endpoints beyond webhooks
