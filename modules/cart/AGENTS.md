# Cart Module

Shopping cart for guest and registered customers. Supports adding, updating, removing items and cart expiration.

## Structure

```
src/
  index.ts          Factory: cart(options?) => Module + admin nav registration
  schema.ts         Zod models: cart, cartItem
  service.ts        CartController interface
  service-impl.ts   CartController implementation
  adapter.ts        CartAdapter interface + in-memory default
  routes.ts         Route definitions
  components/
    store/          Customer-facing MDX components
      index.tsx     Cart drawer, mini cart, add-to-cart button (.tsx logic)
      *.mdx         Store template variants
    admin/          Store admin MDX components
      index.tsx     Cart list table, cart detail view (.tsx logic)
      *.mdx         Admin template variants
  store/
    endpoints/
      add-to-cart.ts        POST /cart
      get-cart.ts           GET  /cart/get
      clear-cart.ts         POST /cart/clear
      remove-from-cart.ts   DELETE /cart/items/:id/remove
      update-cart-item.ts   PATCH /cart/items/:id/update
    components/             Customer-facing MDX
  admin/
    endpoints/
      list-carts.ts           GET    /admin/carts
      list-abandoned.ts       GET    /admin/carts/abandoned
      recovery-stats.ts       GET    /admin/carts/recovery-stats
      get-cart-details.ts     GET    /admin/carts/:id
      delete-cart.ts          DELETE /admin/carts/:id/delete
      send-recovery.ts        POST   /admin/carts/:id/send-recovery
    components/             Admin MDX
  __tests__/
    service-impl.test.ts    41 tests (core controller CRUD)
    controllers.test.ts     32 tests (edge cases, isolation, recovery)
```

## Options

```ts
CartOptions {
  guestCartExpiration?: number  // ms, default 7 days (604800000)
  maxItemsPerCart?: number      // default 100
}
```

## Data models

- **cart**: id, customerId?, guestId?, status (active|abandoned|converted), expiresAt, metadata
- **cartItem**: id, cartId (FK cascade), productId, variantId?, quantity, price (snapshot), productName, productSlug, productImage?, variantName?, variantOptions?, metadata

## Patterns

- Cart item IDs are deterministic: `${cartId}_${productId}[_${variantId}]`
- Same product+variant merges quantity; different variants are separate line items
- Supports both guest carts (guestId) and customer carts (customerId); customerId takes priority
- Anonymous carts get a random UUID
- Store endpoints return consistent shape: `{ cart, items, itemCount, subtotal }`
- Abandoned cart recovery: `markAsAbandoned`, `markRecoveryEmailSent` (tracks count in metadata), `getRecoveryStats`
- `getAbandonedCarts` filters active carts older than threshold (default 1h), paginated
- `removeFromCart` has fallback logic for guest-to-customer cart migration
- `clearCart` removes items but preserves the cart entity
