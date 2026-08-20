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

# FAQ Module

📚 **Documentation:** [86d.app/docs/modules/faq](https://86d.app/docs/modules/faq)

Self-service FAQ and knowledge base module. Organize questions into categories, enable full-text search, and let customers vote on helpfulness.

## Installation

```sh
npm install @86d-app/faq
```

## Usage

```ts
import faq from "@86d-app/faq";

const module = faq({
  maxSearchResults: 20,
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `maxSearchResults` | `number` | `20` | Maximum results returned per search query |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/faq/categories` | List all visible FAQ categories |
| `GET` | `/faq/categories/:slug` | Get a category with its visible items |
| `GET` | `/faq/items/:slug` | Get a single FAQ item by slug |
| `GET` | `/faq/search?q=...` | Search FAQs by query string |
| `POST` | `/faq/items/:id/vote` | Vote on helpfulness (`{ helpful: boolean }`) |

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/faq/categories` | List all categories with item counts |
| `POST` | `/admin/faq/categories/create` | Create a new category |
| `PUT` | `/admin/faq/categories/:id` | Update a category |
| `DELETE` | `/admin/faq/categories/:id/delete` | Delete a category (cascades to items) |
| `GET` | `/admin/faq/items` | List all items (optional `?categoryId=`) |
| `POST` | `/admin/faq/items/create` | Create a new FAQ item |
| `GET` | `/admin/faq/items/:id` | Get a FAQ item by ID |
| `PUT` | `/admin/faq/items/:id/update` | Update a FAQ item |
| `DELETE` | `/admin/faq/items/:id/delete` | Delete a FAQ item |
| `GET` | `/admin/faq/stats` | Get FAQ statistics |

## Controller API

The `FaqController` interface is exported for inter-module use.

```ts
interface FaqController {
  createCategory(params: {
    name: string;
    slug: string;
    description?: string;
    icon?: string;
    position?: number;
  }): Promise<FaqCategory>;

  getCategory(id: string): Promise<FaqCategory | null>;
  getCategoryBySlug(slug: string): Promise<FaqCategory | null>;
  listCategories(opts?: { visibleOnly?: boolean }): Promise<FaqCategory[]>;
  updateCategory(id: string, data: Partial<FaqCategory>): Promise<FaqCategory>;
  deleteCategory(id: string): Promise<void>;

  createItem(params: {
    categoryId: string;
    question: string;
    answer: string;
    slug: string;
    position?: number;
    tags?: string[];
  }): Promise<FaqItem>;

  getItem(id: string): Promise<FaqItem | null>;
  getItemBySlug(slug: string): Promise<FaqItem | null>;
  listItems(opts?: { categoryId?: string; visibleOnly?: boolean }): Promise<FaqItem[]>;
  updateItem(id: string, data: Partial<FaqItem>): Promise<FaqItem>;
  deleteItem(id: string): Promise<void>;

  search(query: string, opts?: { categoryId?: string; limit?: number }): Promise<FaqItem[]>;
  vote(itemId: string, helpful: boolean): Promise<FaqItem>;
  getStats(): Promise<{ totalCategories; totalItems; totalHelpful; totalNotHelpful }>;
}
```

## Types

```ts
interface FaqCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  position: number;
  isVisible: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface FaqItem {
  id: string;
  categoryId: string;
  question: string;
  answer: string;
  slug: string;
  position: number;
  isVisible: boolean;
  tags?: string[];
  helpfulCount: number;
  notHelpfulCount: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
```

## Admin Pages

| Path | Component | Group | Description |
|------|-----------|-------|-------------|
| `/admin/faq` | FaqList | Content | Stats dashboard (categories, questions, helpful/not helpful votes), category filter, FAQ item list with visibility badges, inline create form with category select and auto-slug |
| `/admin/faq/categories` | FaqCategories | Content | Category list with visibility badges, inline create form with name, slug, description, icon, and position fields |
| `/admin/faq/:id` | FaqDetail | — | Edit form for question, answer, category, slug, tags, position, and visibility toggle with helpful/not helpful counts |
| `/admin/faq/categories/:id` | FaqCategoryDetail | — | Edit form for name, slug, description, icon, position, and visibility toggle |

## Store Components

### FaqAccordion

Collapsible accordion of FAQ items. When given a `categorySlug`, displays items from that category. Otherwise shows a category navigation bar. Includes helpfulness voting on each expanded item.

#### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `categorySlug` | `string?` | — | Slug of category to display. If omitted, shows category list. |
| `title` | `string?` | `"FAQ"` | Section heading (used when no category is loaded) |

#### Usage in MDX

```mdx
{/* Show all categories as navigation */}
<FaqAccordion />

{/* Show items from a specific category */}
<FaqAccordion categorySlug="shipping" title="Shipping FAQ" />
```

Typically placed on a dedicated `/faq` page or embedded in relevant product/category pages. Each item expands to show the answer and a "Was this helpful?" voting widget.

### FaqSearch

Live search widget with debounced input and result display. Searches across all visible FAQ items by question text, answer text, and tags.

#### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `placeholder` | `string?` | `"Search frequently asked questions..."` | Input placeholder text |

#### Usage in MDX

```mdx
<FaqSearch />

<FaqSearch placeholder="How can we help?" />
```

Place at the top of the FAQ page for instant search. Results link to individual FAQ item pages at `/faq/item/:slug`. Input is debounced (300ms) to avoid excessive API calls.

## Notes

- Categories and items are ordered by `position` (ascending). Use position to control display order.
- Store endpoints only return visible items/categories (`isVisible: true`). Admin endpoints return all.
- Search uses weighted scoring: question matches (10pts) > tag matches (8pts) > answer matches (5pts), with word-level bonuses.
- Deleting a category cascades to all its items.
- Helpfulness votes are anonymous and cumulative — no per-user tracking.
