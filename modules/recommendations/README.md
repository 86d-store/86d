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

# Recommendations Module

📚 **Documentation:** [86d.app/docs/modules/recommendations](https://86d.app/docs/modules/recommendations)

Product recommendation engine for cross-sells, upsells, and personalized discovery. Supports four strategies: manual (admin-curated associations), bought_together (co-occurrence analysis from purchase history), trending (weighted interaction velocity), and personalized (category affinity with co-occurrence fallback). Works for both guest and authenticated customers.

## Installation

```sh
npm install @86d-app/recommendations
```

## Usage

```ts
import recommendations from "@86d-app/recommendations";

const module = recommendations({
  defaultTake: "8",           // return 8 recommendations by default
  trendingWindowDays: "14",   // look at last 14 days for trending
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `defaultTake` | `string` | `"10"` | Default number of recommendations returned |
| `trendingWindowDays` | `string` | `"7"` | Time window in days for trending calculations |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/recommendations/:productId` | Get recommendations for a product |
| `GET` | `/recommendations/trending` | Get trending products |
| `GET` | `/recommendations/personalized` | Get personalized recommendations (auth required) |
| `POST` | `/recommendations/track` | Track a product interaction (view/purchase/add_to_cart) |

### Response shapes

**Get for product:**
```ts
{ recommendations: RecommendedProduct[] }
```

**Get trending:**
```ts
{ recommendations: RecommendedProduct[] }
```

**Get personalized:**
```ts
{ recommendations: RecommendedProduct[] }
// or { error: "Authentication required", status: 401 }
```

**Track interaction:**
```ts
{ interaction: ProductInteraction }
// or { error: string, status: 400 }
```

### Query parameters

**GET /recommendations/:productId**

| Param | Type | Description |
|---|---|---|
| `strategy` | `manual \| bought_together \| trending \| personalized` | Filter by strategy (omit for all) |
| `take` | `number` | Max results (1-50) |

**GET /recommendations/trending**

| Param | Type | Description |
|---|---|---|
| `take` | `number` | Max results (1-50) |

**GET /recommendations/personalized**

| Param | Type | Description |
|---|---|---|
| `take` | `number` | Max results (1-50) |

## Store Components

The module exports customer-facing components for MDX templates:

### ProductRecommendations

Responsive grid of recommended products for a given product page.

```mdx
<ProductRecommendations productId="prod-123" />
<ProductRecommendations productId="prod-123" title="Frequently bought together" strategy="bought_together" limit={4} />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `productId` | `string` | **required** | Product ID to get recommendations for |
| `title` | `string` | `"You may also like"` | Section heading |
| `strategy` | `"manual" \| "bought_together"` | — | Filter by strategy |
| `limit` | `number` | `6` | Max number of products |

### TrendingProducts

Horizontal scrollable row of trending products, suitable for homepage or category pages.

```mdx
<TrendingProducts />
<TrendingProducts title="Popular this week" limit={10} />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | `"Trending now"` | Section heading |
| `limit` | `number` | `8` | Max number of products |

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/recommendations/rules` | List recommendation rules (paginated) |
| `POST` | `/admin/recommendations/rules/create` | Create a recommendation rule |
| `POST` | `/admin/recommendations/rules/:id` | Update a recommendation rule |
| `POST` | `/admin/recommendations/rules/:id/delete` | Delete a recommendation rule |
| `POST` | `/admin/recommendations/record-purchase` | Record a purchase for co-occurrence tracking |
| `GET` | `/admin/recommendations/co-occurrences/:productId` | View co-occurrence data for a product |
| `GET` | `/admin/recommendations/stats` | Get recommendation system statistics |

## Admin Pages

| Path | Component | Description |
|---|---|---|
| `/admin/recommendations` | `RecommendationAdmin` | Stats dashboard (total/active rules, co-occurrences, interactions), inline rule creation form, strategy filter, rules list with activate/deactivate and delete |

## Controller API

```ts
interface RecommendationController {
  /** Create a recommendation rule. */
  createRule(params: {
    name: string;
    strategy: RecommendationStrategy;
    sourceProductId?: string;
    targetProductIds: string[];
    weight?: number;
    isActive?: boolean;
  }): Promise<RecommendationRule>;

  /** Update a rule. Returns null if not found. */
  updateRule(id: string, params: {
    name?: string;
    strategy?: RecommendationStrategy;
    sourceProductId?: string;
    targetProductIds?: string[];
    weight?: number;
    isActive?: boolean;
  }): Promise<RecommendationRule | null>;

  /** Delete a rule. Returns false if not found. */
  deleteRule(id: string): Promise<boolean>;

  /** Get a single rule by ID. */
  getRule(id: string): Promise<RecommendationRule | null>;

  /** List rules with optional filters. */
  listRules(params?: {
    strategy?: RecommendationStrategy;
    isActive?: boolean;
    take?: number;
    skip?: number;
  }): Promise<RecommendationRule[]>;

  /** Record a purchase to update co-occurrence data. Returns number of pairs recorded. */
  recordPurchase(productIds: string[]): Promise<number>;

  /** Get co-occurrence data for a product. */
  getCoOccurrences(productId: string, params?: { take?: number }): Promise<CoOccurrence[]>;

  /** Track a product interaction (view, purchase, add_to_cart). */
  trackInteraction(params: {
    productId: string;
    customerId?: string;
    sessionId?: string;
    type: InteractionType;
    productName: string;
    productSlug: string;
    productImage?: string;
    productPrice?: number;
    productCategory?: string;
  }): Promise<ProductInteraction>;

  /** Get recommendations for a specific product. */
  getForProduct(productId: string, params?: {
    strategy?: RecommendationStrategy;
    take?: number;
  }): Promise<RecommendedProduct[]>;

  /** Get trending products. */
  getTrending(params?: { take?: number; since?: Date }): Promise<RecommendedProduct[]>;

  /** Get personalized recommendations for a customer. */
  getPersonalized(customerId: string, params?: { take?: number }): Promise<RecommendedProduct[]>;

  /** Get recommendation system statistics. */
  getStats(): Promise<{ totalRules: number; activeRules: number; totalCoOccurrences: number; totalInteractions: number }>;
}
```

## Types

```ts
type RecommendationStrategy = "manual" | "bought_together" | "trending" | "personalized";
type InteractionType = "view" | "purchase" | "add_to_cart";

interface RecommendationRule {
  id: string;
  name: string;
  strategy: RecommendationStrategy;
  sourceProductId?: string;
  targetProductIds: string[];
  weight: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface CoOccurrence {
  id: string;
  productId1: string;
  productId2: string;
  count: number;
  lastOccurredAt: Date;
}

interface ProductInteraction {
  id: string;
  productId: string;
  customerId?: string;
  sessionId?: string;
  type: InteractionType;
  productName: string;
  productSlug: string;
  productImage?: string;
  productPrice?: number;
  productCategory?: string;
  createdAt: Date;
}

interface RecommendedProduct {
  productId: string;
  productName: string;
  productSlug: string;
  productImage?: string;
  productPrice?: number;
  score: number;
  strategy: RecommendationStrategy;
}
```

## Notes

- Co-occurrences use canonical pair ordering (`productId1 < productId2`) so buying A+B is the same pair as B+A
- Interaction scoring weights: purchase=3, add_to_cart=2, view=1
- `getForProduct` combines manual rules and co-occurrence data, sorted by score descending
- `getPersonalized` uses category affinity when category data is available, falls back to co-occurrence from purchased products
- `getTrending` defaults to a 7-day window, configurable via `trendingWindowDays` option
- Product info in recommendations is resolved from interaction history snapshots
- Rules can be deactivated via `isActive: false` without deletion
- `recordPurchase` should be called when orders are completed to build co-occurrence data
