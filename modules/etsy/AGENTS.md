# Etsy Module

Etsy marketplace integration for handmade/vintage listing management, orders, reviews, and shop analytics.

**Scope:** This guide owns Module-specific mechanics. In the 86d.store source checkout, read the repository root [`AGENTS.md`](../../AGENTS.md) for shared rules and gates. In another project, follow that project's instructions and the installed `@86d-app/core` contracts.

## Change protocol

1. **Route.** Read this guide and the Module's [`README.md`](./README.md). In the 86d.store source checkout, storage or cross-Module changes also follow the root [Module contracts](../../AGENTS.md#module-contracts) routes.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** In the 86d.store source checkout, run `bun run generate:modules` after a Module change, then `bun run generate:modules -- --frozen` and the parent gates. In another project, use that project's checks. Run the Module's focused tests when available.
   - Done when the current project's required checks pass; source-checkout work also requires a passing frozen registry check.

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
