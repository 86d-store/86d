

# @86d-app/affiliates

📚 **Documentation:** [86d.app/docs/modules/affiliates](https://86d.app/docs/modules/affiliates)

Affiliate marketing program module for the 86d commerce platform. Partners apply, get approved, create tracking links, earn commission on referred sales, and receive payouts.

## Installation

```ts
import affiliates from "@86d-app/affiliates";

export default defineStore({
  modules: [
    affiliates({
      defaultCommissionRate: "10",
      minimumPayout: "50",
      cookieDurationDays: "30",
    }),
  ],
});
```

## Configuration

| Option                 | Type     | Default | Description                              |
|------------------------|----------|---------|------------------------------------------|
| `defaultCommissionRate`| `string` | `"10"`  | Default commission % for new affiliates  |
| `minimumPayout`        | `string` | `"50"`  | Minimum payout threshold                 |
| `cookieDurationDays`   | `string` | `"30"`  | How long referral tracking cookie lasts  |

## Store endpoints

| Path                         | Method | Description                           |
|------------------------------|--------|---------------------------------------|
| `/affiliates/apply`          | POST   | Submit affiliate application          |
| `/affiliates/dashboard`      | GET    | Affiliate self-service dashboard      |
| `/affiliates/my-links`       | GET    | List affiliate's own tracking links   |
| `/affiliates/links/create`   | POST   | Create a new tracking link            |
| `/affiliates/track`          | POST   | Record a click on a tracking link     |

## Admin endpoints

| Path                                          | Method | Description                     |
|-----------------------------------------------|--------|---------------------------------|
| `/admin/affiliates`                           | GET    | List all affiliates             |
| `/admin/affiliates/stats`                     | GET    | Program-wide statistics         |
| `/admin/affiliates/:id`                       | GET    | Affiliate detail + balance      |
| `/admin/affiliates/:id/approve`               | POST   | Approve application             |
| `/admin/affiliates/:id/suspend`               | POST   | Suspend affiliate               |
| `/admin/affiliates/:id/reject`                | POST   | Reject application              |
| `/admin/affiliates/:id/update`                | POST   | Update affiliate fields         |
| `/admin/affiliates/conversions`               | GET    | List conversions                |
| `/admin/affiliates/conversions/:id/approve`   | POST   | Approve conversion              |
| `/admin/affiliates/conversions/:id/reject`    | POST   | Reject conversion               |
| `/admin/affiliates/links`                     | GET    | List tracking links             |
| `/admin/affiliates/payouts`                   | GET    | List payouts                    |
| `/admin/affiliates/payouts/create`            | POST   | Create a payout                 |
| `/admin/affiliates/payouts/:id/complete`      | POST   | Mark payout completed           |
| `/admin/affiliates/payouts/:id/fail`          | POST   | Mark payout failed              |

## Admin UI

The module includes admin UI components in `src/admin/components/index.tsx` (client components using `useModuleClient`):

| Page | Component | Description |
|------|-----------|-------------|
| `/admin/affiliates` | `AffiliateList` | Affiliate list with stats, status management, and detail views |
| `/admin/affiliates/applications` | `ApplicationList` | Pending applications with approve/reject actions |
| `/admin/affiliates/conversions` | `ConversionList` | Conversion list with approve/reject actions |
| `/admin/affiliates/payouts` | `PayoutList` | Payout list with creation and status management |

## Controller API

```ts
interface AffiliateController {
  // Applications
  apply(params): Promise<Affiliate>
  getAffiliate(id): Promise<Affiliate | null>
  getAffiliateByCode(code): Promise<Affiliate | null>
  getAffiliateByEmail(email): Promise<Affiliate | null>
  listAffiliates(params?): Promise<Affiliate[]>
  approveAffiliate(id, commissionRate?): Promise<Affiliate | null>
  suspendAffiliate(id): Promise<Affiliate | null>
  rejectAffiliate(id): Promise<Affiliate | null>
  updateAffiliate(id, params): Promise<Affiliate | null>

  // Links
  createLink(params): Promise<AffiliateLink | null>
  getLink(id): Promise<AffiliateLink | null>
  getLinkBySlug(slug): Promise<AffiliateLink | null>
  listLinks(params?): Promise<AffiliateLink[]>
  recordClick(linkId): Promise<AffiliateLink | null>
  deactivateLink(id): Promise<AffiliateLink | null>

  // Conversions
  recordConversion(params): Promise<AffiliateConversion | null>
  getConversion(id): Promise<AffiliateConversion | null>
  listConversions(params?): Promise<AffiliateConversion[]>
  approveConversion(id): Promise<AffiliateConversion | null>
  rejectConversion(id): Promise<AffiliateConversion | null>

  // Payouts
  createPayout(params): Promise<AffiliatePayout | null>
  getPayout(id): Promise<AffiliatePayout | null>
  listPayouts(params?): Promise<AffiliatePayout[]>
  completePayout(id): Promise<AffiliatePayout | null>
  failPayout(id): Promise<AffiliatePayout | null>

  // Stats
  getStats(): Promise<AffiliateStats>
  getAffiliateBalance(affiliateId): Promise<{ totalCommission, totalPaid, balance }>
}
```

## Types

```ts
type AffiliateStatus = "pending" | "approved" | "suspended" | "rejected"
type ConversionStatus = "pending" | "approved" | "rejected"
type PayoutStatus = "pending" | "processing" | "completed" | "failed"
type PayoutMethod = "bank_transfer" | "paypal" | "store_credit" | "check"
```

## How it works

1. **Apply** — Anyone submits an application with name, email, optional website
2. **Approve** — Admin reviews and approves with a commission rate (default 10%)
3. **Links** — Approved affiliates create tracking links to specific pages/products
4. **Clicks** — When visitors click affiliate links, clicks are tracked
5. **Conversions** — When tracked visitors purchase, a conversion is recorded with calculated commission
6. **Approve conversion** — Admin reviews and approves conversions, updating affiliate totals
7. **Payouts** — Admin creates payouts up to the affiliate's available balance
8. **Complete** — Payout is marked complete, updating the affiliate's `totalPaid`

## Notes

- Commission is calculated at conversion time: `orderAmount * (commissionRate / 100)`
- Affiliates can only create links and earn conversions while in `approved` status
- Payouts cannot exceed `totalCommission - totalPaid` (no overdraft)
- Each affiliate gets a unique 8-character tracking code on application
- Each link gets a unique 10-character slug for URL tracking
