# Storage

Pluggable file storage: local filesystem, S3-compatible (including MinIO), and Vercel Blob.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide and this file. Callers reach storage through `@86d-app/storage` (never import `@vercel/blob` directly outside this package).
2. **Implement** using the local patterns below. Keep `STORAGE_CLIENT` values and required configuration in `.env.example`.
3. **Verify.** `bun run test` in this package. Full pre-commit gates live in the parent guide. After `modules/` changes, prove `bun run generate:modules -- --frozen` from repo root.
   - Done when every required parent gate for the _slice_ is _green_.

## Structure

```
src/
  index.ts              StorageProvider interface, types, Zod config schema, re-exports
  factory.ts            createStorage(config), createStorageFromEnv()
  local.ts              LocalStorageProvider — writes to disk via Node fs
  s3.ts                 S3StorageProvider — AWS Signature V4 over fetch (no SDK dependency)
  vercel.ts             VercelBlobProvider — wraps @vercel/blob (optional peer dep)
  __tests__/
    config-schema.test.ts   Zod schema parsing and defaults
    factory.test.ts         Factory creation, env var mapping, error cases
    local.test.ts           Real filesystem I/O in tmpdir
    s3.test.ts              Mocked fetch, signed requests, error handling
    vercel.test.ts          Mocked @vercel/blob, env-based URL/health
```

## Provider interface

```ts
interface StorageProvider {
  upload(options: StorageUploadOptions): Promise<StorageUploadResult>;
  delete(options: StorageDeleteOptions): Promise<void>;
  getUrl(key: string): string;
  healthCheck(): Promise<boolean>;
}
```

- `StorageUploadOptions`: `{ key, content: Buffer | ArrayBuffer, contentType, public? }`
- `StorageUploadResult`: `{ url, key }`
- `StorageDeleteOptions`: `{ key }`

## Configuration

`storageConfigSchema` (Zod) validates config objects. `createStorageFromEnv()` reads:

| Env Var | Config Field | Default |
|---|---|---|
| `STORAGE_CLIENT` | `provider` | `"local"` |
| `STORAGE_LOCAL_DIR` | `localDir` | `"./uploads"` |
| `STORAGE_LOCAL_BASE_URL` | `localBaseUrl` | `"/uploads"` |
| `S3_ENDPOINT` | `s3Endpoint` | — |
| `S3_BUCKET` | `s3Bucket` | — |
| `S3_REGION` | `s3Region` | `"us-east-1"` |
| `S3_ACCESS_KEY` | `s3AccessKey` | — |
| `S3_SECRET_KEY` | `s3SecretKey` | — |

Vercel Blob also reads `BLOB_READ_WRITE_TOKEN` (auth) and `VERCEL_BLOB_STORAGE_HOSTNAME` (URL construction).

## Patterns and gotchas

- S3 uses **path-style URLs** (`endpoint/bucket/key`) for MinIO compatibility — no virtual-hosted-style
- S3 implements **AWS Signature V4** with `node:crypto` — zero external dependencies
- S3 `delete` silently ignores 404; `healthCheck` treats 403/404 as available (bucket exists; permissions may vary)
- Vercel Blob **dynamically imports** `@vercel/blob` at call time (optional peer dependency)
- Local provider creates the base directory on construction and nested subdirectories on upload
- Local `delete` is a no-op for missing files
- `content` accepts `Buffer` or `ArrayBuffer`; providers normalize to `Buffer` internally

## Tests

All providers are covered. S3 and Vercel mock external I/O; local uses a real temp directory. Run with `bun run test`.
