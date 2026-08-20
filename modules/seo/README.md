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

# SEO Module

📚 **Documentation:** [86d.app/docs/modules/seo](https://86d.app/docs/modules/seo)

Per-page SEO management including meta tags (title, description, Open Graph, Twitter Card), structured data (JSON-LD), URL redirects, and sitemap generation.

## Installation

```sh
npm install @86d-app/seo
```

## Usage

```ts
import seo from "@86d-app/seo";

const module = seo({
  defaultRobots: "index, follow",
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `defaultRobots` | `string` | `"index, follow"` | Default robots meta directive for pages without explicit settings |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/seo/meta` | Get meta tags for a given path (query param) |
| `GET` | `/seo/redirect` | Check if a path has a redirect |
| `GET` | `/seo/sitemap` | Get sitemap entries |

## Store Pages

| Path | Component | Description |
|---|---|---|
| `/sitemap` | `Sitemap` | HTML sitemap page |

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/seo/meta` | List all meta tag entries |
| `POST` | `/admin/seo/meta/upsert` | Create or update meta tags for a path |
| `DELETE` | `/admin/seo/meta/:id/delete` | Delete a meta tag entry |
| `GET` | `/admin/seo/redirects` | List all redirects |
| `POST` | `/admin/seo/redirects/create` | Create a redirect |
| `PUT` | `/admin/seo/redirects/:id/update` | Update a redirect |
| `DELETE` | `/admin/seo/redirects/:id/delete` | Delete a redirect |

## Controller API

The `SeoController` interface is exported for inter-module use.

```ts
interface SeoController {
  // Meta Tags
  upsertMetaTag(params: {
    path: string;
    title?: string;
    description?: string;
    canonicalUrl?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    ogType?: string;
    twitterCard?: string;
    twitterTitle?: string;
    twitterDescription?: string;
    twitterImage?: string;
    noIndex?: boolean;
    noFollow?: boolean;
    jsonLd?: Record<string, unknown>;
  }): Promise<MetaTag>;

  getMetaTagByPath(path: string): Promise<MetaTag | null>;
  getMetaTag(id: string): Promise<MetaTag | null>;
  deleteMetaTag(id: string): Promise<boolean>;
  listMetaTags(params?: { take?: number; skip?: number }): Promise<MetaTag[]>;

  // Redirects
  createRedirect(params: { fromPath: string; toPath: string; statusCode?: RedirectStatusCode }): Promise<Redirect>;
  updateRedirect(id: string, params: { fromPath?: string; toPath?: string; statusCode?: RedirectStatusCode; active?: boolean }): Promise<Redirect | null>;
  deleteRedirect(id: string): Promise<boolean>;
  getRedirect(id: string): Promise<Redirect | null>;
  getRedirectByPath(fromPath: string): Promise<Redirect | null>;
  listRedirects(params?: { active?: boolean; take?: number; skip?: number }): Promise<Redirect[]>;

  // Sitemap
  getSitemapEntries(): Promise<Array<{ path: string; lastModified?: Date }>>;
}
```

## Types

```ts
type RedirectStatusCode = 301 | 302 | 307 | 308;

interface MetaTag {
  id: string;
  path: string;
  title?: string;
  description?: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  noIndex: boolean;
  noFollow: boolean;
  jsonLd?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface Redirect {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: RedirectStatusCode;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

## Store Components

### SeoHead

Injects SEO meta tags into the page head. Fetches configured meta data for the given path and renders `<title>`, `<meta>` (description, robots, OpenGraph, Twitter Card), `<link rel="canonical">`, and JSON-LD structured data.

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | Yes | Page path to fetch meta tags for |
| `fallbackTitle` | `string` | No | Title used if none configured for the path |
| `fallbackDescription` | `string` | No | Description used if none configured |

#### Usage in MDX

```mdx
<SeoHead path="/products" fallbackTitle="All Products" />
<SeoHead path="/about" fallbackTitle="About Us" fallbackDescription="Learn more about our store." />
```

Place in page layouts or individual pages to enable per-page SEO control from the admin.

### SitemapPage

Human-readable sitemap listing all indexable pages. Shows page names as links with optional last-modified dates.

#### Props

None. The component fetches sitemap entries automatically.

#### Usage in MDX

```mdx
<SitemapPage />
```

Use on a `/sitemap` page to provide a browsable index of all store pages.

## Notes

- Meta tags are keyed by URL `path`. The upsert operation creates a new entry or updates an existing one for the same path.
- The store `get-meta` endpoint accepts the page path as a query parameter and returns its meta tags.
- Redirect status codes support 301 (permanent), 302 (temporary), 307 (temporary preserve method), and 308 (permanent preserve method).
- The sitemap endpoint aggregates entries across meta tags and other module data sources.
