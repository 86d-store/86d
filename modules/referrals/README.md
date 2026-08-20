<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/logo" height="96" alt="86d" />
  </a>
</p>

<p align="center">
  Dynamic Commerce
</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use. Please proceed with caution. Use at your own risk.

# Referrals Module

📚 **Documentation:** [86d.app/docs/modules/referrals](https://86d.app/docs/modules/referrals)

Customer referral program with unique shareable codes, referral tracking, and configurable reward rules. Supports percentage discounts, fixed discounts, and store credit rewards for both referrers and referees.

## Installation

```sh
npm install @86d-app/referrals
```

## Usage

```ts
import referrals from "@86d-app/referrals";

const module = referrals({
  maxCodesPerCustomer: "1",
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `maxCodesPerCustomer` | `string` | `"1"` | Maximum referral codes a single customer can create |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/referrals/my-code` | Get the current customer's referral code |
| `GET` | `/referrals/my-referrals` | List the current customer's referrals |
| `GET` | `/referrals/my-stats` | Get referral stats for the current customer |
| `POST` | `/referrals/apply` | Apply a referral code |

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/referrals` | List all referrals |
| `GET` | `/admin/referrals/stats` | Get global referral statistics |
| `GET` | `/admin/referrals/codes` | List all referral codes |
| `GET` | `/admin/referrals/rules` | List reward rules |
| `POST` | `/admin/referrals/rules/create` | Create a reward rule |
| `GET` | `/admin/referrals/codes/:id` | Get a referral code |
| `POST` | `/admin/referrals/codes/:id/deactivate` | Deactivate a referral code |
| `GET` | `/admin/referrals/:id` | Get a referral |
| `POST` | `/admin/referrals/:id/complete` | Complete a referral |
| `POST` | `/admin/referrals/:id/revoke` | Revoke a referral |
| `PUT` | `/admin/referrals/rules/:id/update` | Update a reward rule |
| `DELETE` | `/admin/referrals/rules/:id/delete` | Delete a reward rule |

## Controller API

The `ReferralController` interface is exported for inter-module use (e.g. checkout applying referral discounts).

```ts
interface ReferralController {
  // Codes
  createCode(params: { customerId: string; maxUses?: number; expiresAt?: Date }): Promise<ReferralCode>;
  getCode(id: string): Promise<ReferralCode | null>;
  getCodeByCode(code: string): Promise<ReferralCode | null>;
  getCodeForCustomer(customerId: string): Promise<ReferralCode | null>;
  listCodes(params?: { active?: boolean; take?: number; skip?: number }): Promise<ReferralCode[]>;
  deactivateCode(id: string): Promise<ReferralCode | null>;

  // Referrals
  createReferral(params: { referralCodeId: string; refereeCustomerId: string; refereeEmail: string }): Promise<Referral | null>;
  getReferral(id: string): Promise<Referral | null>;
  listReferrals(params?: { referrerCustomerId?: string; refereeCustomerId?: string; status?: ReferralStatus; take?: number; skip?: number }): Promise<Referral[]>;
  completeReferral(id: string): Promise<Referral | null>;
  revokeReferral(id: string): Promise<Referral | null>;

  // Reward Rules
  createRewardRule(params: { name: string; referrerRewardType: RewardType; referrerRewardValue: number; refereeRewardType: RewardType; refereeRewardValue: number; minOrderAmount?: number }): Promise<ReferralRewardRule>;
  listRewardRules(params?: { active?: boolean }): Promise<ReferralRewardRule[]>;
  updateRewardRule(id: string, params: Partial<ReferralRewardRule>): Promise<ReferralRewardRule | null>;
  deleteRewardRule(id: string): Promise<boolean>;

  // Stats
  getStats(): Promise<ReferralStats>;
  getStatsForCustomer(customerId: string): Promise<{ code: ReferralCode | null; totalReferrals: number; completedReferrals: number; pendingReferrals: number }>;
}
```

## Types

```ts
type ReferralStatus = "pending" | "completed" | "expired" | "revoked";
type RewardType = "percentage_discount" | "fixed_discount" | "store_credit";

interface ReferralCode {
  id: string;
  customerId: string;
  code: string;
  active: boolean;
  usageCount: number;
  maxUses: number;
  expiresAt?: Date;
  createdAt: Date;
}

interface Referral {
  id: string;
  referrerCodeId: string;
  referrerCustomerId: string;
  refereeCustomerId: string;
  refereeEmail: string;
  status: ReferralStatus;
  referrerRewarded: boolean;
  refereeRewarded: boolean;
  completedAt?: Date;
  createdAt: Date;
}

interface ReferralRewardRule {
  id: string;
  name: string;
  referrerRewardType: RewardType;
  referrerRewardValue: number;
  refereeRewardType: RewardType;
  refereeRewardValue: number;
  minOrderAmount: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ReferralStats {
  totalCodes: number;
  totalReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  conversionRate: number;
}
```

## Store Components

### ReferralApply

Provides a form for customers to enter and submit a referral code. Handles validation, displays success or error states, and automatically uppercases the code before submission.

#### Props

None. The component manages its own state and fetches data via the module client.

#### Usage in MDX

```mdx
<ReferralApply />
```

Best used on a checkout page or dedicated referral redemption page where customers can apply a friend's referral code.

### ReferralDashboard

Displays the customer's referral statistics including their referral code, total referrals, completed referrals, and pending referrals. Fetches stats automatically from the module client.

#### Props

None. The component manages its own state and fetches data via the module client.

#### Usage in MDX

```mdx
<ReferralDashboard />
```

Best used on a customer account page to show referral program performance at a glance.

### ReferralShare

Shows the customer's referral code with copy-to-clipboard buttons for both the code and a shareable referral URL. Fetches the customer's referral code and usage count from the module client.

#### Props

None. The component manages its own state and fetches data via the module client.

#### Usage in MDX

```mdx
<ReferralShare />
```

Best used on a referral program page or account dashboard where customers can grab their referral link to share with friends.

## Notes

- Each customer can have up to `maxCodesPerCustomer` referral codes (default 1).
- Setting `maxUses: 0` on a code means unlimited uses.
- Reward fulfillment is tracked independently for referrer (`referrerRewarded`) and referee (`refereeRewarded`).
- The referral flow is: customer generates code, referee applies it, admin completes the referral, then rewards are granted.
