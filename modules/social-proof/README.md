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

# Social Proof Module

📚 **Documentation:** [86d.app/docs/modules/social-proof](https://86d.app/docs/modules/social-proof)

Social proof and trust signals module for driving conversions. Track and display aggregate product activity — purchase counts, viewer counts, trending indicators, and recent purchase notifications. Configure trust badges (secure checkout, money-back guarantee, free shipping) to build customer confidence.

## Installation

```sh
npm install @86d-app/social-proof
```

## Usage

```ts
import socialProof from "@86d-app/social-proof";

const module = socialProof({
  maxEventsPerProduct: "5000",
  defaultPeriod: "24h",
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `maxEventsPerProduct` | `string` | `"10000"` | Maximum activity events to retain per product |
| `defaultPeriod` | `string` | `"24h"` | Default time period for activity queries |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/social-proof/track` | Record a product activity event |
| `GET` | `/social-proof/activity/:productId` | Get aggregated activity stats for a product |
| `GET` | `/social-proof/trending` | Get trending products by activity volume |
| `GET` | `/social-proof/badges` | List active trust badges |
| `GET` | `/social-proof/recent` | Get recent activity feed |

### Response shapes

**Track event:**
```ts
{ event: ActivityEvent }
```

**Product activity:**
```ts
{
  activity: {
    productId: string;
    viewCount: number;
    purchaseCount: number;
    cartAddCount: number;
    wishlistAddCount: number;
    totalEvents: number;
    recentPurchases: Array<{
      region?: string;
      city?: string;
      country?: string;
      quantity?: number;
      createdAt: Date;
    }>;
  }
}
```

**Trending products:**
```ts
{ products: TrendingProduct[] }
```

**Trust badges:**
```ts
{ badges: TrustBadge[] }
```

**Recent activity:**
```ts
{ events: ActivityEvent[] }
```

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/social-proof/events` | List activity events (paginated, filterable) |
| `GET` | `/admin/social-proof/summary` | Activity dashboard summary |
| `POST` | `/admin/social-proof/events/cleanup` | Remove events older than N days |
| `GET` | `/admin/social-proof/badges` | List all trust badges |
| `POST` | `/admin/social-proof/badges/create` | Create a trust badge |
| `POST` | `/admin/social-proof/badges/:id/update` | Update a trust badge |
| `POST` | `/admin/social-proof/badges/:id/delete` | Delete a trust badge |

## Controller API

```ts
interface SocialProofController {
  /** Record a product activity event. */
  recordEvent(params: {
    productId: string;
    productName: string;
    productSlug: string;
    productImage?: string;
    eventType: ActivityEventType;
    region?: string;
    country?: string;
    city?: string;
    quantity?: number;
  }): Promise<ActivityEvent>;

  /** Get aggregated activity stats for a product within a time period. */
  getProductActivity(productId: string, params?: {
    period?: ActivityPeriod;
  }): Promise<ProductActivity>;

  /** Get recent activity events, optionally filtered by type. */
  getRecentActivity(params?: {
    eventType?: ActivityEventType;
    take?: number;
    skip?: number;
  }): Promise<ActivityEvent[]>;

  /** Get trending products ranked by activity volume. */
  getTrendingProducts(params?: {
    period?: ActivityPeriod;
    take?: number;
    skip?: number;
  }): Promise<TrendingProduct[]>;

  /** Create a trust badge. */
  createBadge(params: {
    name: string;
    description?: string;
    icon: string;
    url?: string;
    position: BadgePosition;
    priority?: number;
    isActive?: boolean;
  }): Promise<TrustBadge>;

  /** Get a trust badge by ID. */
  getBadge(id: string): Promise<TrustBadge | null>;

  /** Update a trust badge. Pass null to clear optional fields. */
  updateBadge(id: string, params: {
    name?: string;
    description?: string | null;
    icon?: string;
    url?: string | null;
    position?: BadgePosition;
    priority?: number;
    isActive?: boolean;
  }): Promise<TrustBadge | null>;

  /** Delete a trust badge. */
  deleteBadge(id: string): Promise<boolean>;

  /** List trust badges with optional filters. Sorted by priority descending. */
  listBadges(params?: {
    position?: BadgePosition;
    isActive?: boolean;
    take?: number;
    skip?: number;
  }): Promise<TrustBadge[]>;

  /** Count badges matching filters. */
  countBadges(params?: {
    position?: BadgePosition;
    isActive?: boolean;
  }): Promise<number>;

  /** Admin: list all activity events with filters. */
  listEvents(params?: {
    productId?: string;
    eventType?: ActivityEventType;
    take?: number;
    skip?: number;
  }): Promise<ActivityEvent[]>;

  /** Admin: count events matching filters. */
  countEvents(params?: {
    productId?: string;
    eventType?: ActivityEventType;
  }): Promise<number>;

  /** Admin: remove events older than N days. Returns deleted count. */
  cleanupEvents(olderThanDays: number): Promise<number>;

  /** Admin: dashboard summary with aggregated stats and top products. */
  getActivitySummary(params?: {
    period?: ActivityPeriod;
  }): Promise<ActivitySummary>;
}
```

## Types

```ts
type ActivityEventType = "purchase" | "view" | "cart_add" | "wishlist_add";
type BadgePosition = "header" | "footer" | "product" | "checkout" | "cart";
type ActivityPeriod = "1h" | "24h" | "7d" | "30d";

interface ActivityEvent {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  productImage?: string;
  eventType: ActivityEventType;
  region?: string;
  country?: string;
  city?: string;
  quantity?: number;
  createdAt: Date;
}

interface TrustBadge {
  id: string;
  name: string;
  description?: string;
  icon: string;
  url?: string;
  position: BadgePosition;
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface TrendingProduct {
  productId: string;
  productName: string;
  productSlug: string;
  productImage?: string;
  eventCount: number;
  purchaseCount: number;
}

interface ActivitySummary {
  totalEvents: number;
  totalPurchases: number;
  totalViews: number;
  totalCartAdds: number;
  uniqueProducts: number;
  topProducts: TrendingProduct[];
}
```

## Store Components

##### `<ProductActivity productId="..." period="24h" />`

Displays social proof indicators on product pages: "X bought recently", "Y viewing", "Z added to cart". Only renders when there is activity data.

##### `<TrustBadges position="product" />`

Renders configurable trust badges (secure checkout, money-back guarantee, etc.) filtered by position. Uses emoji icons with optional links.

##### `<RecentPurchases take={5} />`

Shows a feed of recent purchase events with product name, location, and relative time. Each item links to the product page.

## Notes

- Events are anonymous — no customer or session IDs are stored for visitor privacy
- Activity is aggregated in time-based periods (1h, 24h, 7d, 30d)
- Use `cleanupEvents` to prevent unbounded data growth — delete events older than a retention period
- Store badge endpoint only returns active badges; admin returns all badges
- Trust badges support 5 positions: header, footer, product, checkout, cart
- Recent purchases in product activity are limited to 10 most recent
- Text inputs on admin endpoints use `sanitizeText` to prevent XSS
