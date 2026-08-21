<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/icon" height="96" alt="86d" />
  </a>
</p>

<p align="center">
  The Modern Foundation for Commerce
</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use. Please proceed with caution. Use at your own risk. 

# Env

Type-safe environment variable validation for the 86d platform using [Zod](https://zod.dev/). Validates `process.env` at import time and exports a fully typed configuration object.

## Installation

```sh
npm install env
```

## Usage

```ts
import env from "env";

console.log(env.NODE_ENV);       // "development" | "production" | "test"
console.log(env.STORE_ID);      // string
console.log(env.DATABASE_URL);  // string | undefined
```

## Environment Variables

| Variable | Type | Default | Description |
|---|---|---|---|
| `NODE_ENV` | `"development" \| "production" \| "test"` | `"development"` | Runtime environment |
| `STORE_ID` | `string` | `"demo5b9d-..."` | Store identifier |
| `86D_API_URL` | `url` | `"https://api.86d.app"` | Control Plane API base URL |
| `86D_STORE_ID` | `uuid` | — | Public managed Store identifier |
| `86D_WORKLOAD_CREDENTIAL` | `string` | — | Opaque managed workload credential |
| `86D_TELEMETRY` | `"managed-runtime-diagnostics-v1"` | — | Explicitly enables the bounded Managed Runtime Diagnostics v1 contract |
| `DATABASE_URL` | `string` | — | PostgreSQL connection string |
| `NEXT_PUBLIC_STORE_URL` | `url` | — | Public-facing store URL |
| `NEXT_PUBLIC_GOOGLE_TAG_MANAGER_ID` | `string` | — | GTM container ID |
| `VERCEL_BLOB_STORAGE_HOSTNAME` | `string` | — | Vercel Blob storage host |
| `RESEND_API_KEY` | `string` | — | Resend email API key |
| `BETTER_AUTH_SECRET` | `string` | Local-only value outside production | Secret for Better Auth sessions. Production requires at least 32 characters, rejects known defaults, and fails on low entropy. |

## API Reference

### Default Export

```ts
import env from "env";
```

A validated object containing all environment variables. Throws at import time if validation fails.

### `parseEnvironment(environment)`

Validates an explicit environment through the same exported seam used at process startup. Production fails closed when `BETTER_AUTH_SECRET` is missing or weak. Development and test receive a deterministic local-only value when the variable is absent.

### `Env`

```ts
import type { Env } from "env";
```

TypeScript type inferred from the Zod schema, representing the shape of the validated environment.

## Notes

- Validation runs eagerly on import. If any variable fails validation, an error is thrown with details about which fields are invalid.
- URL-typed variables (`86D_API_URL`, `NEXT_PUBLIC_STORE_URL`) are validated as proper URLs, not just strings.
- All variables without a default are optional and may be `undefined`.
