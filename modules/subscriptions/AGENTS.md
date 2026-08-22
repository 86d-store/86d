# Subscriptions Module

Subscription plan and subscriber management. Handles trial and subscription lifecycle status only. Free plans and paid plans with a free trial can be activated through the Store endpoint. Non-trial paid activation remains unavailable until P3 provides purpose-bound, duplicate-safe payment proof consumption.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

```
src/
  index.ts          Factory: subscriptions(options?) => Module
  schema.ts         Models: subscriptionPlan, subscription
  service.ts        SubscriptionController interface + types
  service-impl.ts   SubscriptionController implementation
  endpoints/
    store/          Customer-facing
      subscribe.ts              POST /subscriptions/subscribe
      get-my-subscriptions.ts   GET  /subscriptions/me?email=
      cancel.ts                 POST /subscriptions/me/cancel
    admin/          Protected (store admin only)
      list-subscriptions.ts     GET    /admin/subscriptions
      get-subscription.ts       GET    /admin/subscriptions/:id
      list-plans.ts             GET    /admin/subscriptions/plans
      create-plan.ts            POST   /admin/subscriptions/plans/create
      update-plan.ts            PUT    /admin/subscriptions/plans/:id/update
      delete-plan.ts            DELETE /admin/subscriptions/plans/:id/delete
  __tests__/
    service-impl.test.ts    49 tests (CRUD, lifecycle, events)
    controllers.test.ts     47 tests (edge cases, intervals, data integrity)
```

## Data models

- **subscriptionPlan**: id, name, description?, price (cents), currency, interval, intervalCount, trialDays?, isActive, createdAt, updatedAt
- **subscription**: id, planId, customerId?, email, status, currentPeriodStart, currentPeriodEnd, trialStart?, trialEnd?, cancelledAt?, cancelAtPeriodEnd, createdAt, updatedAt

## Subscription lifecycle

```
(subscribe) → active
              └─ if trialDays > 0 → trialing
(expireSubscriptions) → expired   (currentPeriodEnd < now)
(cancelSubscription)  → cancelled (immediate) or cancelAtPeriodEnd=true flag
(renewSubscription)   → active    (advance period dates)
```

## Intervals

`calculateNextPeriod(interval, intervalCount, from?)` computes the next billing period:
- `day` → add N days
- `week` → add N×7 days
- `month` → add N months
- `year` → add N years
- Used in both `subscribe` (from now) and `renewSubscription` (from currentPeriodEnd)

## Exports

Types exported: `Subscription`, `SubscriptionPlan`, `SubscriptionController`, `SubscriptionInterval`, `SubscriptionStatus`

## Patterns

- `exactOptionalPropertyTypes` compatible: all optional params use `T | undefined`
- `updatePlan` uses explicit conditional field assignment (NOT `Object.fromEntries`) to satisfy exactOptionalPropertyTypes
- `findMany` uses spread pattern for optional take/skip
- `expireSubscriptions` scans up to 10,000 records — callers should invoke periodically (cron)
- No payment processing — this module is payment-provider agnostic
- The live subscribe endpoint returns `SUBSCRIPTION_PAYMENT_ACTIVATION_UNAVAILABLE` for a paid plan without a trial; it never trusts or persists a caller-supplied payment intent
