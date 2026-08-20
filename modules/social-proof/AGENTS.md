# Social Proof Module

Social proof and trust signals for products — purchase counts, viewer counts, trending indicators, recent activity feeds, and configurable trust badges. Drives conversions by showing aggregate activity data to store visitors.

## Structure

```
src/
  index.ts          Factory: socialProof(options?) => Module + admin nav
  schema.ts         Data model: activityEvent, trustBadge
  service.ts        SocialProofController interface + types
  service-impl.ts   SocialProofController implementation
  mdx.d.ts          TypeScript MDX declarations
  store/
    endpoints/
      track-event.ts           POST /social-proof/track
      get-product-activity.ts  GET  /social-proof/activity/:productId
      get-trending.ts          GET  /social-proof/trending
      list-badges.ts           GET  /social-proof/badges
      get-recent-activity.ts   GET  /social-proof/recent
    components/
      _hooks.ts                useSocialProofApi hook
      _utils.ts                timeAgo, formatCount, extractError helpers
      product-activity.tsx     Shows "X bought", "Y viewing" on product pages
      product-activity.mdx     Activity template
      trust-badges.tsx         Renders configurable trust indicators
      trust-badges.mdx         Trust badge template
      recent-purchases.tsx     Feed of recent purchase notifications
      recent-purchases.mdx     Recent purchases template
  admin/
    endpoints/
      list-events.ts           GET  /admin/social-proof/events
      activity-summary.ts      GET  /admin/social-proof/summary
      cleanup-events.ts        POST /admin/social-proof/events/cleanup
      list-badges.ts           GET  /admin/social-proof/badges
      create-badge.ts          POST /admin/social-proof/badges/create
      update-badge.ts          POST /admin/social-proof/badges/:id/update
      delete-badge.ts          POST /admin/social-proof/badges/:id/delete
    components/
      social-proof-admin.tsx   Admin dashboard component
      social-proof-admin.mdx   Admin template
  __tests__/
    service-impl.test.ts       61 tests
```

## Options

```ts
SocialProofOptions {
  maxEventsPerProduct?: string  // Max events to retain per product. Default: 10000.
  defaultPeriod?: string        // Default time period for queries. Default: "24h".
}
```

## Data model

- **activityEvent**: id, productId, productName, productSlug, productImage?, eventType (purchase|view|cart_add|wishlist_add), region?, country?, city?, quantity?, createdAt
- **trustBadge**: id, name, description?, icon, url?, position (header|footer|product|checkout|cart), priority, isActive, createdAt, updatedAt

## Patterns

- Events are anonymous — no customer/session IDs stored for privacy
- Activity aggregation uses time-based periods (1h, 24h, 7d, 30d) to filter events
- `getProductActivity` returns per-product stats: viewCount, purchaseCount, cartAddCount, wishlistAddCount, plus recent purchases with location
- `getTrendingProducts` ranks products by total event count within a period
- Trust badges sorted by priority descending (higher priority badges appear first)
- Store badge endpoint only returns active badges; admin returns all
- `cleanupEvents` removes events older than N days — prevents unbounded growth
- `getActivitySummary` provides dashboard-level metrics including top products
- Recent purchases are limited to 10 per product in activity response
- All text inputs use `sanitizeText` transform in admin endpoints
