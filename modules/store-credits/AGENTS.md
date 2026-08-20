# Store Credits Module

Customer credit accounts for returns, referrals, and manual adjustments — debitable at checkout.

## Structure

```
src/
  index.ts          Factory: storeCredits(options?) => Module
  schema.ts         Data models: creditAccount, creditTransaction
  service.ts        StoreCreditController interface
  service-impl.ts   StoreCreditController implementation
  store/
    components/     Store-facing MDX + TSX (balance, apply, transactions)
    endpoints/
      get-balance.ts          GET  /store-credits/balance
      list-transactions.ts    GET  /store-credits/transactions
      apply-credit.ts         POST /store-credits/apply
  admin/
    components/     Admin MDX + TSX (dashboard, detail)
    endpoints/
      list-accounts.ts                    GET    /admin/store-credits/accounts
      get-account.ts                      GET    /admin/store-credits/accounts/:customerId
      adjust-credit.ts                    POST   /admin/store-credits/accounts/:customerId/adjust
      freeze-account.ts                   POST   /admin/store-credits/accounts/:customerId/freeze
      unfreeze-account.ts                 POST   /admin/store-credits/accounts/:customerId/unfreeze
      credit-summary.ts                   GET    /admin/store-credits/summary
      list-transactions.ts                GET    /admin/store-credits/transactions
```

## Options

```ts
StoreCreditsOptions {
  currency?: string  // default "USD"
}
```

## Data models

- **creditAccount**: id, customerId (unique), balance, lifetimeCredited, lifetimeDebited, currency, status (active|frozen|closed)
- **creditTransaction**: id, accountId (FK cascade), type (credit|debit), amount, balanceAfter, reason, description, referenceType?, referenceId?, metadata?

## Events

- Emits: `store-credits.credited`, `store-credits.debited`, `store-credits.account.frozen`, `store-credits.account.unfrozen`
- Listens: `return.refunded` (auto-credit when type=store_credit), `referral.completed` (auto-credit when rewardType=store_credit)

## Patterns

- Account is auto-created on first access via `getOrCreateAccount(customerId)`
- Frozen accounts can receive credits but cannot be debited
- Closed accounts cannot receive credits or debits
- Debit fails with error if insufficient balance
- Reason enum: return_refund, order_payment, admin_adjustment, referral_reward, gift_card_conversion, promotional, other
