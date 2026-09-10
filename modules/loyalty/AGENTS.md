# Loyalty Module

Points-based loyalty program with tiered rewards, earning rules, and order-event integration.

**Scope:** This guide owns Module-specific mechanics. In the 86d.store source checkout, read the repository root [`AGENTS.md`](../../AGENTS.md) for shared rules and gates. In another project, follow that project's instructions and the installed `@86d-store/core` contracts.

## Change protocol

1. **Route.** Read this guide and the Module's [`README.md`](./README.md). In the 86d.store source checkout, storage or cross-Module changes also follow the root [Module contracts](../../AGENTS.md#module-contracts) routes.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** In the 86d.store source checkout, run `bun run generate:modules` after a Module change, then `bun run generate:modules -- --frozen` and the parent gates. In another project, use that project's checks. Run the Module's focused tests when available.
   - Done when the current project's required checks pass; source-checkout work also requires a passing frozen registry check.

## Structure

```
src/
  index.ts          Factory: loyalty(options?) => Module. Order facts are not attached.
  schema.ts         Zod models: loyaltyAccount, loyaltyTransaction, loyaltyRule, loyaltyTier
  service.ts        LoyaltyController interface + types
  service-impl.ts   LoyaltyController implementation
  store/
    components/     Points balance, history, tier progress, loyalty page MDX + TSX
    endpoints/
      store-search.ts         GET  /loyalty/store-search
      get-balance.ts          GET  /loyalty/balance
      list-transactions.ts    GET  /loyalty/transactions
      get-tiers.ts            GET  /loyalty/tiers
      calculate-points.ts     GET  /loyalty/calculate
      redeem.ts               POST /loyalty/redeem
  admin/
    components/
      loyalty-overview.*      Overview MDX + TSX
      loyalty-rules.*         Rules management MDX + TSX
      loyalty-tiers.*         Tiers management MDX + TSX
    endpoints/
      list-accounts.ts                  GET    /admin/loyalty/accounts
      get-account.ts                    GET    /admin/loyalty/accounts/:customerId
      adjust-points.ts                  POST   /admin/loyalty/accounts/:customerId/adjust
      suspend-account.ts                POST   /admin/loyalty/accounts/:customerId/suspend
      reactivate-account.ts             POST   /admin/loyalty/accounts/:customerId/reactivate
      loyalty-summary.ts                GET    /admin/loyalty/summary
      list-rules.ts                     GET    /admin/loyalty/rules
      create-rule.ts                    POST   /admin/loyalty/rules/create
      update-rule.ts                    PUT    /admin/loyalty/rules/:id/update
      delete-rule.ts                    DELETE /admin/loyalty/rules/:id/delete
      list-tiers.ts                     GET    /admin/loyalty/tiers
      manage-tiers.ts                   POST/PUT/DELETE /admin/loyalty/tiers/*
```

## Options

```ts
LoyaltyOptions {
  enabled?: boolean           // default false; endpoints/pages remain unavailable
  pointsPerDollar?: string   // default "1"
  minRedemption?: string     // minimum points to redeem
  redemptionRate?: string    // e.g. "100" = 100 points per $1
}
```

## Data models

- **loyaltyAccount**: id, customerId (unique), balance, lifetimeEarned, lifetimeRedeemed, tier (bronze|silver|gold|platinum), status (active|suspended|closed)
- **loyaltyTransaction**: id, accountId (FK cascade), type (earn|redeem|adjust|expire), points, description, orderId?, metadata
- **loyaltyRule**: id, name, type (per_dollar|fixed_bonus|multiplier|signup), points, minOrderAmount?, active
- **loyaltyTier**: id, name, slug (unique), minPoints, multiplier, perks (JSON), sortOrder

## Patterns

- Disabled by default. Setting `enabled: true` exposes the loyalty surfaces, but automatic earning remains unavailable until it is driven by an idempotent durable Order fact.
- Requires `customers` module
- `getOrCreateAccount()` auto-provisions loyalty account for new customers
- Three admin pages: overview, rules, tiers
- Declares `search.store` at `/loyalty/store-search`
- Events: loyalty.pointsEarned, loyalty.pointsRedeemed, loyalty.tierChanged, loyalty.accountSuspended, loyalty.accountReactivated
- Option values are strings (not numbers)
