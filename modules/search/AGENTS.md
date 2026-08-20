# Search Module

In-memory full-text search with fuzzy matching, faceted filtering, click tracking, and query analytics.

## Structure

```
src/
  index.ts          Factory: search(options?) => Module
  schema.ts         Data models: searchIndex, searchQuery, searchSynonym, searchClick
  service.ts        SearchController interface + types (SearchResult, SearchFacets, SearchClick, etc.)
  service-impl.ts   SearchController implementation (fuzzy, Levenshtein, highlights, facets)
  store/
    components/     Store-facing TSX (search bar, page, results)
    endpoints/
      store-search.ts    GET  /search/store-search (search integration)
      search.ts          GET  /search (full-text with sort, tags, fuzzy, facets, did-you-mean)
      suggest.ts         GET  /search/suggest
      recent.ts          GET  /search/recent
      click.ts           POST /search/click (click tracking)
  admin/
    components/     Admin TSX (analytics dashboard)
    endpoints/
      analytics.ts           GET  /admin/search/analytics (includes CTR + avg click position)
      popular.ts             GET  /admin/search/popular
      zero-results.ts        GET  /admin/search/zero-results
      click-analytics.ts     GET  /admin/search/clicks
      synonyms.ts            GET  /admin/search/synonyms
                             POST /admin/search/synonyms/add
                             POST /admin/search/synonyms/:id/delete
      index-manage.ts        POST /admin/search/index
                             POST /admin/search/index/remove
      bulk-index.ts          POST /admin/search/index/bulk (up to 500 items)
```

## Options

```ts
SearchOptions {
  maxResults?: number
}
```

## Data models

- **searchIndex**: id, entityType, entityId, title, body?, tags (json[]), url, image?, metadata (json), indexedAt
- **searchQuery**: id, term, normalizedTerm, resultCount, sessionId?, searchedAt
- **searchSynonym**: id, term, synonyms (json[]), createdAt
- **searchClick**: id, queryId, term, entityType, entityId, position, clickedAt

## Events

- Emits: `search.queried`, `search.indexed`, `search.removed`, `search.clicked`

## Patterns

- Registers `search: { store: "/search/store-search" }` for cross-module search integration
- Registers store page at `/search` (SearchPage component)
- `indexItem` uses composite key `${entityType}_${entityId}` for deduplication; re-indexing updates in-place
- Different entityTypes with same entityId are separate index entries
- **Fuzzy search**: Levenshtein distance matching on title/tag/body tokens. Edit tolerance: 0 for ≤3 chars, 1 for 4-5 chars, 2 for 6+ chars. Enabled by default, disable with `fuzzy: false`
- **Scoring**: exact title (100) > title prefix (50) > tag exact (30) > title substring (25) > fuzzy title (15) > tag substring (15) > body (10) > fuzzy tag (8) > fuzzy body (5)
- **Sorting**: relevance (default), newest, oldest, title_asc, title_desc
- **Facets**: search results include entityType counts and tag counts (top 20)
- **Tag filtering**: pass `tags` option to filter results to items matching any specified tag
- **Highlights**: results include `<mark>` wrapped text in title and body for matched terms
- **Did-you-mean**: when a search returns zero results, suggests corrections using Levenshtein distance against indexed titles and popular search terms
- **Click tracking**: `recordClick()` stores query-to-click data; analytics includes CTR and avg click position
- **Bulk indexing**: `bulkIndex()` accepts up to 500 items, returns `{indexed, errors}` counts
- `recordQuery()` logs each search for analytics (popular terms, zero-result tracking)
- `suggest(prefix)` returns autocomplete: popular terms with results first, then matching index titles, deduplicated
- Synonyms are bidirectional: if "tee" → ["t-shirt"], then searching "tee" or "t-shirt" finds both
