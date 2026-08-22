# Store Credits Module

Customer credit accounts for returns, referrals, and manual adjustments — debitable at checkout.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

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
