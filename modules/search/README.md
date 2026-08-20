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

# Search Module

📚 **Documentation:** [86d.app/docs/modules/search](https://86d.app/docs/modules/search)

Full-text search with fuzzy matching, faceted filtering, autocomplete, click tracking, and search analytics for 86d commerce platform.

## Installation

```sh
npm install @86d-app/search
```

## Usage

```ts
import search from "@86d-app/search";

const module = search({
  maxResults: 100,
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `maxResults` | `number` | — | Maximum number of results per query |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/search?q=...&type=...&tags=...&sort=...&fuzzy=...&limit=...&skip=...` | Full-text search with facets, sorting, fuzzy matching, and did-you-mean |
| `GET` | `/search/suggest?q=...&limit=...` | Autocomplete suggestions |
| `GET` | `/search/recent?sessionId=...&limit=...` | Recent search queries by session |
| `POST` | `/search/click` | Record a search result click (queryId, term, entityType, entityId, position) |

### Search query parameters

| Param | Type | Default | Description |
|---|---|---|---|
| `q` | `string` | required | Search query text |
| `type` | `string` | — | Filter by entity type |
| `tags` | `string` | — | Comma-separated tag filter |
| `sort` | `string` | `relevance` | Sort: `relevance`, `newest`, `oldest`, `title_asc`, `title_desc` |
| `fuzzy` | `boolean` | `true` | Enable fuzzy/typo-tolerant matching |
| `limit` | `number` | `20` | Results per page (max 100) |
| `skip` | `number` | `0` | Offset for pagination |
| `sessionId` | `string` | — | Session ID for analytics tracking |

### Search response

```ts
{
  results: Array<{
    id: string;
    entityType: string;
    entityId: string;
    title: string;
    url: string;
    image?: string;
    tags: string[];
    score: number;
    highlights?: { title?: string; body?: string };
  }>;
  total: number;
  facets: {
    entityTypes: Array<{ type: string; count: number }>;
    tags: Array<{ tag: string; count: number }>;
  };
  didYouMean?: string;
}
```

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/search/analytics` | Search analytics summary (includes CTR and avg click position) |
| `GET` | `/admin/search/popular` | Most popular search terms |
| `GET` | `/admin/search/zero-results` | Queries that returned zero results |
| `GET` | `/admin/search/clicks` | Click-through rate analytics |
| `GET` | `/admin/search/synonyms` | List all synonym groups |
| `POST` | `/admin/search/synonyms/add` | Add a synonym group |
| `POST` | `/admin/search/synonyms/:id/delete` | Delete a synonym group |
| `POST` | `/admin/search/index` | Manually index an item |
| `POST` | `/admin/search/index/remove` | Remove an item from the index |
| `POST` | `/admin/search/index/bulk` | Bulk index up to 500 items |

## Controller API

```ts
interface SearchController {
  // Indexing
  indexItem(params: {
    entityType: string;
    entityId: string;
    title: string;
    body?: string;
    tags?: string[];
    url: string;
    image?: string;
    metadata?: Record<string, unknown>;
  }): Promise<SearchIndexItem>;

  bulkIndex(items: Array<{
    entityType: string;
    entityId: string;
    title: string;
    body?: string;
    tags?: string[];
    url: string;
    image?: string;
    metadata?: Record<string, unknown>;
  }>): Promise<{ indexed: number; errors: number }>;

  removeFromIndex(entityType: string, entityId: string): Promise<boolean>;

  // Search
  search(query: string, options?: {
    entityType?: string;
    tags?: string[];
    sort?: SearchSortField;
    fuzzy?: boolean;
    limit?: number;
    skip?: number;
  }): Promise<{
    results: SearchResult[];
    total: number;
    facets: SearchFacets;
    didYouMean?: string;
  }>;

  suggest(prefix: string, limit?: number): Promise<string[]>;

  // Analytics
  recordQuery(term: string, resultCount: number, sessionId?: string): Promise<SearchQuery>;
  recordClick(params: {
    queryId: string;
    term: string;
    entityType: string;
    entityId: string;
    position: number;
  }): Promise<SearchClick>;
  getRecentQueries(sessionId: string, limit?: number): Promise<SearchQuery[]>;
  getPopularTerms(limit?: number): Promise<PopularTerm[]>;
  getZeroResultQueries(limit?: number): Promise<PopularTerm[]>;
  getAnalytics(): Promise<SearchAnalyticsSummary>;

  // Synonyms
  addSynonym(term: string, synonyms: string[]): Promise<SearchSynonym>;
  removeSynonym(id: string): Promise<boolean>;
  listSynonyms(): Promise<SearchSynonym[]>;

  getIndexCount(): Promise<number>;
}
```

## Types

```ts
type SearchSortField = "relevance" | "newest" | "oldest" | "title_asc" | "title_desc";

interface SearchResult {
  item: SearchIndexItem;
  score: number;
  highlights?: { title?: string; body?: string };
}

interface SearchFacets {
  entityTypes: Array<{ type: string; count: number }>;
  tags: Array<{ tag: string; count: number }>;
}

interface SearchClick {
  id: string;
  queryId: string;
  term: string;
  entityType: string;
  entityId: string;
  position: number;
  clickedAt: Date;
}

interface SearchAnalyticsSummary {
  totalQueries: number;
  uniqueTerms: number;
  avgResultCount: number;
  zeroResultCount: number;
  zeroResultRate: number;
  clickThroughRate: number;
  avgClickPosition: number;
}
```

## Store Components

### SearchBar

An autocomplete search input with keyboard navigation support. Fetches suggestions as the user types (minimum 2 characters) and triggers a search callback on submission. Includes a search icon and an accessible combobox dropdown.

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `placeholder` | `string` | No | Placeholder text for the search input. Defaults to `"Search..."`. |
| `onSearch` | `(query: string) => void` | No | Callback fired when the user submits a search query (via Enter key or suggestion click). |

#### Usage in MDX

```mdx
<SearchBar placeholder="Search products..." onSearch={handleSearch} />
```

Best used in the site header or on a search page to provide instant search suggestions as customers type.

### SearchPage

A complete search experience combining SearchBar and SearchResults into a single page layout with a heading, search input, and results area. Manages the search query state internally.

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `sessionId` | `string` | No | Optional session ID passed to SearchResults for analytics tracking. |

#### Usage in MDX

```mdx
<SearchPage />
```

Best used as the main content of a dedicated `/search` page in the storefront.

### SearchResults

Displays search results for a given query, with loading and empty states. Fetches results from the search module and renders them as linked cards with optional images.

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `query` | `string` | Yes | The search query string to execute. |
| `entityType` | `string` | No | Filter results to a specific entity type (e.g., `"product"`). |
| `sessionId` | `string` | No | Optional session ID for search analytics tracking. |
| `limit` | `number` | No | Maximum number of results to return. Defaults to `20`. |

#### Usage in MDX

```mdx
<SearchResults query="shoes" entityType="product" limit={10} />
```

Best used below a search bar to display results, or on a category page for filtered search results.

## Notes

- **Fuzzy search** uses Levenshtein distance. Edit tolerance scales with word length: 0 for ≤3 chars, 1 for 4-5 chars, 2 for 6+ chars. Enabled by default.
- **Facets** are computed from all matching results before pagination, giving accurate counts regardless of page.
- **Did-you-mean** only activates when zero results are found, checking against indexed titles and historically successful search terms.
- **Click tracking** records which result was clicked and at what position, enabling CTR and rank quality analytics.
- **Synonyms** are bidirectional: adding "tee" → ["t-shirt"] means searching for either term finds both.
- **Highlights** wrap matched terms in `<mark>` tags for rendering in search result UIs.
