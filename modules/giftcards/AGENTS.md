# Gift Cards Module

Read-only gift card records, balance and status lookup, owned-card delivery metadata, and analytics. Issuance, funding, redemption, status mutation, and deletion stay unavailable until complete Workflows own those operations with durable evidence.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

```
src/
  index.ts          Factory: giftCards() => Module
  schema.ts         Data models: giftCard, giftCardTransaction
  service.ts        GiftCardController interface + all type definitions
  service-impl.ts   GiftCardController implementation
  store/
    components/     Store-facing MDX + TSX (balance check)
    endpoints/
      check-balance.ts    GET  /gift-cards/check          (public)
      send.ts             POST /gift-cards/send             (auth)
      my-cards.ts         GET  /gift-cards/my-cards         (auth)
  admin/
    components/     Admin MDX + TSX (read-only overview)
    endpoints/
      list-gift-cards.ts              GET    /admin/gift-cards
      stats.ts                        GET    /admin/gift-cards/stats
      get-gift-card.ts                GET    /admin/gift-cards/:id
      list-gift-card-transactions.ts  GET    /admin/gift-cards/:id/transactions
```

## Data models

- **giftCard**: legacy stored record with id, code (GIFT-XXXX-XXXX-XXXX), initialBalance, currentBalance, currency, string status (common values: active|disabled|expired|depleted), expiresAt?, recipientEmail?, recipientName?, customerId?, purchasedByCustomerId?, senderName?, senderEmail?, message?, string deliveryMethod? (common values: email|physical|digital), delivered?, deliveredAt?, scheduledDeliveryAt?, purchaseOrderId?, note?
- **giftCardTransaction**: legacy stored history with id, giftCardId, string type (common values: debit|credit|purchase|topup), amount, balanceAfter, orderId?, customerId?, note?, createdAt

## Events

No commerce events are emitted while money and destructive operations remain contained.

## Patterns

- Legacy records commonly use uppercase `GIFT-XXXX-XXXX-XXXX` codes; the contained reader accepts arbitrary stored strings and does not generate codes
- `sendGiftCard()` records intended email-delivery metadata without setting `delivered` or `deliveredAt`; it does not itself deliver a message, only the owner or purchaser may call it, and it fails closed without owner-local row locking
- Controller and HTTP surfaces do not expose issuance, purchase, top-up, credit, redemption, status mutation, bulk mutation, or deletion
- Checkout gift-card application and redemption fail closed until one complete Checkout Workflow coordinates the discount, debit, Payment, and Order with durable evidence and closed repair behavior
- Effective status treats a past-dated card as expired across balance, list, admin filtering/search/sort, and analytics projections without mutating the stored legacy row
- Every selected durable card and transaction row must validate before projection; malformed rows fail the affected read closed and map to stable unavailable HTTP responses rather than appearing missing or understating financial totals
- `getStats()` computes issued/redeemed/outstanding values from legacy cards + transactions
- Expired cards and cards with any existing delivery marker cannot have intent recorded again, preventing forwarding and partial-state overwrite
- Legacy transaction types remain readable for historical compatibility; their presence is not an executable money path
- Store endpoints derive customerId from session — never accept it from request body
