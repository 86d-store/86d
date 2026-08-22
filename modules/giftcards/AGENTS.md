# Gift Cards Module

Digital gift cards with purchasing, gifting, redemption, balance management, top-ups, and analytics.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

```
src/
  index.ts          Factory: giftCards(options?) => Module
  schema.ts         Data models: giftCard, giftCardTransaction
  service.ts        GiftCardController interface + all type definitions
  service-impl.ts   GiftCardController implementation
  store/
    components/     Store-facing MDX + TSX (balance check, redeem)
    endpoints/
      check-balance.ts    GET  /gift-cards/check          (public)
      redeem.ts           POST /gift-cards/redeem          (auth)
      purchase.ts         POST /gift-cards/purchase         (auth)
      send.ts             POST /gift-cards/send             (auth)
      my-cards.ts         GET  /gift-cards/my-cards         (auth)
      top-up.ts           POST /gift-cards/top-up           (auth)
  admin/
    components/     Admin MDX + TSX (overview)
    endpoints/
      list-gift-cards.ts              GET    /admin/gift-cards
      create-gift-card.ts             POST   /admin/gift-cards/create
      bulk-create.ts                  POST   /admin/gift-cards/bulk-create
      stats.ts                        GET    /admin/gift-cards/stats
      disable-expired.ts              POST   /admin/gift-cards/disable-expired
      get-gift-card.ts                GET    /admin/gift-cards/:id
      update-gift-card.ts             PUT    /admin/gift-cards/:id/update
      delete-gift-card.ts             DELETE /admin/gift-cards/:id/delete
      credit-gift-card.ts             POST   /admin/gift-cards/:id/credit
      list-gift-card-transactions.ts  GET    /admin/gift-cards/:id/transactions
```

## Options

```ts
GiftCardOptions {
  defaultCurrency?: string  // default "USD"
  maxBalance?: number       // maximum gift card value
  denominations?: string    // comma-separated amounts, e.g. "1000,2500,5000"
  maxBulkCount?: number     // max cards per bulk creation (default 100)
}
```

## Data models

- **giftCard**: id, code (GIFT-XXXX-XXXX-XXXX), initialBalance, currentBalance, currency, status (active|disabled|expired|depleted), expiresAt?, recipientEmail?, recipientName?, customerId?, purchasedByCustomerId?, senderName?, senderEmail?, message?, deliveryMethod? (email|physical|digital), delivered?, deliveredAt?, scheduledDeliveryAt?, purchaseOrderId?, note?
- **giftCardTransaction**: id, giftCardId, type (debit|credit|purchase|topup), amount, balanceAfter, orderId?, customerId?, note?, createdAt

## Events

Emits: `giftCard.created`, `giftCard.purchased`, `giftCard.redeemed`, `giftCard.credited`, `giftCard.depleted`, `giftCard.sent`, `giftCard.toppedUp`, `giftCard.expired`

## Patterns

- Codes are uppercase alphanumeric, no ambiguous chars (0/O/1/I/L), format GIFT-XXXX-XXXX-XXXX
- `purchase()` creates card + records purchase transaction; assigns customerId for self-purchases, leaves unassigned for gifts
- `sendGiftCard()` marks card as delivered with email delivery — only owner or purchaser can send
- `topUp()` verifies card ownership before adding balance — reactivates depleted cards
- `redeem(code, amount)` caps at available balance; sets status to "depleted" at zero
- `checkBalance(code)` is public (no auth), returns expired status for past-dated cards
- `bulkCreate()` generates multiple cards with shared settings (for promotions)
- `getStats()` computes issued/redeemed/outstanding values from cards + transactions
- `disableExpired()` batch-updates active cards with past expiresAt to "expired" status
- Cards already delivered cannot be re-sent to prevent forwarding abuse
- `ModuleConfig` only allows `Primitive` values — store array options as comma-separated strings
- Transaction type includes "purchase" and "topup" in addition to "debit"/"credit"
- `delivered` field defaults to `false` on create, not `undefined`
- Store endpoints derive customerId from session — never accept it from request body
