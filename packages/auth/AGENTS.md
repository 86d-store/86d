# Auth

Authentication and authorization on better-auth with Drizzle adapter and Next.js integration.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide and this file.
2. **Implement** using the local patterns below.
3. **Verify.** Focused package tests while iterating. Full pre-commit gates live in the parent guide. After `modules/` changes, prove `bun run generate:modules -- --frozen` from repo root.
   - Done when every required parent gate for the _slice_ is _green_.

## Structure

```
src/
  index.ts          Auth instance, Next.js handler, Session type
  actions.ts        Server action to get current session (Next.js headers)
  store-access.ts   Role-based store admin access check
```

## Exports and import paths

| Path | Export |
|---|---|
| `auth` | `auth`, `handler`, `Session` |
| `auth/actions` | `getSession` |
| `auth/store-access` | `verifyStoreAdminAccess` |

- `auth` — better-auth instance: Drizzle + PostgreSQL, email/password, session cookie cache, admin plugin
- `handler` — `toNextJsHandler(auth)` for Next.js API routes
- `Session` — inferred from `auth.$Infer.Session`
- `getSession()` — server action reading session from Next.js `headers()`
- `verifyStoreAdminAccess(user)` — `{ hasAccess, role }` when `user.role === "admin"`

## Dependencies

- `better-auth` — auth framework
- `db` (workspace) — Drizzle client
- `env` (workspace) — validated auth secret and managed OAuth configuration
- `next` (peer, optional) — required for `actions.ts` server headers

## Patterns

- Session cookie cache TTL: 5 minutes (`cookieCache.maxAge: 300`)
- Better Auth is created only when `BETTER_AUTH_SECRET` is set and safe; otherwise `auth` is `null`, `isAuthEnabled` is false, and handlers return 503
- Admin plugin supplies role-based access
- `verifyStoreAdminAccess` grants store access only for `"admin"` — no other roles
- `StoreAccessResult.role` uses `string | undefined` (not `null`) for `exactOptionalPropertyTypes`
