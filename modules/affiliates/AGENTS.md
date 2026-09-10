# Affiliates Module

Affiliate marketing program — partners promote products for commission on sales.

**Scope:** This guide owns Module-specific mechanics. In the 86d.store source checkout, read the repository root [`AGENTS.md`](../../AGENTS.md) for shared rules and gates. In another project, follow that project's instructions and the installed `@86d-store/core` contracts.

## Change protocol

1. **Route.** Read this guide and the Module's [`README.md`](./README.md). In the 86d.store source checkout, storage or cross-Module changes also follow the root [Module contracts](../../AGENTS.md#module-contracts) routes.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** In the 86d.store source checkout, run `bun run generate:modules` after a Module change, then `bun run generate:modules -- --frozen` and the parent gates. In another project, use that project's checks. Run the Module's focused tests when available.
   - Done when the current project's required checks pass; source-checkout work also requires a passing frozen registry check.

## Structure

```
src/
  index.ts              Module factory, AffiliatesOptions, admin nav
  schema.ts             4 entities: affiliate, affiliateLink, affiliateConversion, affiliatePayout
  service.ts            Types + AffiliateController interface
  service-impl.ts       Controller implementation (ModuleDataService)
  store/endpoints/      5 public endpoints (apply, dashboard, links, track)
  admin/endpoints/      15 admin endpoints (CRUD affiliates, conversions, payouts, stats)
  admin/components/
    index.tsx             Admin UI (AffiliateList, ApplicationList, ConversionList, PayoutList) — "use client"
  __tests__/            74 tests covering all operations
```

## Data models

| Entity | Key fields |
| --- | --- |
| `affiliate` | name, email, website, code, commissionRate, status, totals (clicks/conversions/revenue/commission/paid) |
| `affiliateLink` | affiliateId, targetUrl, slug, clicks, conversions, revenue, active |
| `affiliateConversion` | affiliateId, linkId, orderId, orderAmount, commissionRate, commissionAmount, status |
| `affiliatePayout` | affiliateId, amount, method, reference, status, paidAt |

## Status flows

- **Affiliate**: `pending` → `approved` / `rejected`; `approved` → `suspended`
- **Conversion**: `pending` → `approved` / `rejected`
- **Payout**: `pending` → `processing` → `completed` / `failed`

## Options

| Key | Default | Description |
| --- | --- | --- |
| `defaultCommissionRate` | `"10"` | Default % for newly approved affiliates |
| `minimumPayout` | `"50"` | Minimum payout amount |
| `cookieDurationDays` | `"30"` | Tracking cookie lifetime in days |

## Patterns

- Commission is calculated at conversion time from affiliate's current `commissionRate`
- `approveConversion` updates affiliate aggregate totals (totalConversions, totalRevenue, totalCommission)
- `completePayout` updates affiliate `totalPaid`; balance = totalCommission - totalPaid
- `createPayout` validates amount <= balance; returns null if exceeds
- Links require approved affiliate; suspended/pending affiliates cannot create links or conversions
- Click tracking increments both `affiliateLink.clicks` and `affiliate.totalClicks`
- `commissionRate` is 0 until explicitly set via `approveAffiliate(id, rate)` — default is 10%
- Payouts are capped at available balance; no overdraft allowed
- Self-service endpoints find affiliate by `customerId` from session, not by affiliate ID
- `rejectAffiliate` only works on pending status; cannot reject an already-approved affiliate
