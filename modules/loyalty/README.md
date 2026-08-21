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

📚 **Documentation:** [86d.app/docs/modules/loyalty](https://86d.app/docs/modules/loyalty)

# Loyalty Module

Points-based loyalty program with tiered rewards, configurable earning rules, and automatic point accrual on order placement. Supports bronze/silver/gold/platinum tiers with custom perks and multipliers.

## Installation

```sh
npm install @86d-app/loyalty
```

## Usage

```ts
import loyalty from "@86d-app/loyalty";

const module = loyalty({
  pointsPerDollar: "1",
  minRedemption: "100",
  redemptionRate: "100", // 100 points = $1
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `pointsPerDollar` | `string` | `"1"` | Points earned per dollar spent |
| `minRedemption` | `string` | - | Minimum points required for redemption |
| `redemptionRate` | `string` | - | Points-to-currency conversion rate (e.g. 100 points = $1) |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/loyalty/store-search` | Search loyalty data (store search integration) |
| `GET` | `/loyalty/balance` | Get the current customer's loyalty balance |
| `GET` | `/loyalty/transactions` | List point transaction history |
| `GET` | `/loyalty/tiers` | List all loyalty tiers |
| `GET` | `/loyalty/calculate` | Calculate points for an order amount |
| `POST` | `/loyalty/redeem` | Redeem points |

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/loyalty/accounts` | List loyalty accounts (filterable by tier, status) |
| `GET` | `/admin/loyalty/accounts/:customerId` | Get a customer's loyalty account |
| `POST` | `/admin/loyalty/accounts/:customerId/adjust` | Manually adjust points |
| `POST` | `/admin/loyalty/accounts/:customerId/suspend` | Suspend a loyalty account |
| `POST` | `/admin/loyalty/accounts/:customerId/reactivate` | Reactivate a suspended account |
| `GET` | `/admin/loyalty/summary` | Get program-wide loyalty summary |
| `GET` | `/admin/loyalty/rules` | List earning rules |
| `POST` | `/admin/loyalty/rules/create` | Create an earning rule |
| `PUT` | `/admin/loyalty/rules/:id/update` | Update an earning rule |
| `DELETE` | `/admin/loyalty/rules/:id/delete` | Delete an earning rule |
| `GET` | `/admin/loyalty/tiers` | List loyalty tiers |
| `POST` | `/admin/loyalty/tiers/create` | Create a tier |
| `PUT` | `/admin/loyalty/tiers/:id/update` | Update a tier |
| `DELETE` | `/admin/loyalty/tiers/:id/delete` | Delete a tier |

## Controller API

The `LoyaltyController` interface is exported for inter-module use.

```ts
interface LoyaltyController {
  // Accounts
  getOrCreateAccount(customerId: string): Promise<LoyaltyAccount>;
  getAccount(customerId: string): Promise<LoyaltyAccount | null>;
  getAccountById(id: string): Promise<LoyaltyAccount | null>;
  suspendAccount(customerId: string): Promise<LoyaltyAccount>;
  reactivateAccount(customerId: string): Promise<LoyaltyAccount>;

  // Points
  earnPoints(params: { customerId: string; points: number; description: string; orderId?: string }): Promise<LoyaltyTransaction>;
  redeemPoints(params: { customerId: string; points: number; description: string; orderId?: string }): Promise<LoyaltyTransaction>;
  adjustPoints(params: { customerId: string; points: number; description: string }): Promise<LoyaltyTransaction>;

  // Transactions
  listTransactions(accountId: string, params?: { type?: TransactionType; take?: number; skip?: number }): Promise<LoyaltyTransaction[]>;

  // Rules
  createRule(params: { name: string; type: LoyaltyRule["type"]; points: number; minOrderAmount?: number }): Promise<LoyaltyRule>;
  updateRule(id: string, params: { name?: string; points?: number; minOrderAmount?: number; active?: boolean }): Promise<LoyaltyRule | null>;
  deleteRule(id: string): Promise<boolean>;
  listRules(activeOnly?: boolean): Promise<LoyaltyRule[]>;
  calculateOrderPoints(orderAmount: number): Promise<number>;

  // Tiers
  listTiers(): Promise<LoyaltyTier[]>;
  getTier(slug: string): Promise<LoyaltyTier | null>;
  createTier(params: { name: string; slug: string; minPoints: number; multiplier?: number; perks?: Record<string, unknown> }): Promise<LoyaltyTier>;
  updateTier(id: string, params: Partial<LoyaltyTier>): Promise<LoyaltyTier | null>;
  deleteTier(id: string): Promise<boolean>;

  // Admin
  listAccounts(params?: { tier?: LoyaltyTierSlug; status?: AccountStatus; take?: number; skip?: number }): Promise<LoyaltyAccount[]>;
  getSummary(): Promise<LoyaltySummary>;
}
```

## Types

```ts
type LoyaltyTierSlug = "bronze" | "silver" | "gold" | "platinum";
type TransactionType = "earn" | "redeem" | "adjust" | "expire";
type AccountStatus = "active" | "suspended" | "closed";

interface LoyaltyAccount {
  id: string;
  customerId: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  tier: LoyaltyTierSlug;
  status: AccountStatus;
  createdAt: Date;
  updatedAt: Date;
}

interface LoyaltyTransaction {
  id: string;
  accountId: string;
  type: TransactionType;
  points: number;
  description: string;
  orderId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

interface LoyaltyRule {
  id: string;
  name: string;
  type: "per_dollar" | "fixed_bonus" | "multiplier" | "signup";
  points: number;
  minOrderAmount?: number;
  active: boolean;
  createdAt: Date;
}

interface LoyaltyTier {
  id: string;
  name: string;
  slug: string;
  minPoints: number;
  multiplier: number;
  perks?: Record<string, unknown>;
  sortOrder: number;
}

interface LoyaltySummary {
  totalAccounts: number;
  totalPointsOutstanding: number;
  totalLifetimeEarned: number;
  tierBreakdown: Array<{ tier: LoyaltyTierSlug; count: number }>;
}
```

## Store Components

### PointsBalance

Displays the customer's current loyalty points balance with tier badge and lifetime stats.

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `customerId` | `string` | No | Customer ID. Shows sign-in prompt if omitted. |

#### Usage

```mdx
<PointsBalance customerId={session.customerId} />
```

#### States

- **Signed out**: Prompts the user to sign in.
- **Loading**: Animated skeleton placeholder.
- **Loaded**: Balance number, tier badge (bronze/silver/gold/platinum), lifetime earned/redeemed stats.

---

### TierProgress

Shows the customer's current tier and a visual progress bar toward the next tier.

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `customerId` | `string` | No | Customer ID. Shows sign-in prompt if omitted. |

#### Usage

```mdx
<TierProgress customerId={session.customerId} />
```

#### States

- **Signed out**: Prompts the user to sign in.
- **Loading**: Animated skeleton placeholder.
- **Loaded**: Progress bar, percentage to next tier, tier step indicators with checkmarks for passed tiers. Displays multiplier badge if the current tier has a points multiplier > 1x.

---

### PointsHistory

Filterable table of the customer's loyalty point transactions (earn, redeem, adjust, expire).

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `customerId` | `string` | No | Customer ID. Shows sign-in prompt if omitted. |
| `limit` | `number` | No | Maximum transactions to show (default: 10). |

#### Usage

```mdx
<PointsHistory customerId={session.customerId} limit={20} />
```

#### States

- **Signed out**: Prompts the user to sign in.
- **Loading**: Animated skeleton rows.
- **Loaded**: Filter bar (all/earn/redeem/adjust/expire) + transaction table with type badge, description, signed point amount, and date.
- **Empty**: "No transactions found" message.

---

### LoyaltyPage

Full-page loyalty dashboard composing PointsBalance, TierProgress, and PointsHistory into a single view.

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `customerId` | `string` | No | Customer ID. Shows sign-in prompt if omitted. |

#### Usage

```mdx
<LoyaltyPage customerId={session.customerId} />
```

#### Layout

- Header with "My Rewards" title
- Two-column grid: PointsBalance + TierProgress
- Full-width PointsHistory below

## Notes

- Disabled by default. Setting `enabled: true` exposes admin and Store surfaces, but earn/redeem remain unattached to Order facts until a durable, idempotent ledger write is wired.
- Loyalty accounts are auto-provisioned on first interaction via `getOrCreateAccount()`.
- Requires the `customers` module.
- Rule types: `per_dollar` (points per dollar spent), `fixed_bonus` (flat points above min order), `multiplier` (multiply base points), `signup` (one-time signup bonus).
- Configuration values are strings for module config compatibility.
- Ledger writes with an `orderId` are unique on `(accountId, orderId, type)` via `ledgerKey`.
