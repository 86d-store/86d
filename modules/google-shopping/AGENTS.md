# Google Shopping Module

Integrates with Google Merchant Center for product feed management, feed submissions, order handling, and diagnostics.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

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

## Data models

- **ProductFeedItem** — id, localProductId, googleProductId, title, description, status (active|pending|disapproved|expiring), disapprovalReasons[], googleCategory, condition (new|refurbished|used), availability (in-stock|out-of-stock|preorder), price, salePrice, link, imageLink, gtin, mpn, brand, lastSyncedAt, expiresAt
- **ChannelOrder** — id, googleOrderId, status (pending|confirmed|shipped|delivered|cancelled|returned), items, subtotal, shippingCost, tax, total, shippingAddress, trackingNumber, carrier
- **FeedSubmission** — id, status (pending|processing|completed|failed), totalProducts, approvedProducts, disapprovedProducts, error, submittedAt, completedAt
- **ChannelStats** — totalFeedItems, active, pending, disapproved, expiring, totalOrders, totalRevenue
- **FeedDiagnostics** — statusBreakdown[], disapprovalReasons[]

## Patterns

- Controller key: `google-shopping`
- Events emitted: `google.product.synced`, `google.product.disapproved`, `google.feed.submitted`, `google.order.received`, `google.catalog.synced`
- Exports read fields: `feedItemTitle`, `feedItemStatus`, `feedItemPrice`
- `getDiagnostics()` aggregates status counts and disapproval reason frequency
- `submitFeed()` snapshots current approved/disapproved counts at submission time
