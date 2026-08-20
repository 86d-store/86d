

# @86d-app/redirects

📚 **Documentation:** [86d.app/docs/modules/redirects](https://86d.app/docs/modules/redirects)

URL redirect management module for 86d. Create, manage, and track URL redirects for SEO and URL migration.

## Features

- 301/302/307/308 HTTP redirect management
- Exact-match and regex-based redirect rules
- Automatic capture group replacement in regex targets (`$1`, `$2`, etc.)
- Hit tracking (count + timestamp)
- Bulk delete operations
- Path testing tool for admin
- Duplicate and loop prevention
- Query string preservation control

## Installation

Included by default when `modules: "*"` in your template `config.json`.

```json
{
  "modules": ["redirects"],
  "moduleOptions": {
    "@86d-app/redirects": {
      "maxRedirects": "1000"
    }
  }
}
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxRedirects` | `string` | `"1000"` | Maximum number of redirects evaluated per resolve request |

## Store Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/redirects/resolve?path=` | Resolve a path to its redirect target. Records a hit if matched. |
| `GET` | `/redirects/check?path=` | Check if a path has a matching redirect (no hit recorded). |

### Resolve response

```json
{
  "matched": true,
  "targetPath": "/new-page",
  "statusCode": 301,
  "preserveQueryString": true
}
```

## Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/redirects` | List redirects (query: `active`, `statusCode`, `search`, `take`, `skip`) |
| `GET` | `/admin/redirects/stats` | Redirect statistics (total, active, hits, top redirects) |
| `POST` | `/admin/redirects/create` | Create a redirect |
| `GET` | `/admin/redirects/:id` | Get a single redirect |
| `POST` | `/admin/redirects/:id/update` | Update a redirect |
| `POST` | `/admin/redirects/:id/delete` | Delete a redirect |
| `POST` | `/admin/redirects/bulk-delete` | Delete multiple redirects |
| `POST` | `/admin/redirects/test` | Test if a path matches any redirect rule |

### Create/Update fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sourcePath` | `string` | Yes | Source URL path (e.g., `/old-page`) |
| `targetPath` | `string` | Yes | Target URL path (e.g., `/new-page`) |
| `statusCode` | `number` | No | HTTP status code: 301, 302, 307, 308 (default: 301) |
| `isActive` | `boolean` | No | Whether the redirect is active (default: true) |
| `isRegex` | `boolean` | No | Whether sourcePath is a regex pattern (default: false) |
| `preserveQueryString` | `boolean` | No | Preserve query string on redirect (default: true) |
| `note` | `string` | No | Internal note about the redirect |

## Controller API

```typescript
interface RedirectController {
  createRedirect(params): Promise<Redirect>
  getRedirect(id: string): Promise<Redirect | null>
  updateRedirect(id: string, params): Promise<Redirect | null>
  deleteRedirect(id: string): Promise<boolean>
  listRedirects(params?): Promise<Redirect[]>
  countRedirects(params?): Promise<number>
  resolve(path: string): Promise<{ targetPath, statusCode, preserveQueryString } | null>
  recordHit(id: string): Promise<void>
  bulkDelete(ids: string[]): Promise<number>
  testPath(path: string): Promise<{ matched: boolean; redirect?: Redirect }>
  getStats(): Promise<RedirectStats>
}
```

## Regex Redirects

Regex redirects use the `sourcePath` as a regex pattern matched against request paths. Capture groups can be referenced in `targetPath`:

```
Source: /products/(.*)
Target: /shop/$1
Result: /products/shoes → /shop/shoes
```

```
Source: /blog/(\d{4})/(\d{2})/(.*)
Target: /posts/$1-$2-$3
Result: /blog/2024/03/my-post → /posts/2024-03-my-post
```

Resolution order: exact matches are checked first, then regex patterns (first match wins).

## Types

```typescript
interface Redirect {
  id: string
  sourcePath: string
  targetPath: string
  statusCode: number
  isActive: boolean
  isRegex: boolean
  preserveQueryString: boolean
  note?: string
  hitCount: number
  lastHitAt?: Date
  createdAt: Date
  updatedAt: Date
}

interface RedirectStats {
  totalRedirects: number
  activeRedirects: number
  totalHits: number
  topRedirects: Array<{ id, sourcePath, targetPath, hitCount }>
}
```

## Notes

- Non-regex redirects enforce unique `sourcePath` to prevent conflicts
- Creating a redirect where source equals target is rejected (loop prevention)
- Invalid regex patterns fail gracefully (treated as no match)
- Admin component supports search, bulk selection, test tool, and stats dashboard
- Appears under Content > Site in the admin sidebar
