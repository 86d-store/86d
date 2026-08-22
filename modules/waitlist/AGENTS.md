# Waitlist Module

Product waitlist that lets customers subscribe to out-of-stock notifications and tracks demand per product.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

```
src/
  index.ts          Factory: waitlist(options?) => Module (requires: inventory)
  schema.ts         Data model: waitlistEntry
  service.ts        WaitlistController interface
  service-impl.ts   WaitlistController implementation
  store/
    components/     Store-facing MDX + TSX (button, page, bell icon)
    endpoints/
      join-waitlist.ts     POST /waitlist/join
      leave-waitlist.ts    POST /waitlist/leave
      check-waitlist.ts    GET  /waitlist/check/:productId
      my-waitlist.ts       GET  /waitlist/mine
  admin/
    components/     Admin MDX + TSX (dashboard)
    endpoints/
      list-waitlist.ts       GET    /admin/waitlist
      waitlist-summary.ts    GET    /admin/waitlist/summary
      notify-waitlist.ts     POST   /admin/waitlist/:productId/notify
      delete-entry.ts        DELETE /admin/waitlist/:id/delete
```

## Options

```ts
WaitlistOptions {
  maxEntriesPerEmail?: string
}
```

## Data model

- **waitlistEntry**: id, productId, productName, variantId?, variantLabel?, email, customerId?, status (waiting|notified|purchased|cancelled), notifiedAt?, createdAt

## Events

- Emits: `waitlist.subscribed`, `waitlist.unsubscribed`, `waitlist.notified`

## Patterns

- Duplicate subscribe (same email + productId with status=waiting) returns the existing entry
- `cancelByEmail` sets status to "cancelled" rather than deleting
- `markNotified(productId)` bulk-transitions all "waiting" entries to "notified" with timestamp
- `markPurchased(email, productId)` transitions "waiting" or "notified" entries to "purchased"
- `getSummary()` returns top 10 most-waited products
