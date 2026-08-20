

# @86d-app/sitemap

📚 **Documentation:** [86d.app/docs/modules/sitemap](https://86d.app/docs/modules/sitemap)

XML sitemap generation module for 86d. Auto-generates sitemaps from products, collections, pages, blog posts, and brands with configurable priorities and change frequencies.

## Features

- Auto-generate XML sitemap from store data
- Configurable per-source priorities and change frequencies
- Custom entry support for pages not auto-discovered
- Path exclusion rules
- On-demand regeneration via admin
- XML preview in admin
- Homepage always included at priority 1.0
- Proper XML escaping for special characters

## Installation

Included by default when `modules: "*"` in your template `config.json`.

```json
{
  "modules": ["sitemap"],
  "moduleOptions": {
    "@86d-app/sitemap": {
      "baseUrl": "https://mystore.com"
    }
  }
}
```

## Configuration

The sitemap config is stored as a singleton record and can be managed via admin endpoints.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `baseUrl` | `string` | `https://example.com` | Store base URL |
| `includeProducts` | `boolean` | `true` | Include product pages |
| `includeCollections` | `boolean` | `true` | Include collection pages |
| `includePages` | `boolean` | `true` | Include static pages |
| `includeBlog` | `boolean` | `true` | Include blog posts |
| `includeBrands` | `boolean` | `true` | Include brand pages |
| `defaultChangeFreq` | `ChangeFreq` | `weekly` | Default change frequency |
| `defaultPriority` | `number` | `0.5` | Default priority (0.0-1.0) |
| `productChangeFreq` | `ChangeFreq` | `weekly` | Product page frequency |
| `productPriority` | `number` | `0.8` | Product page priority |
| `collectionChangeFreq` | `ChangeFreq` | `weekly` | Collection page frequency |
| `collectionPriority` | `number` | `0.7` | Collection page priority |
| `pageChangeFreq` | `ChangeFreq` | `monthly` | Static page frequency |
| `pagePriority` | `number` | `0.6` | Static page priority |
| `blogChangeFreq` | `ChangeFreq` | `weekly` | Blog post frequency |
| `blogPriority` | `number` | `0.6` | Blog post priority |
| `excludedPaths` | `string[]` | `[]` | Paths to exclude from sitemap |

Change frequency values: `always`, `hourly`, `daily`, `weekly`, `monthly`, `yearly`, `never`

## Store Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/sitemap.xml` | Full XML sitemap (1hr cache) |
| `GET` | `/sitemap/stats` | Public stats (entry count, last generated) |

## Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/sitemap/config` | Get current configuration |
| `POST` | `/admin/sitemap/config/update` | Update configuration |
| `POST` | `/admin/sitemap/regenerate` | Rebuild sitemap from store data |
| `GET` | `/admin/sitemap/entries` | List entries (query: `source`, `take`, `skip`) |
| `POST` | `/admin/sitemap/entries/add` | Add a custom entry |
| `POST` | `/admin/sitemap/entries/:id/remove` | Remove a custom entry |
| `GET` | `/admin/sitemap/stats` | Detailed stats with entries by source |
| `GET` | `/admin/sitemap/preview` | Raw XML preview |

### Regenerate

Send page data to rebuild the sitemap:

```json
{
  "products": [{ "slug": "red-shoes", "updatedAt": "2024-01-01" }],
  "collections": [{ "slug": "summer" }],
  "pages": [{ "slug": "about" }],
  "blog": [{ "slug": "hello-world" }],
  "brands": [{ "slug": "nike" }]
}
```

## Controller API

```typescript
interface SitemapController {
  getConfig(): Promise<SitemapConfig>
  updateConfig(params): Promise<SitemapConfig>
  addEntry(params): Promise<SitemapEntry>
  removeEntry(id: string): Promise<boolean>
  listEntries(params?): Promise<SitemapEntry[]>
  countEntries(source?: string): Promise<number>
  generateXml(): Promise<string>
  regenerate(pages): Promise<number>
  getStats(): Promise<SitemapStats>
}
```

## Types

```typescript
type ChangeFreq = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never"

interface SitemapEntry {
  id: string
  loc: string          // Full URL
  lastmod?: Date
  changefreq: ChangeFreq
  priority: number     // 0.0 - 1.0
  source: string       // product, collection, page, blog, brand, custom, static
  sourceId?: string
  createdAt: Date
}

interface SitemapStats {
  totalEntries: number
  entriesBySource: Record<string, number>
  lastGenerated?: Date
}
```

## Notes

- Regeneration clears auto-generated entries but preserves custom entries
- Homepage is always included as a static entry with priority 1.0
- Path exclusions match both exact paths and path prefixes
- XML output is properly escaped for special characters
- The `/sitemap.xml` endpoint returns `application/xml` with 1-hour cache headers
- Appears under Content > Site in the admin sidebar
