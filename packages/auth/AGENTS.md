# Auth

Authentication and authorization layer built on better-auth with Drizzle adapter and Next.js integration.

## Structure

```
src/
  index.ts          Auth instance, Next.js handler, Session type
  actions.ts        Server action to get current session (Next.js headers)
  store-access.ts   Role-based store admin access check
```

## Key exports

- `auth` — better-auth instance configured with Drizzle + PostgreSQL, email/password, session cookie cache, admin plugin
- `handler` — `toNextJsHandler(auth)` for use in Next.js API routes
- `Session` — inferred session type from `auth.$Infer.Session`
- `getSession()` — server action that reads session from Next.js `headers()`
- `verifyStoreAdminAccess(user)` — returns `{ hasAccess, role }` based on `user.role === "admin"`

## Import paths

| Path | Export |
|---|---|
| `auth` | `auth`, `handler`, `Session` |
| `auth/actions` | `getSession` |
| `auth/store-access` | `verifyStoreAdminAccess` |

## Dependencies

- `better-auth` — auth framework
- `db` (workspace) — Drizzle client for database access
- `env` (workspace) — validated auth secret and managed OAuth configuration
- `next` (peer, optional) — needed for `actions.ts` server headers

## Patterns

- Session uses cookie caching with 5-minute TTL (`cookieCache.maxAge: 300`)
- Better Auth receives the validated `BETTER_AUTH_SECRET` explicitly; production validation fails closed before auth is created
- Admin plugin from better-auth provides role-based access
- `verifyStoreAdminAccess` only checks for `"admin"` role — no other roles grant store access
- `StoreAccessResult.role` uses `string | undefined` (not `null`) to satisfy `exactOptionalPropertyTypes`
