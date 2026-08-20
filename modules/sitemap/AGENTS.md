# Sitemap Module

XML sitemap generation from products, collections, pages, blog posts, and brands. Supports custom entries, configurable priorities/frequencies, path exclusions, and on-demand regeneration.

## File structure

```
src/
  index.ts              Module factory, exports, admin nav (Content > Site)
  schema.ts             ModuleSchema: sitemapConfig + sitemapEntry entities
  service.ts            SitemapConfig, SitemapEntry, SitemapController interfaces
  service-impl.ts       Controller implementation (createSitemapController)
  store/endpoints/
    index.ts            Route map
    get-sitemap.ts      GET /sitemap.xml — full XML output (paginated if >50K entries)
    get-sitemap-index.ts GET /sitemap-index.xml — sitemap index for large sites
                         GET /sitemap-page.xml?page=N — paginated sitemap pages
    get-stats.ts        GET /sitemap/stats — public entry count + last generated
  admin/endpoints/
    index.ts            Route map
    get-config.ts       GET /admin/sitemap/config
    update-config.ts    POST /admin/sitemap/config/update
    regenerate.ts       POST /admin/sitemap/regenerate — rebuild from store data
    list-entries.ts     GET /admin/sitemap/entries — paginated entry list
    add-entry.ts        POST /admin/sitemap/entries/add — custom entry
    remove-entry.ts     POST /admin/sitemap/entries/:id/remove
    get-entry.ts        GET /admin/sitemap/entries/:id — single entry detail
    update-entry.ts     POST /admin/sitemap/entries/:id/update — edit entry
    bulk-add.ts         POST /admin/sitemap/entries/bulk-add — up to 500 entries
    bulk-remove.ts      POST /admin/sitemap/entries/bulk-remove — up to 500 IDs
    get-stats.ts        GET /admin/sitemap/stats
    preview.ts          GET /admin/sitemap/preview — raw XML preview
  admin/components/
    index.tsx            SitemapAdmin — config, stats, entries table, regenerate
  __tests__/
    service-impl.test.ts 130 tests covering all controller methods
```

## Data model

**sitemapConfig**: Singleton (`id: "default"`). Controls `baseUrl`, per-source toggles (`includeProducts`, etc.), change frequencies, priorities, `excludedPaths[]`, `lastGenerated`.

**sitemapEntry**: `id`, `loc` (full URL, indexed), `lastmod?`, `changefreq`, `priority`, `source` (static|product|collection|page|blog|brand|custom, indexed), `sourceId?`.

## Key patterns

- **Singleton config**: Auto-created with defaults on first `getConfig()` call
- **Regenerate**: Clears all non-custom entries, rebuilds from provided page data, preserves custom entries
- **Homepage**: Always included as `source: "static"` with priority 1.0 (unless excluded)
- **Exclusions**: `excludedPaths` checks both exact match and prefix match (`/path` and `/path/*`)
- **XML generation**: Proper escaping of `&`, `<`, `>`, `"`, `'` in URLs
- **Date formatting**: ISO 8601 date-only format (`YYYY-MM-DD`) for `lastmod`
- **Pagination**: Sites with >50,000 URLs get a sitemap index with multiple sitemap pages (MAX_ENTRIES_PER_SITEMAP = 50,000)
- **Sitemap index**: `/sitemap-index.xml` returns `<sitemapindex>` XML; redirects to `/api/sitemap.xml` if all entries fit in one page
- **Bulk operations**: Admin bulk-add/bulk-remove capped at 500 entries per request

## Options

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `baseUrl` | string | `"https://example.com"` | Store base URL for sitemap entries |

## Admin nav

- Group: **Content**, Subgroup: **Site**
- Icon: `Map`
- Path: `/admin/sitemap`
