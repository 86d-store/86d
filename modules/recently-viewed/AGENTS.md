# Recently Viewed Module

Tracks products customers have viewed and surfaces them for rediscovery. Supports both authenticated (customerId) and anonymous (sessionId) users. Deduplicates repeat views within a 5-minute window.

## Structure

```
src/
  index.ts          Factory: recentlyViewed(options?) => Module
  schema.ts         Data model: productView
  service.ts        RecentlyViewedController interface + types
  service-impl.ts   RecentlyViewedController implementation
  store/
    components/     Store-facing MDX + TSX (grid, compact)
    endpoints/
      track-view.ts      POST /recently-viewed/track
      list-views.ts      GET  /recently-viewed
      clear-history.ts   POST /recently-viewed/clear
      merge-history.ts   POST /recently-viewed/merge
  admin/
    components/     Admin MDX + TSX (overview + popular products)
    endpoints/
      list-views.ts        GET    /admin/recently-viewed
      popular-products.ts  GET    /admin/recently-viewed/popular
      customer-views.ts    GET    /admin/recently-viewed/customer/:id
      delete-view.ts       DELETE /admin/recently-viewed/:id/delete
```

## Options

```ts
RecentlyViewedOptions {
  maxViewsPerCustomer?: string  // max views to retain per customer
}
```

## Data model

- **productView**: id, customerId?, sessionId?, productId, productName, productSlug, productImage?, productPrice?, viewedAt

## Events

- Emits: `product.viewed`

## Patterns

- **Dedup window**: Repeat views of the same product by the same user within 5 minutes update the existing record instead of creating a new one. Product snapshot data is refreshed on dedup.
- **Identity**: Uses customerId for logged-in users, sessionId for anonymous. Only one identifier is set per view.
- **Merge**: `POST /recently-viewed/merge` transfers session views to a customer on login. Skips products the customer already viewed.
- **Sorting**: All list endpoints return views sorted by viewedAt descending (most recent first).
- **Popular products**: Aggregated from all views, sorted by view count descending.
- Exports read: `recentlyViewedProducts`, `popularProducts`
