# Wishlist Module

Customer wishlists for saving and tracking favorite products across sessions. Supports sharing via token-based public links.

## Structure

```
src/
  index.ts          Factory: wishlist(options?) => Module
  schema.ts         Data models: wishlistItem, wishlistShare
  service.ts        WishlistController interface
  service-impl.ts   WishlistController implementation
  store/
    components/     Store-facing MDX + TSX (button, page, heart icon)
    endpoints/
      store-search.ts          GET  /wishlist/store-search (search integration)
      list-wishlist.ts         GET  /wishlist
      add-to-wishlist.ts       POST /wishlist/add
      remove-from-wishlist.ts  DELETE /wishlist/remove/:id
      bulk-remove.ts           POST /wishlist/bulk-remove
      check-wishlist.ts        GET  /wishlist/check/:productId
      create-share.ts          POST /wishlist/share
      get-shares.ts            GET  /wishlist/shares
      revoke-share.ts          POST /wishlist/share/:id/revoke
      get-shared-wishlist.ts   GET  /wishlist/shared/:token
  admin/
    components/     Admin MDX + TSX (overview)
    endpoints/
      list-all-wishlists.ts    GET    /admin/wishlist
      wishlist-summary.ts      GET    /admin/wishlist/summary
      delete-wishlist-item.ts  DELETE /admin/wishlist/:id/delete
```

## Options

```ts
WishlistOptions {
  maxItems?: string  // max items per customer wishlist (enforced on addItem)
}
```

## Data models

- **wishlistItem**: id, customerId, productId, productName, productImage?, note?, addedAt
- **wishlistShare**: id, customerId, token, active, createdAt, expiresAt?

## Events

- Emits: `wishlist.itemAdded`, `wishlist.itemRemoved`, `wishlist.shared`
- Events emitted from store endpoints via `ctx.context.events.emit()` (guarded by `if (ctx.context.events)`)

## Contracts

- **exports**: read `wishlistItemCount`, `isInWishlist`
- **requires**: cart (optional) — for future move-to-cart integration

## Security

- All store endpoints derive `customerId` from `ctx.context.session.user.id` — never from request body/query
- Unauthenticated users get `401` on add/remove/list, or `{ inWishlist: false }` on check
- Remove endpoint verifies item ownership (`item.customerId === session.user.id`) before deletion
- Bulk remove only removes items owned by the requesting customer
- Share token revocation checks customer ownership
- `getSharedWishlist` is public (no auth required) — uses opaque token for access control
- maxItems enforced in service-impl, error surfaced as `{ error: "...", status: 422 }` from endpoint

## Tests

- `service-impl.test.ts` — 40 unit tests covering all controller methods
- `endpoint-security.test.ts` — 29 tests covering ownership isolation, duplicate prevention, cross-customer data leaks, admin filtering
- `controllers.test.ts` — 55 edge case tests (pagination, multi-user, lifecycle)
- `sharing.test.ts` — 25 tests covering share token lifecycle, expiry, revocation, shared wishlist access
- `bulk-and-limits.test.ts` — 17 tests covering maxItems enforcement, bulk remove, listAll pagination total

## Patterns

- Registers `search: { store: "/wishlist/store-search" }` for search module integration
- Duplicate add (same customerId + productId) returns the existing item, no error
- `removeByProduct(customerId, productId)` deletes all matching items for that pair
- `bulkRemove(customerId, itemIds)` only removes items owned by the customer, returns removed count
- `getSummary()` returns top 10 most-wishlisted products
- `listAll()` returns `{ items, total }` for proper pagination support
- Share tokens are opaque 32-char hex strings, support optional expiry
- `createWishlistController(data, { maxItems })` factory accepts options for limit enforcement
