# Waitlist Module

Product waitlist that lets customers subscribe to out-of-stock notifications and tracks demand per product.

**Scope:** This guide owns Module-specific mechanics. In the 86d.store source checkout, read the repository root [`AGENTS.md`](../../AGENTS.md) for shared rules and gates. In another project, follow that project's instructions and the installed `@86d-app/core` contracts.

## Change protocol

1. **Route.** Read this guide and the Module's [`README.md`](./README.md). In the 86d.store source checkout, storage or cross-Module changes also follow the root [Module contracts](../../AGENTS.md#module-contracts) routes.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** In the 86d.store source checkout, run `bun run generate:modules` after a Module change, then `bun run generate:modules -- --frozen` and the parent gates. In another project, use that project's checks. Run the Module's focused tests when available.
   - Done when the current project's required checks pass; source-checkout work also requires a passing frozen registry check.

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
