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

# Customer Groups Module

📚 **Documentation:** [86d.app/docs/modules/customer-groups](https://86d.app/docs/modules/customer-groups)

Customer segmentation module for grouping customers into manual or rule-based segments. Enables wholesale pricing, VIP tiers, B2B customer management, and group-specific price adjustments.

## Installation

```sh
npm install @86d-app/customer-groups
```

## Usage

```ts
import customerGroups from "@86d-app/customer-groups";

const module = customerGroups({
  defaultGroupSlug: "retail",
  includeExpiredMemberships: false,
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `defaultGroupSlug` | `string` | `undefined` | Slug of group to auto-assign new customers to |
| `includeExpiredMemberships` | `boolean` | `false` | Whether to include expired memberships in group lookups |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/customer-groups/mine` | Get all groups the current customer belongs to |
| `GET` | `/customer-groups/pricing` | Get active price adjustments for the current customer |

## Admin Endpoints

### Groups

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/customer-groups` | List all groups (filterable by type, active status) |
| `POST` | `/admin/customer-groups/create` | Create a new group |
| `GET` | `/admin/customer-groups/stats` | Get group statistics |
| `GET` | `/admin/customer-groups/:id` | Get group details |
| `POST` | `/admin/customer-groups/:id/update` | Update a group |
| `POST` | `/admin/customer-groups/:id/delete` | Delete a group (cascades) |

### Members

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/customer-groups/:id/members` | List group members |
| `POST` | `/admin/customer-groups/:id/members/add` | Add a customer to a group |
| `POST` | `/admin/customer-groups/:id/members/remove` | Remove a customer from a group |

### Rules (Automatic Groups)

| Method | Path | Description |
|---|---|---|
| `POST` | `/admin/customer-groups/:id/rules/add` | Add a segmentation rule |
| `POST` | `/admin/customer-groups/rules/:ruleId/remove` | Remove a rule |
| `POST` | `/admin/customer-groups/evaluate` | Evaluate rules against customer data |

### Pricing

| Method | Path | Description |
|---|---|---|
| `POST` | `/admin/customer-groups/:id/pricing` | Set a price adjustment for a group |
| `GET` | `/admin/customer-groups/:id/pricing/list` | List price adjustments |
| `POST` | `/admin/customer-groups/pricing/:adjustmentId/remove` | Remove a price adjustment |

## Controller API

```ts
interface CustomerGroupController {
  createGroup(params: { name: string; slug: string; description?: string; type?: GroupType; priority?: number }): Promise<CustomerGroup>;
  getGroup(id: string): Promise<CustomerGroup | null>;
  getGroupBySlug(slug: string): Promise<CustomerGroup | null>;
  listGroups(opts?: { type?: GroupType; activeOnly?: boolean }): Promise<CustomerGroup[]>;
  updateGroup(id: string, data: Partial<CustomerGroup>): Promise<CustomerGroup>;
  deleteGroup(id: string): Promise<void>;

  addMember(params: { groupId: string; customerId: string; expiresAt?: Date }): Promise<GroupMembership>;
  removeMember(groupId: string, customerId: string): Promise<void>;
  listMembers(groupId: string, opts?: { includeExpired?: boolean }): Promise<GroupMembership[]>;
  getCustomerGroups(customerId: string, opts?: { activeOnly?: boolean }): Promise<CustomerGroup[]>;
  isMember(groupId: string, customerId: string): Promise<boolean>;

  addRule(params: { groupId: string; field: string; operator: RuleOperator; value: string }): Promise<GroupRule>;
  removeRule(ruleId: string): Promise<void>;
  listRules(groupId: string): Promise<GroupRule[]>;
  evaluateRules(customerData: Record<string, unknown>): Promise<string[]>;

  setPriceAdjustment(params: { groupId: string; adjustmentType: AdjustmentType; value: number; scope?: AdjustmentScope; scopeId?: string }): Promise<GroupPriceAdjustment>;
  removePriceAdjustment(id: string): Promise<void>;
  listPriceAdjustments(groupId: string): Promise<GroupPriceAdjustment[]>;
  getCustomerPricing(customerId: string, opts?: { scope?: AdjustmentScope; scopeId?: string }): Promise<GroupPriceAdjustment[]>;

  getStats(): Promise<GroupStats>;
}
```

## Types

```ts
type GroupType = "manual" | "automatic";
type RuleOperator = "equals" | "not_equals" | "contains" | "not_contains" | "greater_than" | "less_than" | "in" | "not_in";
type AdjustmentType = "percentage" | "fixed";
type AdjustmentScope = "all" | "category" | "product";

interface CustomerGroup {
  id: string;
  name: string;
  slug: string;
  description?: string;
  type: GroupType;
  isActive: boolean;
  priority: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface GroupMembership {
  id: string;
  groupId: string;
  customerId: string;
  joinedAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

interface GroupRule {
  id: string;
  groupId: string;
  field: string;
  operator: RuleOperator;
  value: string;
  createdAt: Date;
}

interface GroupPriceAdjustment {
  id: string;
  groupId: string;
  adjustmentType: AdjustmentType;
  value: number;
  scope: AdjustmentScope;
  scopeId?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## Notes

- **Two group types**: `manual` groups require explicit membership management. `automatic` groups match customers via configurable rules.
- **Rule evaluation**: All rules use AND logic — every rule must match for a customer to belong to an automatic group. Rules with no conditions never match.
- **Price adjustments**: Each group can have multiple price adjustments scoped to `all`, `category`, or `product`. Setting an adjustment with the same scope/scopeId updates the existing one.
- **Membership expiration**: Memberships can have an `expiresAt` date. Expired memberships are excluded from all lookups by default.
- **Cascade delete**: Deleting a group removes all associated memberships, rules, and price adjustments.
- **Priority ordering**: Groups are sorted by `priority` (ascending) — lower numbers appear first.
