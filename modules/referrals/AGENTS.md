# Referrals Module

Customer referral program with unique codes, referral tracking, and configurable reward rules for both referrer and referee.

## Structure

```
src/
  index.ts          Factory: referrals(options?) => Module
  schema.ts         Zod models: referralCode, referral, rewardRule
  service.ts        ReferralController interface + types
  service-impl.ts   ReferralController implementation
  admin/
    components/
      index.tsx            Admin component exports
      referral-list.tsx    Referral list table (.tsx logic)
      referral-list.mdx    Admin template
      code-list.tsx        Code management table (.tsx logic)
      code-list.mdx        Admin template
      reward-rules.tsx     Reward rule editor (.tsx logic)
      reward-rules.mdx     Admin template
    endpoints/
      index.ts             Endpoint map
      list-referrals.ts    GET  /admin/referrals
      get-referral.ts      GET  /admin/referrals/:id
      complete-referral.ts POST /admin/referrals/:id/complete
      revoke-referral.ts   POST /admin/referrals/:id/revoke
      list-codes.ts        GET  /admin/referrals/codes
      get-code.ts          GET  /admin/referrals/codes/:id
      deactivate-code.ts   POST /admin/referrals/codes/:id/deactivate
      stats.ts             GET  /admin/referrals/stats
      list-reward-rules.ts GET  /admin/referrals/rules
      create-reward-rule.ts POST /admin/referrals/rules/create
      update-reward-rule.ts PUT  /admin/referrals/rules/:id/update
      delete-reward-rule.ts DELETE /admin/referrals/rules/:id/delete
  store/
    components/
      _hooks.ts              Client-side hooks
      index.tsx              Store component exports
      referral-share.tsx     Share referral code UI
      referral-share.mdx     Store template
      referral-dashboard.tsx Customer referral stats
      referral-dashboard.mdx Store template
      referral-apply.tsx     Apply referral code form
      referral-apply.mdx     Store template
    endpoints/
      index.ts               Endpoint map
      get-my-code.ts         GET  /referrals/my-code
      my-referrals.ts        GET  /referrals/my-referrals
      my-stats.ts            GET  /referrals/my-stats
      apply-code.ts          POST /referrals/apply
```

## Options

```ts
ReferralsOptions {
  maxCodesPerCustomer?: string  // default "1"
}
```

## Data models

- **referralCode**: id, customerId, code, active, usageCount, maxUses (0 = unlimited), expiresAt?, createdAt
- **referral**: id, referrerCodeId, referrerCustomerId, refereeCustomerId, refereeEmail, status (pending|completed|expired|revoked), referrerRewarded, refereeRewarded, completedAt?, createdAt
- **rewardRule**: id, name, referrerRewardType, referrerRewardValue, refereeRewardType, refereeRewardValue, minOrderAmount, active, createdAt, updatedAt

## Patterns

- Reward types: percentage_discount, fixed_discount, store_credit
- Referral flow: customer gets code -> referee applies code -> admin completes -> rewards granted
- `referrerRewarded` / `refereeRewarded` booleans track independent reward fulfillment
- Stats endpoint returns totalCodes, totalReferrals, completedReferrals, pendingReferrals, conversionRate
- `maxUses: 0` means unlimited uses for a referral code
