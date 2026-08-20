# product-feeds

Product feed generation for shopping channels (Google Shopping, Facebook/Meta, Microsoft, Pinterest, TikTok, custom).

## File structure

```
src/
  index.ts                        Module factory, options, type re-exports
  schema.ts                       Three entities: feed, feedItem, categoryMapping
  service.ts                      Controller interface + all type definitions
  service-impl.ts                 Controller implementation + output formatters
  store/endpoints/
    index.ts                      Public feed endpoints
    get-feed-by-slug.ts           GET /feeds/:slug — serve feed output
    list-active-feeds.ts          GET /feeds — list active feeds
  admin/endpoints/
    index.ts                      12 admin endpoints
    create-feed.ts                POST /admin/product-feeds/create
    get-feed.ts                   GET /admin/product-feeds/:id
    update-feed.ts                POST /admin/product-feeds/:id/update
    delete-feed.ts                POST /admin/product-feeds/:id/delete
    list-feeds.ts                 GET /admin/product-feeds
    generate-feed.ts              POST /admin/product-feeds/:id/generate
    get-feed-items.ts             GET /admin/product-feeds/:id/items
    get-stats.ts                  GET /admin/product-feeds/stats
    validate-feed.ts              POST /admin/product-feeds/:id/validate
    add-category-mapping.ts       POST /admin/product-feeds/:id/mappings/create
    list-category-mappings.ts     GET /admin/product-feeds/:id/mappings
    delete-category-mapping.ts    POST /admin/product-feeds/:id/mappings/:mappingId/delete
  __tests__/
    service-impl.test.ts          78 tests
    endpoint-security.test.ts     41 tests (cascade deletion, generation, filters, output formats, category mappings, validation, stats)
```

## Data model

**feed** — Feed configuration: name, slug, channel, format, fieldMappings (JSON), filters (JSON), cached output, stats.

**feedItem** — Per-product snapshot after generation: mapped data, validation status, issues.

**categoryMapping** — Maps store categories to channel-specific categories (e.g. Google product taxonomy).

## Key patterns

- Each channel has default field mappings (Google uses `g:` prefix, Facebook uses bare names)
- Field transforms: `uppercase`, `lowercase`, `prefix`, `suffix`, `template` (uses `{value}` placeholder)
- Filters: `minPrice`, `maxPrice`, `requireImages`, `requireInStock`, `includeCategories`, `excludeCategories`, `includeStatuses`
- Feed generation is fail-closed until it can read an immutable published Catalog revision; caller-supplied product snapshots are never authoritative
- Output formats: XML (RSS 2.0 + Google NS), CSV, TSV, JSON
- XML output escapes `&`, `<`, `>`, `"`, `'`; CSV escapes commas and quotes
- Controller key is `productFeeds` (camelCase of module id)
- Store endpoint serves cached output only for active feeds

## Options

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `maxFeeds` | string | `"50"` | Max feeds per store |
| `maxProductsPerFeed` | string | `"100000"` | Max products per generation |

## Gotchas

- The generation endpoint currently returns `PRODUCT_FEED_GENERATION_REVIEW_REQUIRED` without mutating feed state
- Feed auto-transitions from `draft` → `active` on first successful generation
- Feed transitions to `error` status if any items have validation errors
- `deleteFeed` cascades: deletes all feedItems and categoryMappings
- Store endpoint returns raw output string — the consumer is responsible for setting Content-Type headers
