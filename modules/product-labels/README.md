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

# Product Labels Module

📚 **Documentation:** [86d.app/docs/modules/product-labels](https://86d.app/docs/modules/product-labels)

Visual merchandising module for adding labels and badges to products. Create labels like "New", "Sale", "Best Seller", "Limited Edition", or custom badges with configurable colors, types, and display positions. Supports scheduled labels with start/end dates and conditional assignment rules.

## Installation

```sh
npm install @86d-app/product-labels
```

## Usage

```ts
import productLabels from "@86d-app/product-labels";

const module = productLabels({
  maxLabelsPerProduct: "5", // limit to 5 labels per product
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `maxLabelsPerProduct` | `string` | `"10"` | Maximum number of labels per product |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/product-labels` | List all active labels |
| `GET` | `/product-labels/:slug` | Get a specific label by slug |
| `GET` | `/product-labels/products/:productId` | Get active labels for a product |

### Response shapes

**List labels:**
```ts
{ labels: Label[] }
```

**Get label:**
```ts
{ label: Label }
// or { error: "Label not found", status: 404 }
```

**Get product labels:**
```ts
{ labels: Label[] }
```

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/product-labels` | List all labels (paginated, filterable) |
| `POST` | `/admin/product-labels/create` | Create a new label |
| `POST` | `/admin/product-labels/:id/update` | Update a label |
| `POST` | `/admin/product-labels/:id/delete` | Delete a label and its assignments |
| `POST` | `/admin/product-labels/assign` | Assign a label to a product |
| `POST` | `/admin/product-labels/unassign` | Remove a label from a product |
| `POST` | `/admin/product-labels/bulk-assign` | Assign a label to multiple products |
| `POST` | `/admin/product-labels/bulk-unassign` | Remove a label from multiple products |
| `GET` | `/admin/product-labels/products/:productId` | Get all labels for a product |
| `GET` | `/admin/product-labels/stats` | Label usage statistics |

## Controller API

```ts
interface ProductLabelController {
  /** Create a new label. */
  createLabel(params: {
    name: string;
    slug: string;
    displayText: string;
    type: LabelType;
    color?: string;
    backgroundColor?: string;
    icon?: string;
    priority?: number;
    isActive?: boolean;
    startsAt?: Date;
    endsAt?: Date;
    conditions?: LabelConditions;
  }): Promise<Label>;

  /** Get a label by ID. */
  getLabel(id: string): Promise<Label | null>;

  /** Get a label by slug. */
  getLabelBySlug(slug: string): Promise<Label | null>;

  /** Update a label. Pass null to clear optional date/condition fields. */
  updateLabel(id: string, params: {
    name?: string;
    displayText?: string;
    type?: LabelType;
    color?: string;
    backgroundColor?: string;
    icon?: string;
    priority?: number;
    isActive?: boolean;
    startsAt?: Date | null;
    endsAt?: Date | null;
    conditions?: LabelConditions | null;
  }): Promise<Label | null>;

  /** Delete a label and all its product assignments. */
  deleteLabel(id: string): Promise<boolean>;

  /** List labels with optional filters. Sorted by priority descending. */
  listLabels(params?: {
    type?: LabelType;
    isActive?: boolean;
    take?: number;
    skip?: number;
  }): Promise<Label[]>;

  /** Count labels matching filters. */
  countLabels(params?: {
    type?: LabelType;
    isActive?: boolean;
  }): Promise<number>;

  /** Assign a label to a product. Updates position if already assigned. */
  assignLabel(params: {
    productId: string;
    labelId: string;
    position?: LabelPosition;
  }): Promise<ProductLabel>;

  /** Remove a label from a product. */
  unassignLabel(params: {
    productId: string;
    labelId: string;
  }): Promise<boolean>;

  /** Get all labels for a product (including inactive). */
  getProductLabels(productId: string): Promise<ProductWithLabels>;

  /** Get all products assigned to a label. */
  getProductsForLabel(params: {
    labelId: string;
    take?: number;
    skip?: number;
  }): Promise<ProductLabel[]>;

  /** Count products for a label. */
  countProductsForLabel(labelId: string): Promise<number>;

  /** Assign a label to multiple products. Skips duplicates. */
  bulkAssignLabel(params: {
    productIds: string[];
    labelId: string;
    position?: LabelPosition;
  }): Promise<number>;

  /** Remove a label from multiple products. */
  bulkUnassignLabel(params: {
    productIds: string[];
    labelId: string;
  }): Promise<number>;

  /** Get only active, in-date-range labels for a product. */
  getActiveLabelsForProduct(productId: string): Promise<Label[]>;

  /** Get label usage statistics. Sorted by product count descending. */
  getLabelStats(params?: { take?: number }): Promise<LabelStats[]>;
}
```

## Types

```ts
type LabelType = "badge" | "tag" | "ribbon" | "banner" | "sticker" | "custom";
type LabelPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";

interface Label {
  id: string;
  name: string;
  slug: string;
  displayText: string;
  type: LabelType;
  color?: string;
  backgroundColor?: string;
  icon?: string;
  priority: number;
  isActive: boolean;
  startsAt?: Date;
  endsAt?: Date;
  conditions?: LabelConditions;
  createdAt: Date;
  updatedAt: Date;
}

interface LabelConditions {
  newWithinDays?: number;
  discountMinPercent?: number;
  lowStockThreshold?: number;
  categories?: string[];
  priceMin?: number;
  priceMax?: number;
}

interface ProductLabel {
  id: string;
  productId: string;
  labelId: string;
  position?: LabelPosition;
  assignedAt: Date;
}

interface LabelStats {
  labelId: string;
  name: string;
  displayText: string;
  type: LabelType;
  isActive: boolean;
  productCount: number;
}
```

## Notes

- Store endpoints only return active labels within their date range
- Deleting a label automatically removes all product assignments
- Re-assigning a label to the same product updates the position instead of creating a duplicate
- Bulk operations skip products that are already assigned/unassigned
- The `conditions` field stores rules that can be used for automatic label assignment (e.g., auto-tag products created within 30 days as "New")
- Labels are sorted by `priority` descending — higher priority labels appear first in the list
