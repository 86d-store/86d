# Env

Zod-validated environment variable access for the Store Runtime.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide and this file. Deployment identity and managed workload variables are summarized in the parent; keep provider setup values in `.env.example` rather than duplicating them in code.
2. **Implement** using the local patterns below.
3. **Verify.** Focused package tests while iterating. Full pre-commit gates live in the parent guide. After `modules/` changes, prove `bun run generate:modules -- --frozen` from repo root.
   - Done when every required parent gate for the _slice_ is _green_.

## Structure

```
src/
  index.ts    Schema definition, validation, and typed env export
```

## Key exports

- `default` (env) — validated environment object, typed as `Env`
- `parseEnvironment(environment)` — validates an explicit environment through the same production boundary
- `Env` — TypeScript type inferred from the Zod schema

Import as `import env from "env"`.

## Environment variables

Live defaults and required shapes belong in the schema and `.env.example`. Common keys:

| Variable | Type | Required | Default |
|---|---|---|---|
| `NODE_ENV` | `"development" \| "production" \| "test"` | No | `"development"` |
| `STORE_ID` | `string` | No | `"demo5b9d-c517-4c65-896e-8edef5cf5a94"` |
| `86D_API_URL` | `url` | No | `"https://api.86d.app"` |
| `DATABASE_URL` | `string` | No | — |
| `NEXT_PUBLIC_STORE_URL` | `url` | No | — |
| `NEXT_PUBLIC_GOOGLE_TAG_MANAGER_ID` | `string` | No | — |
| `VERCEL_BLOB_STORAGE_HOSTNAME` | `string` | No | — |
| `RESEND_API_KEY` | `string` | No | — |
| `BETTER_AUTH_SECRET` | `string \| undefined` | No | — (auth disabled when unset) |

## Patterns

- Uses `z.safeParse(process.env)` plus `resolveBetterAuthSecret`
- Missing or production-unsafe `BETTER_AUTH_SECRET` disables auth; it does not throw
- Production still rejects short, known-placeholder, local-only, and low-entropy secrets by disabling auth

## Gotchas

- Schema validation still throws for malformed required-shape fields (for example an invalid URL). Auth secret quality never throws.
- `86D_API_URL` uses `z.url()` (full URL format, not a bare string)
