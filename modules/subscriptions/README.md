<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/icon" height="96" alt="86d" />
  </a>
</p>

<p align="center">
  The Modern Foundation for Commerce
</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use. Please proceed with caution. Use at your own risk. 

📚 **Documentation:** [86d.app/docs/modules/subscriptions](https://86d.app/docs/modules/subscriptions)

# Subscriptions Module

Subscription plan and subscriber management for the 86d commerce platform. The live Store endpoint activates free plans and paid plans during a free trial. Non-trial paid activation returns `SUBSCRIPTION_PAYMENT_ACTIVATION_UNAVAILABLE` until payment proof consumption is purpose-bound and duplicate-safe.

![version](https://img.shields.io/badge/version-0.0.1-blue) ![license](https://img.shields.io/badge/license-MIT-green)

## Installation

```sh
npm install @86d-app/subscriptions
```

## Usage

```ts
import subscriptions from "@86d-app/subscriptions";
import { createModuleClient } from "@86d-app/core";

const client = createModuleClient([
  subscriptions({
    currency: "USD",
  }),
]);
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `currency` | `string` | `undefined` | Default currency for subscription plans |

## Subscription Lifecycle

```
subscribe()           → active
                        └─ if plan.trialDays > 0 → trialing
expireSubscriptions() → expired   (currentPeriodEnd < now)
cancelSubscription()  → cancelled (immediate or at period end)
renewSubscription()   → active    (advances period dates)
```

## Billing Intervals

| Interval | Description |
|---|---|
| `day` | Daily billing |
| `week` | Weekly billing |
| `month` | Monthly billing |
| `year` | Annual billing |

`intervalCount` multiplies the interval (e.g. `interval: "month", intervalCount: 3` = quarterly).

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/subscriptions/subscribe` | Subscribe to a free plan or begin a configured free trial; paid activation otherwise returns 503 |
| `GET` | `/subscriptions/me` | Get subscriptions for an email address |
| `POST` | `/subscriptions/me/cancel` | Cancel a subscription |

Query parameters for `GET /subscriptions/me`: `email` (required)

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/subscriptions` | List all subscriptions |
| `GET` | `/admin/subscriptions/:id` | Get a subscription by ID |
| `GET` | `/admin/subscriptions/plans` | List all plans |
| `POST` | `/admin/subscriptions/plans/create` | Create a subscription plan |
| `PUT` | `/admin/subscriptions/plans/:id/update` | Update a plan |
| `DELETE` | `/admin/subscriptions/plans/:id/delete` | Delete a plan |

## Controller API

```ts
// ── Plans ──────────────────────────────────────────────────────────────

controller.createPlan(params: {
  name: string;
  description?: string;
  price: number;          // in cents
  currency?: string;
  interval: SubscriptionInterval;
  intervalCount?: number; // default 1
  trialDays?: number;
  isActive?: boolean;
}): Promise<SubscriptionPlan>

controller.getPlan(id: string): Promise<SubscriptionPlan | null>

controller.listPlans(params?: {
  activeOnly?: boolean;
  take?: number;
  skip?: number;
}): Promise<SubscriptionPlan[]>

controller.updatePlan(id: string, params: {
  name?: string;
  description?: string;
  price?: number;
  trialDays?: number;
  isActive?: boolean;
}): Promise<SubscriptionPlan | null>

controller.deletePlan(id: string): Promise<boolean>

// ── Subscriptions ──────────────────────────────────────────────────────

// Subscribe a customer to a plan
// Sets status to "trialing" if the plan has trialDays > 0
controller.subscribe(params: {
  planId: string;
  email: string;
  customerId?: string;
}): Promise<Subscription>

controller.getSubscription(id: string): Promise<Subscription | null>

controller.getSubscriptionByEmail(params: {
  email: string;
  planId?: string;
}): Promise<Subscription | null>

// Cancel immediately or flag for end-of-period cancellation
controller.cancelSubscription(params: {
  id: string;
  cancelAtPeriodEnd?: boolean;
}): Promise<Subscription | null>

// Advance period dates to the next billing cycle
controller.renewSubscription(id: string): Promise<Subscription | null>

// Mark overdue subscriptions as expired — call periodically (e.g. cron)
// Scans active and trialing subscriptions; returns the count expired
controller.expireSubscriptions(): Promise<number>

controller.listSubscriptions(params?: {
  email?: string;
  planId?: string;
  status?: SubscriptionStatus;
  take?: number;
  skip?: number;
}): Promise<Subscription[]>
```

## Example: Full Subscription Flow

```ts
// Create a monthly plan with a 14-day trial
const plan = await controller.createPlan({
  name: "Pro",
  price: 1999,
  interval: "month",
  trialDays: 14,
});

// Subscribe a customer
const sub = await controller.subscribe({
  planId: plan.id,
  email: "user@example.com",
  customerId: "cust_123",
});
// sub.status === "trialing"

// On webhook from payment provider: renew
await controller.renewSubscription(sub.id);

// Customer cancels at end of period
await controller.cancelSubscription({ id: sub.id, cancelAtPeriodEnd: true });

// Cron job: expire overdue subscriptions
const count = await controller.expireSubscriptions();
```

## Types

```ts
type SubscriptionInterval = "day" | "week" | "month" | "year";

type SubscriptionStatus = "active" | "trialing" | "cancelled" | "expired" | "past_due";

interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  interval: SubscriptionInterval;
  intervalCount: number;
  trialDays?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Subscription {
  id: string;
  planId: string;
  customerId?: string;
  email: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart?: Date;
  trialEnd?: Date;
  cancelledAt?: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

## Store Components

### SubscriptionPlans

Displays a grid of available subscription plans with subscribe functionality. Fetches its own data.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `email` | `string` | — | Pre-fill subscriber email |
| `customerId` | `string` | — | Customer ID for authenticated subscriptions |
| `title` | `string` | — | Section heading |
| `onSubscribed` | `(subscription) => void` | — | Callback after successful subscription |

#### Usage in MDX

```mdx
<SubscriptionPlans />

<SubscriptionPlans email={customerEmail} title="Choose a Plan" />
```

### MySubscriptions

Lists a customer's active subscriptions with cancellation options. Fetches its own data.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `email` | `string` | — | Customer email (required) |
| `title` | `string` | — | Section heading |

#### Usage in MDX

```mdx
<MySubscriptions email={customerEmail} />

<MySubscriptions email={customerEmail} title="Your Subscriptions" />
```

Typically placed on a customer account page.

### PlanCard

Individual subscription plan card. Used internally by SubscriptionPlans.

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `plan` | `SubscriptionPlan` | Plan object with id, name, description, price, currency, interval, intervalCount, trialDays, isActive |
| `onSubscribe` | `(planId: string) => void` | Callback when subscribe button is clicked |
| `subscribing` | `boolean` | Loading state for the subscribe action |

#### Usage in MDX

```mdx
<PlanCard plan={plan} onSubscribe={handleSubscribe} subscribing={false} />
```

### SubscriptionCard

Individual active subscription card with status and cancel options. Used internally by MySubscriptions.

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `subscription` | `Subscription` | Subscription object with id, planId, email, status, currentPeriodStart/End, cancelAtPeriodEnd, createdAt |
| `cancelling` | `boolean` | Loading state for the cancel action |
| `onCancel` | `(atPeriodEnd: boolean) => void` | Callback to cancel. `true` = cancel at period end, `false` = cancel immediately |

#### Usage in MDX

```mdx
<SubscriptionCard subscription={sub} cancelling={false} onCancel={handleCancel} />
```
