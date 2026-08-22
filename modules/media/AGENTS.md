# Media Module

Digital asset management with folder organization, tagging, bulk operations, and store-facing display components.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

```
src/
  index.ts          Factory: media(options?) => Module
  schema.ts         Zod models: asset, folder
  service.ts        MediaController interface + types
  service-impl.ts   MediaController implementation
  store/
    components/     Image display, media gallery, video player MDX + TSX
    endpoints/
      list-assets.ts      GET  /media
      get-asset.ts        GET  /media/:id
  admin/
    components/     Media admin MDX + TSX
    endpoints/
      list-assets.ts      GET    /admin/media
      create-asset.ts     POST   /admin/media/create
      bulk-delete.ts      POST   /admin/media/bulk-delete
      move-assets.ts      POST   /admin/media/move
      stats.ts            GET    /admin/media/stats
      list-folders.ts     GET    /admin/media/folders
      create-folder.ts    POST   /admin/media/folders/create
      rename-folder.ts    PUT    /admin/media/folders/:id
      delete-folder.ts    DELETE /admin/media/folders/:id/delete
      get-asset.ts        GET    /admin/media/:id
      update-asset.ts     PUT    /admin/media/:id/update
      delete-asset.ts     DELETE /admin/media/:id/delete
```

## Options

```ts
MediaOptions {
  maxFileSize?: string       // bytes, default "10485760" (10MB)
  allowedMimeTypes?: string  // comma-separated, default all
}
```

## Data models

- **asset**: id, name, altText?, url, mimeType, size, width?, height?, folder?, tags (JSON array), metadata (JSON), createdAt, updatedAt
- **folder**: id, name, parentId?, createdAt

## Patterns

- Folders support nesting via `parentId`
- Tags stored as JSON string array; filterable by single tag via `listAssets({ tag })`
- `bulkDelete(ids)` and `moveAssets(ids, folder)` for batch operations
- `getStats()` returns totals by MIME type and folder
- Store endpoints are read-only; all mutations are admin-only
- Events: media.uploaded, media.deleted, media.moved
- Option values are strings for config compatibility
