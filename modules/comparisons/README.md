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

# Comparisons Module

📚 **Documentation:** [86d.app/docs/modules/comparisons](https://86d.app/docs/modules/comparisons)

Product comparison module that lets customers add products to a side-by-side comparison view. Supports comparing prices, categories, and arbitrary product attributes across up to 4 products (configurable). Works for both guest and authenticated customers.

## Installation

```sh
npm install @86d-app/comparisons
```

## Usage

```ts
import comparisons from "@86d-app/comparisons";

const module = comparisons({
  maxProducts: "6", // allow up to 6 products per comparison
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `maxProducts` | `string` | `"4"` | Maximum number of products per comparison list |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/comparisons/add` | Add a product to the comparison |
| `GET` | `/comparisons` | Get the current comparison items |
| `POST` | `/comparisons/remove` | Remove a product from the comparison |
| `POST` | `/comparisons/clear` | Clear all comparison items |
| `POST` | `/comparisons/merge` | Merge session comparison to customer (requires auth) |

### Response shapes

**Add product:**
```ts
{ item: ComparisonItem }
// or { error: string, status: 400 } if limit reached
```

**List comparison:**
```ts
{ items: ComparisonItem[], total: number }
```

**Remove product:**
```ts
{ removed: boolean }
```

**Clear comparison:**
```ts
{ cleared: number }
```

**Merge comparison:**
```ts
{ merged: number }
```

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/comparisons` | List all comparison items (paginated) |
| `GET` | `/admin/comparisons/frequent` | Most frequently compared products |
| `GET` | `/admin/comparisons/customer/:id` | Comparison items for a specific customer |
| `DELETE` | `/admin/comparisons/:id/delete` | Delete a comparison item |

## Controller API

```ts
interface ComparisonController {
  /** Add product to comparison. Throws if limit reached. Updates if already present. */
  addProduct(params: {
    customerId?: string;
    sessionId?: string;
    productId: string;
    productName: string;
    productSlug: string;
    productImage?: string;
    productPrice?: number;
    productCategory?: string;
    attributes?: Record<string, string>;
    maxProducts?: number;
  }): Promise<ComparisonItem>;

  /** Remove a product from comparison by productId. */
  removeProduct(params: {
    customerId?: string;
    sessionId?: string;
    productId: string;
  }): Promise<boolean>;

  /** Get all items in a comparison list. Sorted by addedAt ascending. */
  getComparison(params: {
    customerId?: string;
    sessionId?: string;
  }): Promise<ComparisonItem[]>;

  /** Clear all items from a comparison list. Returns count cleared. */
  clearComparison(params: {
    customerId?: string;
    sessionId?: string;
  }): Promise<number>;

  /** Merge session comparison to customer on login. Respects max limit. */
  mergeComparison(params: {
    sessionId: string;
    customerId: string;
    maxProducts?: number;
  }): Promise<number>;

  /** Delete a specific item by ID (admin). */
  deleteItem(id: string): Promise<boolean>;

  /** List all items across all customers (admin). */
  listAll(params?: {
    customerId?: string;
    productId?: string;
    take?: number;
    skip?: number;
  }): Promise<ComparisonItem[]>;

  /** Count comparison items (admin). */
  countItems(params?: {
    customerId?: string;
    productId?: string;
  }): Promise<number>;

  /** Get most frequently compared products (admin). */
  getFrequentlyCompared(params?: {
    take?: number;
  }): Promise<FrequentlyCompared[]>;
}
```

## Types

```ts
interface ComparisonItem {
  id: string;
  customerId?: string;
  sessionId?: string;
  productId: string;
  productName: string;
  productSlug: string;
  productImage?: string;
  productPrice?: number;
  productCategory?: string;
  attributes?: Record<string, string>;
  addedAt: Date;
}

interface FrequentlyCompared {
  productId: string;
  productName: string;
  productSlug: string;
  productImage?: string;
  compareCount: number;
}
```

## Store Components

### ComparisonBar

Fixed bottom bar that shows products currently in the comparison list. Displays product thumbnails with remove buttons, a "Compare" link, and a "Clear" button.

#### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `customerId` | `string?` | — | Customer ID (for authenticated users) |
| `sessionId` | `string?` | — | Session ID (for guest users) |

#### Usage in MDX

```mdx
<ComparisonBar sessionId={sessionId} />
```

Typically placed in the main layout so it appears on every page when the comparison list is non-empty. The bar auto-hides when the comparison list is empty.

### ComparisonTable

Full side-by-side product comparison table. Shows product images, prices, categories, and all attributes in a horizontally scrollable table with sticky row labels.

#### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `customerId` | `string?` | — | Customer ID (for authenticated users) |
| `sessionId` | `string?` | — | Session ID (for guest users) |
| `title` | `string?` | `"Compare Products"` | Section heading |

#### Usage in MDX

```mdx
<ComparisonTable title="Compare Products" />
```

Typically placed on a dedicated `/compare` page. Shows an empty state message when no products are added. Each product column includes an image, name link, remove button, and all attribute rows.

## Notes

- Comparison items are sorted by `addedAt` ascending to maintain a stable display order
- Duplicate products are updated in-place rather than rejected
- The `attributes` field accepts arbitrary key-value pairs (e.g., `{ "Color": "Red", "Weight": "2kg" }`) for side-by-side comparison rows
- Session comparisons are automatically merged to the customer on login via the `/merge` endpoint
- Merge respects the max products limit and skips products already in the customer's comparison
