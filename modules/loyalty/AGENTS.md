# Loyalty Module

Points-based loyalty program with tiered rewards, earning rules, and order-event integration.

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
