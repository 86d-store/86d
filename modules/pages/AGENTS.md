# Pages Module

CMS-style static pages with draft/published/archived workflow, hierarchical structure, and optional navigation visibility.

## Structure

```
src/
  index.ts          Factory: pages(options?) => Module
  schema.ts         Zod models: page
  service.ts        PagesController interface + types
  service-impl.ts   PagesController implementation
  markdown.ts       Markdown renderers for store pages
  admin/
    components/
      index.tsx         Admin component exports
      pages-admin.tsx   Page editor UI (.tsx logic)
      pages-admin.mdx   Admin template
    endpoints/
      index.ts          Endpoint map
      list-pages.ts     GET  /admin/pages
      create-page.ts    POST /admin/pages/create
      get-page.ts       GET  /admin/pages/:id
      update-page.ts    PUT  /admin/pages/:id/update
      delete-page.ts    DELETE /admin/pages/:id/delete
  store/
    components/
      _hooks.ts         Client-side hooks
      index.tsx         Store component exports
      page-listing.tsx  Page listing view (.tsx logic)
      page-listing.mdx  Store template
      page-detail.tsx   Single page view (.tsx logic)
      page-detail.mdx   Store template
    endpoints/
      index.ts          Endpoint map
      list-pages.ts     GET  /pages
      get-page.ts       GET  /pages/:slug
      get-navigation.ts GET  /pages/navigation
```

## Options

```ts
PagesOptions {
  pagesPerPage?: string  // default listing page size, default "50"
}
```

## Data models

- **page**: id, title, slug (unique), content, excerpt?, status (draft|published|archived), template?, metaTitle?, metaDescription?, featuredImage?, position, showInNavigation, parentId? (self-ref, set null on delete), publishedAt?, createdAt, updatedAt

## Patterns

- Pages have a parent/child hierarchy via `parentId` (set null on parent delete, not cascade)
- `showInNavigation` flag marks pages for inclusion in auto-generated navigation menus
- `getNavigationPages()` returns only published pages with `showInNavigation: true`
- Status lifecycle: draft -> published (sets publishedAt) -> archived; `publishPage`/`unpublishPage`/`archivePage` helpers
- Store registers `/pages` and `/p/:slug` as store pages with markdown renderers
- Store endpoint serves only published pages; admin can access all statuses
