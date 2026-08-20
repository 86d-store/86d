# Storage Package

Pluggable file storage abstraction with three backends: local filesystem, S3-compatible (including MinIO), and Vercel Blob.

## Structure

```
src/
  index.ts              StorageProvider interface, types, Zod config schema, re-exports
  factory.ts            createStorage(config), createStorageFromEnv()
  local.ts              LocalStorageProvider — writes to disk via Node fs
  s3.ts                 S3StorageProvider — AWS Signature V4 over fetch (no SDK dependency)
  vercel.ts             VercelBlobProvider — wraps @vercel/blob (optional peer dep)
  __tests__/
    config-schema.test.ts   6 tests — Zod schema parsing and defaults
    factory.test.ts         12 tests — factory creation, env var mapping, error cases
    local.test.ts           9 tests — real filesystem I/O in tmpdir
    s3.test.ts              11 tests — mocked fetch, signed requests, error handling
    vercel.test.ts          8 tests — mocked @vercel/blob, env-based URL/health
```

## Provider Interface

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

`storageConfigSchema` (Zod) validates config objects. `createStorageFromEnv()` reads from env vars:

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

Vercel Blob also reads `BLOB_READ_WRITE_TOKEN` (for auth) and `VERCEL_BLOB_STORAGE_HOSTNAME` (for URL construction).

## Key Patterns and Gotchas

- S3 provider uses **path-style URLs** (`endpoint/bucket/key`) for MinIO compatibility — no virtual-hosted-style support.
- S3 provider implements **AWS Signature V4** from scratch using `node:crypto` — zero external dependencies.
- S3 `delete` silently ignores 404 responses; `healthCheck` treats 403/404 as "available" (bucket exists, permissions may vary).
- Vercel Blob provider **dynamically imports** `@vercel/blob` at call time — it is an optional peer dependency.
- Local provider creates the base directory on construction and creates nested subdirectories on upload.
- Local provider's `delete` is a no-op for non-existent files.
- `content` accepts both `Buffer` and `ArrayBuffer`; all providers normalize to `Buffer` internally.

## Test Coverage

46 tests across 5 test files. All providers are tested. S3 and Vercel tests mock external I/O; local tests use real filesystem in a temp directory. Run with `bun run test`.
