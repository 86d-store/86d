<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/logo" height="96" alt="86d" />
  </a>
</p>

<p align="center">
  Dynamic Commerce
</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use. Please proceed with caution. Use at your own risk.

# Storage

Pluggable file storage abstraction for the 86d platform. Ships with three providers: local filesystem, S3-compatible (AWS, MinIO, etc.), and Vercel Blob.

## Installation

```sh
npm install @86d-app/storage
```

For Vercel Blob support, also install the optional peer dependency:

```sh
npm install @vercel/blob
```

## Usage

### From Environment Variables (recommended)

```ts
import { createStorageFromEnv } from "@86d-app/storage";

const storage = createStorageFromEnv();

// Upload a file
const result = await storage.upload({
  key: "images/product-photo.png",
  content: Buffer.from(fileData),
  contentType: "image/png",
});

console.log(result.url); // public URL
console.log(result.key); // "images/product-photo.png"

// Delete a file
await storage.delete({ key: "images/product-photo.png" });

// Get a public URL
const url = storage.getUrl("images/product-photo.png");

// Check if the storage backend is available
const healthy = await storage.healthCheck();
```

### Local Storage

```ts
import { createStorage } from "@86d-app/storage";

const storage = createStorage({
  provider: "local",
  localDir: "./uploads",
  localBaseUrl: "/uploads",
});
```

Files are written to disk under `localDir`. The `localBaseUrl` is used to construct public URLs (e.g. `/uploads/images/photo.png`). Your application must serve this directory statically.

### S3-Compatible Storage

```ts
import { createStorage } from "@86d-app/storage";

const storage = createStorage({
  provider: "s3",
  s3Endpoint: "https://s3.amazonaws.com",
  s3Bucket: "my-store-uploads",
  s3Region: "us-east-1",
  s3AccessKey: "AKIA...",
  s3SecretKey: "wJal...",
});
```

Works with AWS S3, MinIO, and any S3-compatible service. Uses path-style URLs for broad compatibility. Signs requests with AWS Signature V4 and has zero external dependencies.

### Vercel Blob

```ts
import { createStorage } from "@86d-app/storage";

const storage = createStorage({
  provider: "vercel",
});
```

Requires `@vercel/blob` as a peer dependency and the `BLOB_READ_WRITE_TOKEN` environment variable. Optionally set `VERCEL_BLOB_STORAGE_HOSTNAME` for URL construction via `getUrl()`.

## Configuration

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `STORAGE_CLIENT` | Provider to use: `local`, `s3`, or `vercel` | `local` |
| `STORAGE_LOCAL_DIR` | Directory for local file storage | `./uploads` |
| `STORAGE_LOCAL_BASE_URL` | Base URL for serving local files | `/uploads` |
| `S3_ENDPOINT` | S3-compatible endpoint URL | -- |
| `S3_BUCKET` | S3 bucket name | -- |
| `S3_REGION` | S3 region | `us-east-1` |
| `S3_ACCESS_KEY` | S3 access key ID | -- |
| `S3_SECRET_KEY` | S3 secret access key | -- |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob auth token (Vercel provider) | -- |
| `VERCEL_BLOB_STORAGE_HOSTNAME` | Vercel Blob hostname for URL construction | -- |

## API Reference

### `StorageProvider` Interface

All providers implement this interface:

```ts
interface StorageProvider {
  /** Upload a file to storage. */
  upload(options: StorageUploadOptions): Promise<StorageUploadResult>;

  /** Delete a file from storage. */
  delete(options: StorageDeleteOptions): Promise<void>;

  /** Get a public URL for a stored file. */
  getUrl(key: string): string;

  /** Check if the storage backend is available. */
  healthCheck(): Promise<boolean>;
}
```

### `StorageUploadOptions`

```ts
interface StorageUploadOptions {
  key: string;                      // Path/key to store the file under
  content: Buffer | ArrayBuffer;    // File content
  contentType: string;              // MIME type (e.g. "image/png")
  public?: boolean;                 // Whether publicly readable (default: true)
}
```

### `StorageUploadResult`

```ts
interface StorageUploadResult {
  url: string;   // Public URL of the uploaded file
  key: string;   // Storage key/path
}
```

### Factory Functions

| Function | Description |
|---|---|
| `createStorage(config)` | Create a provider from a `StorageConfig` object |
| `createStorageFromEnv()` | Create a provider from environment variables |

### Provider Classes

| Class | Description |
|---|---|
| `LocalStorageProvider` | Filesystem storage using Node `fs` |
| `S3StorageProvider` | S3-compatible storage with AWS Signature V4 |
| `VercelBlobProvider` | Vercel Blob storage via `@vercel/blob` |

## Provider-Specific Notes

### Local

- Creates the base directory automatically on initialization.
- Creates nested subdirectories on upload as needed.
- Deleting a non-existent file is a silent no-op.
- Health check verifies the base directory exists on disk.

### S3

- Uses **path-style URLs** (`endpoint/bucket/key`) for MinIO and other S3-compatible services.
- Implements AWS Signature V4 signing internally -- no AWS SDK required.
- All four config fields (`s3Endpoint`, `s3Bucket`, `s3AccessKey`, `s3SecretKey`) are required; the factory throws if any are missing.
- Delete ignores 404 responses (already deleted).
- Health check sends a HEAD request to the bucket; treats 200, 403, and 404 as healthy.

### Vercel Blob

- `@vercel/blob` is an **optional peer dependency** -- dynamically imported at call time.
- Requires `BLOB_READ_WRITE_TOKEN` environment variable for authentication.
- `getUrl()` uses `VERCEL_BLOB_STORAGE_HOSTNAME` if set; otherwise returns the raw key as a fallback (prefer using the URL returned from `upload()`).
- Health check returns `true` if `BLOB_READ_WRITE_TOKEN` is present.
