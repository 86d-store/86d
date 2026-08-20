

# @86d-app/product-feeds

📚 **Documentation:** [86d.app/docs/modules/product-feeds](https://86d.app/docs/modules/product-feeds)

Product feed generation and management for shopping channels. Syndicate your product catalog to Google Shopping, Facebook/Meta, Microsoft Advertising, Pinterest, TikTok Shop, and custom channels.

## Installation

Enable in your store template `config.json`:

```json
{
  "modules": {
    "product-feeds": {}
  }
}
```

## Usage

```typescript
import productFeeds from "@86d-app/product-feeds";

const module = productFeeds({
  maxFeeds: "50",
  maxProductsPerFeed: "100000",
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxFeeds` | string | `"50"` | Maximum feeds per store |
| `maxProductsPerFeed` | string | `"100000"` | Maximum products per feed generation |

## Supported Channels

| Channel | Default Format | Field Prefix | Example Fields |
|---------|---------------|-------------|----------------|
| Google Shopping | XML | `g:` | `g:title`, `g:price`, `g:availability` |
| Facebook / Meta | CSV | none | `title`, `price`, `availability` |
| Microsoft Advertising | XML | `g:` | Same as Google |
| Pinterest | CSV | none | Same as Facebook |
| TikTok Shop | CSV | none | Same as Facebook |
| Custom | — | — | User-defined |

## Store Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/feeds` | List all active feeds (name, slug, channel, format) |
| GET | `/feeds/:slug` | Get feed output by slug (returns raw XML/CSV/JSON) |

## Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/product-feeds` | List feeds with status/channel filtering |
| GET | `/admin/product-feeds/stats` | Aggregate feed statistics |
| POST | `/admin/product-feeds/create` | Create a new feed |
| GET | `/admin/product-feeds/:id` | Get feed details |
| POST | `/admin/product-feeds/:id/update` | Update feed configuration |
| POST | `/admin/product-feeds/:id/delete` | Delete feed and all associated data |
| POST | `/admin/product-feeds/:id/generate` | Generate feed from product data |
| GET | `/admin/product-feeds/:id/items` | List feed items with status filtering |
| POST | `/admin/product-feeds/:id/validate` | Validate feed configuration and items |
| GET | `/admin/product-feeds/:id/mappings` | List category mappings |
| POST | `/admin/product-feeds/:id/mappings/create` | Add a category mapping |
| POST | `/admin/product-feeds/:id/mappings/:mappingId/delete` | Delete a category mapping |

## Controller API

### Feed Management

- `createFeed(params)` — Create a new feed with channel-specific defaults
- `getFeed(id)` — Get feed by ID
- `getFeedBySlug(slug)` — Get feed by URL slug
- `updateFeed(id, params)` — Update feed configuration
- `deleteFeed(id)` — Delete feed and cascade-delete items/mappings
- `listFeeds(params?)` — List feeds with filtering and pagination
- `countFeeds()` — Total feed count

### Feed Generation

- `generateFeed(id, products)` — Process products through mappings, validate, and generate output
- `getFeedOutput(id)` — Get cached feed output string

### Feed Items

- `getFeedItems(feedId, params?)` — List processed items with status filtering
- `getFeedItem(feedId, productId)` — Get specific item by product ID
- `countFeedItems(feedId)` — Count items in a feed

### Category Mappings

- `addCategoryMapping(feedId, params)` — Map store category to channel category
- `updateCategoryMapping(id, params)` — Update mapping
- `deleteCategoryMapping(id)` — Remove mapping
- `listCategoryMappings(feedId)` — List all mappings for a feed

### Validation & Stats

- `validateFeed(id)` — Check feed config and item issues
- `getStats()` — Aggregate statistics across all feeds

## Field Mappings

Each feed has an array of field mappings that define how product data maps to feed fields:

```typescript
{
  sourceField: "title",        // Product field name
  targetField: "g:title",      // Feed field name
  transform: "uppercase",      // Optional transform
  transformValue: "SALE: ",    // Used with prefix/suffix/template
  defaultValue: "N/A",        // Fallback when source is empty
}
```

### Available Transforms

| Transform | Description | Example |
|-----------|-------------|---------|
| `uppercase` | Convert to uppercase | `"widget"` → `"WIDGET"` |
| `lowercase` | Convert to lowercase | `"WIDGET"` → `"widget"` |
| `prefix` | Prepend transformValue | `"ABC"` → `"SKU-ABC"` |
| `suffix` | Append transformValue | `"Widget"` → `"Widget - Sale"` |
| `template` | Replace `{value}` in template | `"Widget"` → `"Buy Widget now!"` |

## Feed Filters

Control which products are included in a feed:

```typescript
{
  includeStatuses: ["in_stock"],      // Only these availability statuses
  excludeCategories: ["Internal"],     // Skip these categories
  includeCategories: ["Electronics"],  // Only these categories
  minPrice: 1,                         // Minimum price
  maxPrice: 10000,                     // Maximum price
  requireImages: true,                 // Must have an image URL
  requireInStock: true,                // Must be "in_stock"
}
```

## Types

```typescript
type FeedChannel = "google-shopping" | "facebook" | "microsoft" | "pinterest" | "tiktok" | "custom";
type FeedFormat = "xml" | "csv" | "tsv" | "json";
type FeedStatus = "active" | "paused" | "error" | "draft";
type FeedItemStatus = "valid" | "warning" | "error" | "excluded";
```

## Notes

- Feeds start in `draft` status and auto-transition to `active` on first successful generation
- If any items have validation errors during generation, the feed status changes to `error`
- Each generation clears all previous feed items and re-processes from scratch
- Deleting a feed cascades to all associated feed items and category mappings
- Store endpoints only serve feeds with `active` status
- XML output uses RSS 2.0 format with Google Base namespace (`xmlns:g`)
- Google Shopping requires: `g:id`, `g:title`, `g:link`, `g:price`, `g:availability`, `g:image_link`
- Facebook requires: `id`, `title`, `link`, `price`, `availability`, `image_link`
