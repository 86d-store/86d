# Redirects Module

URL redirect management for SEO and URL migration. Supports exact-match and regex-based redirects with 301/302/307/308 status codes, hit tracking, and bulk operations.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

```
src/
  index.ts              Module factory, exports, admin nav (Content > Site)
  schema.ts             ModuleSchema: redirect entity
  service.ts            Redirect, RedirectStats, RedirectController interfaces
  service-impl.ts       Controller implementation (createRedirectController)
  store/endpoints/
    index.ts            Route map
    resolve.ts          GET /redirects/resolve — resolve path, record hit
    check.ts            GET /redirects/check — test if path has a redirect
  admin/endpoints/
    index.ts            Route map
    list-redirects.ts   GET /admin/redirects — paginated list with search
    create-redirect.ts  POST /admin/redirects/create
    get-redirect.ts     GET /admin/redirects/:id
    update-redirect.ts  POST /admin/redirects/:id/update
    delete-redirect.ts  POST /admin/redirects/:id/delete
    bulk-delete.ts      POST /admin/redirects/bulk-delete
    test-redirect.ts    POST /admin/redirects/test — test a path
    get-stats.ts        GET /admin/redirects/stats
  admin/components/
    index.tsx            RedirectsAdmin — list, search, test, bulk delete
  __tests__/
    service-impl.test.ts 57 tests covering all controller methods
```

## Data model

**redirect**: `id`, `sourcePath` (indexed), `targetPath`, `statusCode` (301|302|307|308), `isActive`, `isRegex`, `preserveQueryString`, `note?`, `hitCount`, `lastHitAt?`, `createdAt`, `updatedAt`

## Patterns

- **Resolution order**: exact match first, then regex patterns (first match wins)
- **Regex redirects**: `sourcePath` is a regex pattern, `targetPath` supports `$1`, `$2` group replacements
- **Hit tracking**: `resolve` endpoint auto-increments `hitCount` and updates `lastHitAt`
- **Duplicate prevention**: non-regex redirects enforce unique `sourcePath`
- **Loop prevention**: source and target cannot be the same path
- **Invalid regex**: gracefully returns no match (caught in try/catch)

## Options

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `maxRedirects` | string | `"1000"` | Max redirects evaluated per request |

## Admin nav

- Group: **Content**, Subgroup: **Site**
- Icon: `CornerUpRight`
- Path: `/admin/redirects`
