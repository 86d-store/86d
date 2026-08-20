# Gift Wrapping Module

Add-on gift wrapping options for order items with custom messages and recipient names.

## File structure

```
src/
  index.ts              Module factory, options, page definitions
  schema.ts             Data models: wrapOption, wrapSelection
  service.ts            Types + GiftWrappingController interface
  service-impl.ts       Business logic implementation
  mdx.d.ts              MDX type declaration
  admin/
    endpoints/
      index.ts            Endpoint map (7 endpoints)
      list-options.ts     GET  /admin/gift-wrapping
      get-option.ts       GET  /admin/gift-wrapping/:id
      create-option.ts    POST /admin/gift-wrapping/create
      update-option.ts    POST /admin/gift-wrapping/:id/update
      delete-option.ts    POST /admin/gift-wrapping/:id/delete
      wrap-summary.ts     GET  /admin/gift-wrapping/summary
      order-selections.ts GET  /admin/gift-wrapping/order/:orderId
    components/
      index.tsx           Re-exports
      wrap-option-list.tsx + .mdx   Admin list with summary cards
      wrap-option-detail.tsx + .mdx Detail view
  store/
    endpoints/
      index.ts             Endpoint map (5 endpoints)
      list-options.ts      GET  /gift-wrapping/options (active only)
      select-wrapping.ts   POST /gift-wrapping/select
      remove-wrapping.ts   POST /gift-wrapping/remove
      order-wrapping.ts    GET  /gift-wrapping/order/:orderId
      item-wrapping.ts     GET  /gift-wrapping/item/:orderItemId
    components/
      index.tsx            Re-exports
      wrap-option-browse.tsx + .mdx  Public option listing
  __tests__/
    service-impl.test.ts   58 tests
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxMessageLength` | `number` | `500` | Maximum gift message length in characters |

## Data models

- **wrapOption** — Name, description, price in cents, image URL, active flag, sort order
- **wrapSelection** — Order/item IDs, chosen option (denormalized name + price snapshot), recipient name, gift message, customer ID

## Key patterns

- Options are managed by admin, selections are created by customers during checkout
- Price is **snapshotted** at selection time — updating the option price doesn't affect existing selections
- One wrapping selection per order item (enforced; prevents duplicates)
- `wrapOptionName` and `priceInCents` on `wrapSelection` are denormalized for order history
- `getOrderWrappingTotal()` returns all selections + total cost for adding to order totals
- Store endpoint lists only `active: true` options; admin can see all
- Free wrapping options (priceInCents = 0) are supported
- `exactOptionalPropertyTypes` is on — build objects conditionally, never pass `undefined`

## Gotchas

- Deleting a wrap option cascades to its selections (via schema reference)
- Inactive options cannot be selected but existing selections remain valid
- Selections are per order item, not per order — each item can have different wrapping
