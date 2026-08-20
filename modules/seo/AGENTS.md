# SEO Module

Manages per-page meta tags (title, description, Open Graph, Twitter Card, JSON-LD), URL redirects, and sitemap generation.

## Structure

```
src/
  index.ts          Factory: seo(options?) => Module
  schema.ts         Zod models: metaTag, redirect
  service.ts        SeoController interface + types
  service-impl.ts   SeoController implementation
  markdown.ts       Markdown renderers for store pages
  admin/
    components/
      index.tsx       Admin component exports
      seo-admin.tsx   SEO manager UI (.tsx logic)
      seo-admin.mdx   Admin template
    endpoints/
      index.ts              Endpoint map
      list-meta.ts           GET  /admin/seo/meta
      upsert-meta.ts         POST /admin/seo/meta/upsert
      delete-meta.ts         DELETE /admin/seo/meta/:id/delete
      list-redirects.ts      GET  /admin/seo/redirects
      create-redirect.ts     POST /admin/seo/redirects/create
      update-redirect.ts     PUT  /admin/seo/redirects/:id/update
      delete-redirect.ts     DELETE /admin/seo/redirects/:id/delete
  store/
    components/
      _hooks.ts        Client-side hooks
      _utils.ts        Utility helpers
      index.tsx        Store component exports
      seo-head.tsx     Head meta tag injector (.tsx logic)
      seo-head.mdx     Store template
      sitemap-page.tsx Sitemap page (.tsx logic)
      sitemap-page.mdx Store template
    endpoints/
      index.ts         Endpoint map
      get-meta.ts      GET  /seo/meta
      get-redirect.ts  GET  /seo/redirect
      get-sitemap.ts   GET  /seo/sitemap
```

## Options

```ts
SeoOptions {
  defaultRobots?: string  // default "index, follow"
}
```

## Data models

- **metaTag**: id, path, title?, description?, canonicalUrl?, ogTitle?, ogDescription?, ogImage?, ogType?, twitterCard?, twitterTitle?, twitterDescription?, twitterImage?, noIndex, noFollow, jsonLd? (JSON), createdAt, updatedAt
- **redirect**: id, fromPath, toPath, statusCode (301|302|307|308), active, createdAt, updatedAt

## Patterns

- Meta tags are keyed by `path` — upsert creates or updates the meta tag for a given URL path
- Store `get-meta` endpoint looks up meta by query param path; `get-redirect` checks if a path has a redirect
- Sitemap endpoint aggregates entries from meta tags and other module data
- Redirect status codes stored as strings in schema but typed as numbers in the interface
- `noIndex` / `noFollow` stored as string "true"/"false" in schema, exposed as boolean in interface
- Store registers `/sitemap` as a store page with markdown renderer
