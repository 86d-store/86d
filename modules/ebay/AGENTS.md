# eBay Module

eBay marketplace integration for fixed-price and auction listings, order management, and channel analytics.

## Structure

```
src/
  index.ts          Factory: ebay(options?) => Module + admin nav (Sales group)
  schema.ts         Zod models: listing, ebayOrder
  service.ts        EbayController interface
  service-impl.ts   EbayController implementation via ModuleDataService
  store/endpoints/  webhooks.ts
  admin/endpoints/  create-listing, get-listing, list-listings, update-listing, end-listing, list-orders, ship-order, stats, active-auctions
  admin/components/ index.tsx, ebay-admin.tsx, ebay-admin.mdx
  __tests__/        service-impl.test.ts
```

## Options

```ts
interface EbayOptions extends ModuleConfig {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  siteId?: string; // default: "EBAY_US"
}
```

## Data models

- **EbayListing** - localProductId, ebayItemId, title, status (active|ended|sold|draft|error), listingType (fixed-price|auction), price, auctionStartPrice, currentBid, bidCount, quantity, condition, categoryId, duration, startTime, endTime, watchers, views, metadata
- **EbayOrder** - ebayOrderId, status (pending|paid|shipped|delivered|cancelled|returned), items, subtotal, shippingCost, ebayFee, paymentProcessingFee, total, buyerUsername, buyerName, shippingAddress, trackingNumber, carrier
- **ChannelStats** - totalListings, activeListings, totalOrders, totalRevenue, activeAuctions, averagePrice

## Patterns

- Controller registered as `controllers.ebay`
- Supports both fixed-price and auction listing types
- `endListing()` sets status to "ended" and records endTime
- `getActiveAuctions()` filters by status=active AND listingType=auction
- Admin page: `/admin/ebay` (single page)

### Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/ebay/listings` | List listings with optional status/type/page/limit filters |
| POST | `/admin/ebay/listings/create` | Create a new listing (fixed-price or auction) |
| GET | `/admin/ebay/listings/:id` | Get a single listing by ID |
| PUT | `/admin/ebay/listings/:id/update` | Update listing fields |
| PUT | `/admin/ebay/listings/:id/end` | End a listing |
| GET | `/admin/ebay/orders` | List orders with optional status/page/limit filters |
| PUT | `/admin/ebay/orders/:id/ship` | Ship an order (trackingNumber, carrier) |
| GET | `/admin/ebay/stats` | Get channel stats |
| GET | `/admin/ebay/auctions` | Get active auctions |

### Store Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/ebay/webhooks` | Receive eBay webhook events (e.g. order.created) |
- Events: `ebay.listing.created`, `ebay.listing.ended`, `ebay.order.received`, `ebay.order.shipped`, `ebay.bid.received`, `ebay.catalog.synced`
