# Affiliates Module

Affiliate marketing program — partners promote products for commission on sales.

## File structure

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

## Data model

| Entity               | Key fields                                                             |
|-----------------------|------------------------------------------------------------------------|
| `affiliate`           | name, email, website, code, commissionRate, status, totals (clicks/conversions/revenue/commission/paid) |
| `affiliateLink`       | affiliateId, targetUrl, slug, clicks, conversions, revenue, active     |
| `affiliateConversion` | affiliateId, linkId, orderId, orderAmount, commissionRate, commissionAmount, status |
| `affiliatePayout`     | affiliateId, amount, method, reference, status, paidAt                 |

## Status flows

- **Affiliate**: `pending` → `approved` / `rejected`; `approved` → `suspended`
- **Conversion**: `pending` → `approved` / `rejected`
- **Payout**: `pending` → `processing` → `completed` / `failed`

## Options

| Key                    | Default | Description                        |
|------------------------|---------|------------------------------------|
| `defaultCommissionRate`| `"10"`  | Default % for newly approved affiliates |
| `minimumPayout`        | `"50"`  | Minimum payout amount              |
| `cookieDurationDays`   | `"30"`  | Tracking cookie lifetime in days   |

## Key patterns

- Commission is calculated at conversion time from affiliate's current `commissionRate`
- `approveConversion` updates affiliate aggregate totals (totalConversions, totalRevenue, totalCommission)
- `completePayout` updates affiliate `totalPaid`; balance = totalCommission - totalPaid
- `createPayout` validates amount <= balance; returns null if exceeds
- Links require approved affiliate; suspended/pending affiliates cannot create links or conversions
- Click tracking increments both `affiliateLink.clicks` and `affiliate.totalClicks`

## Gotchas

- `commissionRate` is 0 until explicitly set via `approveAffiliate(id, rate)` — default is 10%
- Payouts are capped at available balance; no overdraft allowed
- Self-service endpoints find affiliate by `customerId` from session, not by affiliate ID
- `rejectAffiliate` only works on pending status; cannot reject an already-approved affiliate
