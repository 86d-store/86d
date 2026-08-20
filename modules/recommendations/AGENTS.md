# Recommendations Module

Product recommendation engine with four strategies: manual (admin-curated), bought_together (co-occurrence), trending (interaction velocity), and personalized (category affinity + co-occurrence fallback).

## Structure

```
src/
  index.ts          Factory: recommendations(options?) => Module + admin nav
  schema.ts         Data models: recommendationRule, coOccurrence, productInteraction
  service.ts        RecommendationController interface + types
  service-impl.ts   RecommendationController implementation
  store/
    endpoints/
      get-for-product.ts    GET  /recommendations/:productId
      get-trending.ts       GET  /recommendations/trending
      get-personalized.ts   GET  /recommendations/personalized (auth required)
      track-interaction.ts  POST /recommendations/track
  admin/
    endpoints/
      list-rules.ts              GET  /admin/recommendations/rules
      create-rule.ts             POST /admin/recommendations/rules/create
      update-rule.ts             POST /admin/recommendations/rules/:id
      delete-rule.ts             POST /admin/recommendations/rules/:id/delete
      record-purchase.ts         POST /admin/recommendations/record-purchase
      get-co-occurrences.ts      GET  /admin/recommendations/co-occurrences/:productId
      get-stats.ts               GET  /admin/recommendations/stats
  store/
    components/
      index.tsx              Store UI exports (ProductRecommendations, TrendingProducts)
      _hooks.ts              useRecommendationsApi() hook
      _utils.ts              formatPrice helper
      product-recommendations.tsx  Product-based recommendation grid
      product-recommendations.mdx  Presentation template
      trending-products.tsx        Trending products horizontal scroll
      trending-products.mdx        Presentation template
  admin/
    components/
      index.tsx              RecommendationAdmin (stats, create rule, filter, list)
  __tests__/
    service-impl.test.ts     54 tests
```

## Admin Components

| Component | Path | Description |
|---|---|---|
| `RecommendationAdmin` | `/admin/recommendations` | Stats dashboard, inline create form, strategy filter, rules list with activate/deactivate/delete |

## Options

```ts
RecommendationsOptions {
  defaultTake?: string       // Default number of recommendations. Default: 10.
  trendingWindowDays?: string // Days to look back for trending. Default: 7.
}
```

## Data models

- **recommendationRule**: id, name, strategy, sourceProductId?, targetProductIds (JSON array), weight, isActive, createdAt, updatedAt
- **coOccurrence**: id, productId1, productId2, count, lastOccurredAt — canonical ordering (id1 < id2)
- **productInteraction**: id, productId, customerId?, sessionId?, type (view/purchase/add_to_cart), productName, productSlug, productImage?, productPrice?, productCategory?, createdAt

## Patterns

- Co-occurrences use canonical pair ordering (productId1 < productId2) so (A,B) == (B,A)
- Interaction scoring: purchase=3, add_to_cart=2, view=1
- `getForProduct` combines manual rules + co-occurrence data, deduplicating by productId
- `getPersonalized` first tries category affinity, falls back to co-occurrence from purchased products
- `getTrending` filters by configurable time window (default 7 days)
- Product info for recommendations is resolved from interaction history (denormalized snapshot)
- Rules can be deactivated without deletion (isActive flag)
- `recordPurchase` generates all product pairs from a single order for co-occurrence tracking

## Events

| Event | Trigger | Payload |
|---|---|---|
| `recommendation.interaction.tracked` | User interaction recorded via store endpoint | `productId`, `type`, `customerId`, `sessionId` |
| `recommendation.served` | Recommendations returned to a user | `productId`, `count`, `strategies` |
