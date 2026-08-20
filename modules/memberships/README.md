

# @86d-app/memberships

📚 **Documentation:** [86d.app/docs/modules/memberships](https://86d.app/docs/modules/memberships)

Paid membership plans for your commerce store. Create tiered subscription plans with exclusive benefits, gated products, and member-only pricing. Supports monthly, yearly, and lifetime billing intervals with optional trial periods.

## Installation

The memberships module is included in the 86d platform. Enable it in your store's `config.json`:

```json
{
  "modules": {
    "memberships": {}
  }
}
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultTrialDays` | string | `"0"` | Default trial period for plans |
| `defaultMaxMembers` | string | — | Max members per plan |

## Usage

```ts
import memberships from "@86d-app/memberships";

// In your store configuration
memberships({
  defaultTrialDays: "14",
});
```

## Store Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/memberships/plans` | List active plans |
| GET | `/memberships/plans/:slug` | Get plan details with benefits |
| GET | `/memberships/my-membership` | Get customer's current membership |
| POST | `/memberships/subscribe` | Subscribe to a plan |
| POST | `/memberships/cancel` | Cancel a membership |
| GET | `/memberships/check-access` | Check if customer can access a product |

### List plans

```
GET /memberships/plans?take=50&skip=0
→ { plans: MembershipPlan[] }
```

### Get plan details

```
GET /memberships/plans/gold
→ { plan: MembershipPlan, benefits: MembershipBenefit[] }
```

### Subscribe (requires auth)

```
POST /memberships/subscribe
{ planId: string }
→ { membership: Membership }
```

Customer ID is derived from the session — never provided by the client.

### Check product access (requires auth)

```
GET /memberships/check-access?productId=prod_1
→ { hasAccess: boolean }
```

Returns `{ hasAccess: false }` for unauthenticated requests. Customer ID is derived from the session.

## Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/memberships` | List all memberships (filter by status, planId) |
| GET | `/admin/memberships/stats` | Dashboard statistics |
| GET | `/admin/memberships/plans` | List all plans |
| POST | `/admin/memberships/plans/create` | Create a plan |
| POST | `/admin/memberships/plans/:id/update` | Update a plan |
| POST | `/admin/memberships/plans/:id/delete` | Delete a plan (cascades) |
| GET | `/admin/memberships/:id` | Get membership details |
| POST | `/admin/memberships/:id/cancel` | Cancel a membership |
| POST | `/admin/memberships/:id/pause` | Pause a membership |
| POST | `/admin/memberships/:id/resume` | Resume a paused membership |
| POST | `/admin/memberships/plans/:planId/benefits/add` | Add benefit to plan |
| POST | `/admin/memberships/benefits/:id/remove` | Remove a benefit |
| POST | `/admin/memberships/plans/:planId/products/gate` | Gate products to plan |
| POST | `/admin/memberships/plans/:planId/products/ungate` | Ungate products |

## Store UI

The module includes customer-facing store components in `src/store/components/` (TSX logic + MDX templates):

| Page | Component | Description |
|------|-----------|-------------|
| `/memberships` | `PlanListing` | Browse all active membership plans with pricing and features |
| `/memberships/:slug` | `PlanDetail` | Plan detail with benefits, features list, and subscribe action |
| (embeddable) | `MyMembership` | Customer membership dashboard — view status, benefits, cancel |

## Admin UI

The module includes admin UI components in `src/admin/components/index.tsx` (client components using `useModuleClient`):

| Page | Component | Description |
|------|-----------|-------------|
| `/admin/memberships` | `MembershipAdmin` | Membership list with status filters, member management |
| `/admin/memberships/plans` | `MembershipPlans` | Plan list with create/edit forms, benefit and product gating management |

## Service API

The `MembershipController` provides 24 methods:

### Plans
- `createPlan(params)` — Create a membership plan
- `getPlan(id)` — Get plan by ID
- `getPlanBySlug(slug)` — Get plan by URL slug
- `updatePlan(id, params)` — Update plan fields (null clears optional fields)
- `deletePlan(id)` — Delete plan with cascade
- `listPlans(params?)` — List plans with filtering and pagination
- `countPlans(params?)` — Count plans

### Memberships
- `subscribe({ customerId, planId })` — Subscribe customer (auto-cancels previous)
- `cancelMembership(id)` — Cancel membership
- `pauseMembership(id)` — Pause active/trial membership
- `resumeMembership(id)` — Resume paused membership
- `getMembership(id)` — Get by ID
- `getCustomerMembership(customerId)` — Get active membership with plan
- `listMemberships(params?)` — List with filters
- `countMemberships(params?)` — Count with filters

### Benefits
- `addBenefit(params)` — Add benefit to plan
- `removeBenefit(id)` — Remove benefit
- `listBenefits(planId)` — List plan benefits
- `getCustomerBenefits(customerId)` — Get active benefits for member

### Product Gating
- `gateProduct({ planId, productId })` — Gate product to plan
- `ungateProduct({ planId, productId })` — Remove gate
- `listGatedProducts({ planId })` — List gated products
- `countGatedProducts(planId)` — Count gated products
- `canAccessProduct({ customerId, productId })` — Check access

### Admin
- `getStats()` — Dashboard statistics

## Types

```ts
type BillingInterval = "monthly" | "yearly" | "lifetime";
type MembershipStatus = "active" | "trial" | "expired" | "cancelled" | "paused";
type BenefitType = "discount_percentage" | "free_shipping" | "early_access" | "exclusive_products" | "priority_support";
```

## Notes

- A customer can have only one active membership at a time
- Subscribing to a new plan automatically cancels the previous one
- Plans with `trialDays > 0` start memberships in `trial` status
- Lifetime plans have no expiration date
- Product gating is plan-specific — a product can be gated to multiple plans
- `canAccessProduct` returns `true` for ungated products (no membership required)
- Deleting a plan cascades to its benefits, gated products, and memberships
