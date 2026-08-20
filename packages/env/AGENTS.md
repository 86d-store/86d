# Env

Zod-validated environment variable access for the 86d platform.

## Structure

```
src/
  index.ts    Schema definition, validation, and typed env export
```

## Key exports

- `default` (env) — validated environment object, typed as `Env`
- `parseEnvironment(environment)` — validates an explicit environment through the same production boundary
- `Env` — TypeScript type inferred from the Zod schema

## Environment variables

| Variable | Type | Required | Default |
|---|---|---|---|
| `NODE_ENV` | `"development" \| "production" \| "test"` | No | `"development"` |
| `STORE_ID` | `string` | No | `"demo5b9d-c517-4c65-896e-8edef5cf5a94"` |
| `86D_API_URL` | `url` | No | `"https://api.86d.app"` |
| `86D_API_KEY` | `string` | No | — |
| `DATABASE_URL` | `string` | No | — |
| `NEXT_PUBLIC_STORE_URL` | `url` | No | — |
| `NEXT_PUBLIC_GOOGLE_TAG_MANAGER_ID` | `string` | No | — |
| `VERCEL_BLOB_STORAGE_HOSTNAME` | `string` | No | — |
| `RESEND_API_KEY` | `string` | No | — |
| `BETTER_AUTH_SECRET` | `string` | Production only | Local-only deterministic value in development and test |

## Patterns

- Uses `z.safeParse(process.env)` and explicit production security checks
- Production rejects a missing, short, known-placeholder, or low-entropy `BETTER_AUTH_SECRET`
- Development and test use a deterministic local-only auth secret when none is set
- Import as `import env from "env"` for validated, typed access

## Gotchas

- Validation runs at import time — importing this module in a context with invalid env will throw
- `86D_API_URL` uses `z.url()` which validates full URL format (not just string)
