# FAQ Module

Self-service knowledge base with categorized questions, full-text search, and helpfulness voting.

## Structure

```
src/
  index.ts          Factory: faq(options?) => Module + admin nav registration
  schema.ts         Data models: faqCategory, faqItem
  service.ts        FaqController interface
  service-impl.ts   FaqController implementation
  mdx.d.ts          MDX module type declaration
  store/
    endpoints/      Customer-facing
      list-categories.ts     GET  /faq/categories
      get-category.ts        GET  /faq/categories/:slug
      get-item.ts            GET  /faq/items/:slug
      search.ts              GET  /faq/search?q=...
      vote.ts                POST /faq/items/:id/vote
    components/     Customer-facing MDX components
      index.tsx     FaqAccordion, FaqSearch
      faq-accordion.tsx/.mdx  Collapsible Q&A list
      faq-search.tsx/.mdx     Live search widget
      _hooks.ts     useFaqApi() hook
      _utils.ts     Error extraction helper
  admin/
    endpoints/      Protected (renders in store admin /admin/)
      list-categories.ts     GET    /admin/faq/categories
      create-category.ts     POST   /admin/faq/categories/create
      update-category.ts     PUT    /admin/faq/categories/:id
      delete-category.ts     DELETE /admin/faq/categories/:id/delete
      list-items.ts          GET    /admin/faq/items
      create-item.ts         POST   /admin/faq/items/create
      get-item.ts            GET    /admin/faq/items/:id
      update-item.ts         PUT    /admin/faq/items/:id
      delete-item.ts         DELETE /admin/faq/items/:id/delete
      stats.ts               GET    /admin/faq/stats
  admin/
    components/
      index.tsx           FaqList, FaqDetail, FaqCategories, FaqCategoryDetail
  __tests__/
    service-impl.test.ts   39 tests covering all controller methods
```

## Options

```ts
FaqOptions {
  maxSearchResults?: number  // default 20
}
```

## Data models

- **faqCategory**: id, name, slug (unique), description?, icon?, position, isVisible, metadata
- **faqItem**: id, categoryId (FK cascade), question, answer, slug (unique), position, isVisible, tags[], helpfulCount, notHelpfulCount, metadata

## Admin Components

| Component | Path | Description |
|---|---|---|
| `FaqList` | `/admin/faq` | Stats (categories/questions/helpful/not helpful), category filter, item list with visibility badges, inline create form |
| `FaqDetail` | `/admin/faq/:id` | Edit form for question, answer, category, slug, tags, position, visibility toggle |
| `FaqCategories` | `/admin/faq/categories` | Category list with visibility badges, inline create form with auto-slug, edit/delete actions |
| `FaqCategoryDetail` | `/admin/faq/categories/:id` | Edit form for name, slug, description, icon, position, visibility toggle |

## Key patterns

- Categories and items are ordered by `position` field (ascending)
- Slug-based lookups for SEO-friendly URLs
- Search scores: question match (10) > tag match (8) > answer match (5), plus word-level bonuses
- Helpfulness voting is anonymous and cumulative
- `deleteCategory` cascades to all items in that category
- Store endpoints filter to `isVisible: true` only; admin endpoints show all
- `exactOptionalPropertyTypes` is on — all optional params use `| undefined`

## Events

| Event | Trigger | Payload |
|---|---|---|
| `faq.category.created` | Category created via admin endpoint | `categoryId`, `name`, `slug` |
| `faq.category.updated` | Category updated via admin endpoint | `categoryId`, `name`, `slug` |
| `faq.category.deleted` | Category deleted via admin endpoint | `categoryId` |
| `faq.item.created` | FAQ item created via admin endpoint | `itemId`, `categoryId`, `question`, `slug` |
| `faq.item.updated` | FAQ item updated via admin endpoint | `itemId`, `categoryId`, `question`, `slug` |
| `faq.item.deleted` | FAQ item deleted via admin endpoint | `itemId` |
