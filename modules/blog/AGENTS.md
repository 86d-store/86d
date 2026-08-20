# Blog Module

Content management for blog posts with drafts, scheduled publishing, featured posts, view tracking, and markdown rendering for store pages.

## Structure

```
src/
  index.ts          Factory: blog(options?) => Module
  schema.ts         Data model: post
  service.ts        BlogController interface + PostStats type
  service-impl.ts   BlogController implementation (slugify, readingTime, related posts)
  markdown.ts       toMarkdown converters for store pages (listing + detail)
  store/
    components/     Store-facing MDX + TSX (blog list, post detail)
    endpoints/
      list-posts.ts       GET  /blog
      get-post.ts         GET  /blog/:slug
      featured-posts.ts   GET  /blog/featured
      search-posts.ts     GET  /blog/search
      related-posts.ts    GET  /blog/:slug/related
      track-view.ts       POST /blog/:slug/view
  admin/
    components/     Admin MDX + TSX (blog admin)
    endpoints/
      list-posts.ts       GET    /admin/blog
      create-post.ts      POST   /admin/blog/create
      stats.ts            GET    /admin/blog/stats
      bulk-update.ts      POST   /admin/blog/bulk/status
      bulk-delete.ts      POST   /admin/blog/bulk/delete
      check-scheduled.ts  POST   /admin/blog/check-scheduled
      get-post.ts         GET    /admin/blog/:id
      update-post.ts      PUT    /admin/blog/:id/update
      delete-post.ts      DELETE /admin/blog/:id/delete
      publish-post.ts     POST   /admin/blog/:id/publish
      unpublish-post.ts   POST   /admin/blog/:id/unpublish
      archive-post.ts     POST   /admin/blog/:id/archive
      duplicate-post.ts   POST   /admin/blog/:id/duplicate
```

## Options

```ts
BlogOptions {
  postsPerPage?: string  // default "20"
}
```

## Data model

- **post**: id, title, slug, content, excerpt?, coverImage?, author?, status (draft|published|scheduled|archived), tags (json[]), category?, featured (bool), readingTime (number), metaTitle?, metaDescription?, scheduledAt?, publishedAt?, views (number), createdAt, updatedAt

## Events

- Emits: `blog.published`, `blog.unpublished`, `blog.deleted`, `blog.scheduled`, `blog.featured`

## Key patterns

- **Scheduled publishing**: Create with `status: "scheduled"` + `scheduledAt` date. `checkScheduledPosts()` publishes posts whose scheduledAt is in the past. Scheduling without a date falls back to draft.
- **Reading time**: Auto-calculated on create/update from word count (~200 wpm). HTML tags and markdown syntax stripped before counting.
- **Related posts**: Scored by shared tags (+2 per tag) and same category (+1). Only returns published posts.
- **Featured posts**: Boolean flag, filterable in list queries. Dedicated store endpoint `/blog/featured`.
- **View tracking**: `incrementViews(id)` bumps count. Store endpoint `POST /blog/:slug/view` for client-side tracking.
- **Duplicate post**: Creates copy as draft with `(Copy)` suffix, resets views/featured/publishedAt.
- **Bulk operations**: `bulkUpdateStatus` and `bulkDelete` process arrays of IDs, return `{updated/deleted, failed[]}`.
- **Stats**: Aggregates counts by status, total views, and category/tag frequency distributions.
- **Store visibility**: Store endpoints only serve posts with `status: "published"`.
- **Slug resolution**: Store uses slug, admin uses id. Auto-slugify from title when slug is empty.
- **SEO**: `metaTitle` and `metaDescription` fields for per-post SEO overrides.

## Gotchas

- `scheduledAt` must be provided when `status: "scheduled"` — otherwise status reverts to current.
- `publishPost()` clears `scheduledAt` to prevent re-triggering.
- `readingTime` is recalculated only when `content` is explicitly updated, not on status changes.
- `duplicatePost` generates a unique slug with UUID fragment to prevent collisions.
- Tag/search filtering happens client-side after DB fetch (JSONB array contains not supported by ModuleDataService).
