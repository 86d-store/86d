# Etsy Module

Etsy marketplace integration for handmade/vintage listing management, orders, reviews, and shop analytics.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

```
src/
  index.ts          Factory: etsy(options?) => Module + admin nav (Sales group)
  schema.ts         Zod models: listing, etsyOrder, etsyReview
  service.ts        EtsyController interface
  service-impl.ts   EtsyController implementation via ModuleDataService
  store/endpoints/  /etsy/webhooks
  admin/endpoints/  /admin/etsy/listings (CRUD + renew + expiring), /admin/etsy/orders (list/ship),
                    /admin/etsy/reviews (list + average), /admin/etsy/stats
  admin/components/ index.tsx, etsy-admin.mdx
  __tests__/        (none)
```

## Options

```ts
interface EtsyOptions extends ModuleConfig {
  apiKey?: string;
  shopId?: string;
  accessToken?: string;
}
```

## Data models

- **EtsyListing** — localProductId, etsyListingId, title, description, status (active|draft|expired|inactive|sold-out), state (draft|active|inactive), price, quantity, renewalDate, whoMadeIt (i-did|collective|someone-else), whenMadeIt, isSupply, materials[], tags[], taxonomyId, shippingProfileId, views, favorites
- **EtsyOrder** — etsyReceiptId, status (open|paid|shipped|completed|cancelled), items, subtotal, shippingCost, etsyFee, processingFee, tax, total, buyerName, buyerEmail, shippingAddress, giftMessage, trackingNumber, carrier
- **EtsyReview** — etsyTransactionId, rating, review, buyerName, listingId
- **ChannelStats** — totalListings, active/draft/expired/inactive/soldOut counts, totalOrders, totalRevenue, totalViews, totalFavorites, averageRating, totalReviews

## Patterns

- Controller registered as `controllers.etsy`
- `renewListing()` sets status/state to active and adds 120 days to renewalDate
- `getExpiringListings(daysAhead)` returns active listings expiring within N days
- `getAverageRating()` computes average across all reviews (rounded to 2 decimals)
- Etsy-specific fields: whoMadeIt, whenMadeIt, isSupply, materials, tags (required by Etsy API)
- Events: `etsy.listing.synced`, `etsy.listing.expired`, `etsy.order.received`, `etsy.order.shipped`, `etsy.review.received`, `etsy.catalog.synced`
