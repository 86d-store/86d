

# @86d-app/recently-viewed

📚 **Documentation:** [86d.app/docs/modules/recently-viewed](https://86d.app/docs/modules/recently-viewed)

Recently viewed products tracking module for the 86d commerce platform. Records which products customers browse and surfaces them for rediscovery, improving engagement and conversion.

## Features

- Track product views for authenticated and anonymous users
- Deduplicate repeat views within a 5-minute window
- Merge anonymous session history into customer account on login
- Admin dashboard with most viewed products analytics
- Two store components: full grid and compact horizontal strip

## Installation

Add `"recently-viewed"` to your template's `config.json` modules array:

```json
{
  "modules": ["cart", "products", "recently-viewed"]
}
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxViewsPerCustomer` | `string` | — | Maximum views retained per customer |

```ts
import recentlyViewed from "@86d-app/recently-viewed";

recentlyViewed({ maxViewsPerCustomer: "100" });
```

## Store Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/recently-viewed/track` | Record a product view |
| GET | `/recently-viewed` | List recently viewed products |
| POST | `/recently-viewed/clear` | Clear viewing history |
| POST | `/recently-viewed/merge` | Merge session views into customer (requires auth) |

### POST `/recently-viewed/track`

```json
{
  "productId": "prod_123",
  "productName": "Blue T-Shirt",
  "productSlug": "blue-t-shirt",
  "productImage": "/img/blue-tshirt.jpg",
  "productPrice": 2999,
  "sessionId": "sess_abc"
}
```

### GET `/recently-viewed`

Query params: `sessionId`, `take` (default 20), `skip`

### POST `/recently-viewed/merge`

Transfers anonymous session views to the authenticated customer. Call this on login.

```json
{
  "sessionId": "sess_abc"
}
```

## Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/recently-viewed` | List all views (filterable) |
| GET | `/admin/recently-viewed/popular` | Most viewed products |
| GET | `/admin/recently-viewed/customer/:id` | Views for a specific customer |
| DELETE | `/admin/recently-viewed/:id/delete` | Delete a view record |

## Controller API

```ts
interface RecentlyViewedController {
  trackView(params): Promise<ProductView>
  getRecentViews(params): Promise<ProductView[]>
  getPopularProducts(params?): Promise<PopularProduct[]>
  clearHistory(params): Promise<number>
  deleteView(id): Promise<boolean>
  listAll(params?): Promise<ProductView[]>
  countViews(params?): Promise<number>
  mergeHistory(params): Promise<number>
}
```

## Types

```ts
interface ProductView {
  id: string
  customerId?: string
  sessionId?: string
  productId: string
  productName: string
  productSlug: string
  productImage?: string
  productPrice?: number
  viewedAt: Date
}

interface PopularProduct {
  productId: string
  productName: string
  productSlug: string
  productImage?: string
  viewCount: number
}
```

## Store Components

### RecentlyViewedGrid

Full-width grid displaying recently viewed products with images, prices, and time-ago labels. Automatically hides when no views exist.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `customerId` | `string` | — | Customer ID for authenticated users |
| `sessionId` | `string` | — | Session ID for anonymous users |
| `limit` | `number` | `12` | Maximum products to display |
| `title` | `string` | `"Recently Viewed"` | Section heading |
| `showClear` | `boolean` | `false` | Show "Clear all" button |

#### Usage in MDX

```mdx
<RecentlyViewedGrid customerId={customerId} />

<RecentlyViewedGrid
  sessionId={sessionId}
  limit={8}
  title="You Recently Viewed"
  showClear
/>
```

Place on product detail pages (below the main product), the homepage, or cart page to encourage rediscovery.

### RecentlyViewedCompact

Compact horizontal scrolling strip of recently viewed products. Shows small thumbnails with names and prices. Hides when no views exist.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `customerId` | `string` | — | Customer ID for authenticated users |
| `sessionId` | `string` | — | Session ID for anonymous users |
| `limit` | `number` | `6` | Maximum products to display |
| `title` | `string` | `"Recently Viewed"` | Section heading |

#### Usage in MDX

```mdx
<RecentlyViewedCompact customerId={customerId} />

<RecentlyViewedCompact
  sessionId={sessionId}
  limit={4}
  title="Continue Browsing"
/>
```

Ideal for sidebars, footer sections, or anywhere space is limited.

## Notes

- All prices are stored in **cents** (not dollars)
- The dedup window is 5 minutes — viewing the same product again within 5 minutes updates the existing record
- Session views should be merged on login via the `/recently-viewed/merge` endpoint
- The admin "Most Viewed Products" panel shows the top 10 by default
