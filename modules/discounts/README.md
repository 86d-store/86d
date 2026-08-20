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

# Discounts Module

📚 **Documentation:** [86d.app/docs/modules/discounts](https://86d.app/docs/modules/discounts)

Discount and promo code management. Supports percentage, fixed-amount, and free-shipping discount types with optional product/category scoping, usage limits, and date windows. Standalone — no dependencies on other modules.

## Installation

```sh
npm install @86d-app/discounts
```

## Usage

```ts
import discounts from "@86d-app/discounts";

const module = discounts();
```

## Configuration

This module has no configuration options. Discount rules and codes are managed entirely at runtime through the controller or admin endpoints.

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/discounts/validate` | Validate a promo code without applying it |

Request body for `/discounts/validate`:

```ts
{
  code: string;
  subtotal: number;        // cart subtotal in cents
  productIds?: string[];   // for applies-to filtering
  categoryIds?: string[];
}
```

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/discounts` | List all discounts (paginated) |
| `POST` | `/admin/discounts/create` | Create a new discount rule |
| `GET` | `/admin/discounts/:id` | Get a discount with all its codes |
| `PUT` | `/admin/discounts/:id/update` | Update a discount rule |
| `DELETE` | `/admin/discounts/:id/delete` | Delete a discount and all its codes |
| `POST` | `/admin/discounts/:id/codes` | Add a promo code to a discount |
| `DELETE` | `/admin/discounts/codes/:id/delete` | Delete a single promo code |

## Discount Type Behaviour

| `type` | `value` field | Calculation |
|---|---|---|
| `percentage` | `0` – `100` | `subtotal * value / 100` |
| `fixed_amount` | cents | `min(value, subtotal)` |
| `free_shipping` | `0` | Sets `freeShipping: true` in the result |

## Controller API

```ts
interface DiscountController {
  /** Create a new discount rule */
  create(params: {
    id?: string;
    name: string;
    description?: string;
    type: DiscountType;
    /** Percentage 0-100, cents for fixed_amount, or 0 for free_shipping */
    value: number;
    minimumAmount?: number;
    maximumUses?: number;
    isActive?: boolean;
    startsAt?: Date;
    endsAt?: Date;
    appliesTo?: DiscountAppliesTo;
    appliesToIds?: string[];
    stackable?: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<Discount>;

  /** Look up a discount by ID */
  getById(id: string): Promise<Discount | null>;

  /** Update a discount rule */
  update(
    id: string,
    params: {
      name?: string;
      description?: string;
      type?: DiscountType;
      value?: number;
      minimumAmount?: number | null;
      maximumUses?: number | null;
      isActive?: boolean;
      startsAt?: Date | null;
      endsAt?: Date | null;
      appliesTo?: DiscountAppliesTo;
      appliesToIds?: string[];
      stackable?: boolean;
      metadata?: Record<string, unknown>;
    },
  ): Promise<Discount | null>;

  /**
   * Delete a discount. Cascades: all codes are removed first,
   * then the discount record is deleted.
   */
  delete(id: string): Promise<void>;

  /** List discounts with optional active filter and pagination */
  list(params: {
    limit?: number;
    offset?: number;
    isActive?: boolean;
  }): Promise<{ discounts: Discount[]; total: number }>;

  /** Attach a promo code to an existing discount */
  createCode(params: {
    discountId: string;
    code: string;
    maximumUses?: number;
    isActive?: boolean;
  }): Promise<DiscountCode>;

  /** Look up a code record by its string value (case-insensitive) */
  getCodeByValue(code: string): Promise<DiscountCode | null>;

  /** Get all codes attached to a discount */
  listCodes(discountId: string): Promise<DiscountCode[]>;

  /** Delete a single promo code */
  deleteCode(id: string): Promise<void>;

  /**
   * Check whether a code is valid and calculate the discount amount.
   * Does NOT increment usage counters — safe to call on cart preview.
   */
  validateCode(params: {
    code: string;
    subtotal: number;
    productIds?: string[];
    categoryIds?: string[];
  }): Promise<ApplyResult>;

  /**
   * Validate a code and increment usage counters.
   * Call this only once, when an order is confirmed.
   */
  applyCode(params: {
    code: string;
    subtotal: number;
    productIds?: string[];
    categoryIds?: string[];
  }): Promise<ApplyResult>;
}
```

## Types

```ts
type DiscountType = "percentage" | "fixed_amount" | "free_shipping";

type DiscountAppliesTo =
  | "all"
  | "specific_products"
  | "specific_categories";

interface Discount {
  id: string;
  name: string;
  description?: string;
  type: DiscountType;
  /** Percentage 0-100, fixed amount in cents, or 0 for free_shipping */
  value: number;
  minimumAmount?: number;      // minimum cart subtotal in cents
  maximumUses?: number;        // null = unlimited
  usedCount: number;
  isActive: boolean;
  startsAt?: Date;
  endsAt?: Date;
  appliesTo: DiscountAppliesTo;
  appliesToIds: string[];      // product or category IDs when scoped
  stackable: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface DiscountCode {
  id: string;
  discountId: string;
  code: string;                // stored uppercase
  usedCount: number;
  maximumUses?: number;        // null = unlimited
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ApplyResult {
  valid: boolean;
  discountAmount: number;      // in cents; 0 for free_shipping type
  freeShipping: boolean;
  discount?: Discount;
  code?: DiscountCode;
  error?: string;              // reason when valid = false
}
```

## Store Components

### DiscountCodeInput

Promo code input field with validation. Shows applied state when a valid code is entered.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `subtotal` | `number` | `0` | Cart subtotal in cents (for minimum amount validation) |
| `productIds` | `string[]` | — | Product IDs for product-specific discounts |
| `categoryIds` | `string[]` | — | Category IDs for category-specific discounts |
| `onApplied` | `(result) => void` | — | Callback when a valid code is applied |
| `onRemoved` | `() => void` | — | Callback when the applied code is removed |
| `compact` | `boolean` | `false` | Compact inline layout |

#### Usage in MDX

```mdx
<DiscountCodeInput />

<DiscountCodeInput
  subtotal={cartSubtotal}
  compact={true}
  onApplied={(result) => console.log(result)}
/>
```

## Notes

- Promo codes are stored and matched case-insensitively (`toUpperCase().trim()`). `SAVE10`, `save10`, and `Save10` all resolve to the same code.
- `validateCode` is safe to call repeatedly (e.g. on every cart update) — it never mutates state.
- `applyCode` should be called exactly once per order, at confirmation time. It increments both the code's `usedCount` and the parent discount's `usedCount`.
- The `DiscountController` type is exported for structural typing in the checkout module (no direct import required).
