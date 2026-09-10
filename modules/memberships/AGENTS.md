# Memberships Module

Paid membership plans with exclusive benefits, gated products, and member pricing. Customers subscribe to plans that grant access to restricted products and perks like discounts and free shipping.

**Scope:** This guide owns Module-specific mechanics. In the 86d.store source checkout, read the repository root [`AGENTS.md`](../../AGENTS.md) for shared rules and gates. In another project, follow that project's instructions and the installed `@86d-store/core` contracts.

## Change protocol

1. **Route.** Read this guide and the Module's [`README.md`](./README.md). In the 86d.store source checkout, storage or cross-Module changes also follow the root [Module contracts](../../AGENTS.md#module-contracts) routes.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** In the 86d.store source checkout, run `bun run generate:modules` after a Module change, then `bun run generate:modules -- --frozen` and the parent gates. In another project, use that project's checks. Run the Module's focused tests when available.
   - Done when the current project's required checks pass; source-checkout work also requires a passing frozen registry check.

## Structure

```
src/
  index.ts              Factory, types, admin nav, store pages, events
  schema.ts             4 data models (membershipPlan, membership, membershipBenefit, membershipProduct)
  service.ts            MembershipController interface + all types
  service-impl.ts       Full controller implementation
  mdx.d.ts              MDX module type declaration
  store/endpoints/      6 public endpoints (list plans, get plan, subscribe, cancel, check access, my membership)
  store/components/
    index.tsx            Store components barrel — PlanListing, PlanDetail, MyMembership
    _hooks.ts            useMembershipsApi() — store endpoint bindings
    _utils.ts            Formatting helpers (price, interval, benefit labels, status colors)
    plan-listing.tsx     Browse all active membership plans
    plan-listing.mdx     Plan listing layout template
    plan-detail.tsx      Plan detail with benefits, features, subscribe action
    plan-detail.mdx      Plan detail layout template
    my-membership.tsx    Customer membership dashboard (status, benefits, cancel)
    my-membership.mdx    Membership dashboard layout template
  admin/endpoints/      14 admin endpoints (CRUD plans, manage memberships, benefits, product gating, stats)
  admin/components/
    index.tsx            Admin UI (MembershipAdmin, MembershipPlans) — "use client"
  __tests__/
    service-impl.test.ts  63 unit tests covering all controller methods
    endpoint-security.test.ts  15 security tests (customer isolation, ownership, access control)
```

## Options

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `defaultTrialDays` | string | `"0"` | Default trial period for new plans |
| `defaultMaxMembers` | string | — | Max members per plan (unlimited if unset) |

## Data models

- **membershipPlan** — id, name, slug (unique), description?, price, billingInterval (monthly/yearly/lifetime), trialDays, features? (string[]), isActive, maxMembers?, sortOrder
- **membership** — id, customerId (indexed), planId (indexed), status (active/trial/expired/cancelled/paused), startDate, endDate?, trialEndDate?, cancelledAt?, pausedAt?
- **membershipBenefit** — id, planId (indexed), type (discount_percentage/free_shipping/early_access/exclusive_products/priority_support), value, description?, isActive
- **membershipProduct** — id, planId (indexed), productId (indexed), assignedAt

## Patterns

- **One active membership per customer** — subscribing to a new plan auto-cancels the previous one
- **Trial support** — plans with `trialDays > 0` create memberships with `status: "trial"` and `trialEndDate`
- **Lifetime plans** — no `endDate` set; monthly/yearly get calculated end dates
- **Max members** — enforced on subscribe; counts active + trial members
- **Product gating** — products can be gated to specific plans; `canAccessProduct` returns true for ungated products, checks membership for gated ones
- **Benefits** — typed perks (discount_percentage, free_shipping, etc.) attached to plans; `getCustomerBenefits` only returns active benefits for active/trial members
- **Cascade delete** — deleting a plan removes its benefits, gated products, and memberships

## Events

Emits: `membership.subscribed`, `membership.cancelled`, `membership.paused`, `membership.resumed`, `membership.expired`, `membership.plan.created/updated/deleted`, `membership.benefit.added/removed`, `membership.product.gated/ungated`

Requires: `customers`

## Store pages

| Path | Component | Description |
|------|-----------|-------------|
| `/memberships` | `PlanListing` | Browse all active membership plans |
| `/memberships/:slug` | `PlanDetail` | Plan detail with subscribe action |

## Security

- **Session-derived identity**: `get-membership` and `check-access` derive `customerId` from `session.user.id`, never from query/body
- **Ownership before mutation**: `cancel` endpoint verifies `membership.customerId === session.user.id` BEFORE calling `cancelMembership`
- **Unauthenticated access**: `check-access` returns `{ hasAccess: false }` for unauthenticated requests (no 401)

- `gateProduct` is idempotent — re-gating the same product returns the existing record
- `pauseMembership` only works on active/trial memberships; `resumeMembership` only works on paused ones
- `cancelMembership` on already-cancelled returns the membership unchanged (no error)
- Store endpoints only return active plans; admin endpoints show all
- Store components follow TSX + MDX pattern: logic in `.tsx`, presentation in `.mdx`

