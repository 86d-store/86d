# Google Shopping Module

Integrates with Google Merchant Center for product feed management, feed submissions, order handling, and diagnostics.

## Structure

```
src/
  index.ts          Factory: googleShopping(options?) => Module + admin nav (Sales > Google Shopping)
  schema.ts         Zod models: productFeed, channelOrder, feedSubmission
  service.ts        GoogleShoppingController interface
  service-impl.ts   GoogleShoppingController implementation via ModuleDataService
  store/endpoints/  /google-shopping/webhooks
  admin/endpoints/  feed items CRUD, submit, submissions, orders, order status, stats, diagnostics
  admin/components/ index.tsx, google-shopping-admin.mdx
  __tests__/        controllers.test.ts
```

## Options

```ts
interface GoogleShoppingOptions extends ModuleConfig {
  merchantId?: string;       // Google Merchant Center ID
  apiKey?: string;           // Google API key
  targetCountry?: string;    // Target country code (default: "US")
  contentLanguage?: string;  // Content language (default: "en")
}
```

## Data Models

- **ProductFeedItem** -- id, localProductId, googleProductId, title, description, status (active|pending|disapproved|expiring), disapprovalReasons[], googleCategory, condition (new|refurbished|used), availability (in-stock|out-of-stock|preorder), price, salePrice, link, imageLink, gtin, mpn, brand, lastSyncedAt, expiresAt
- **ChannelOrder** -- id, googleOrderId, status (pending|confirmed|shipped|delivered|cancelled|returned), items, subtotal, shippingCost, tax, total, shippingAddress, trackingNumber, carrier
- **FeedSubmission** -- id, status (pending|processing|completed|failed), totalProducts, approvedProducts, disapprovedProducts, error, submittedAt, completedAt
- **ChannelStats** -- totalFeedItems, active, pending, disapproved, expiring, totalOrders, totalRevenue
- **FeedDiagnostics** -- statusBreakdown[], disapprovalReasons[]

## Patterns

- Controller key: `google-shopping`
- Events emitted: `google.product.synced`, `google.product.disapproved`, `google.feed.submitted`, `google.order.received`, `google.catalog.synced`
- Exports read fields: `feedItemTitle`, `feedItemStatus`, `feedItemPrice`
- `getDiagnostics()` aggregates status counts and disapproval reason frequency
- `submitFeed()` snapshots current approved/disapproved counts at submission time
