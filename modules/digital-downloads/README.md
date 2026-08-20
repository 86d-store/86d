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

# Digital Downloads Module

📚 **Documentation:** [86d.app/docs/modules/digital-downloads](https://86d.app/docs/modules/digital-downloads)

Secure file delivery for the 86d commerce platform. Associates downloadable files with products and generates expiring, limited-use tokens for order fulfillment. Supports batch token creation for orders with multiple digital products.

![version](https://img.shields.io/badge/version-0.1.0-blue) ![license](https://img.shields.io/badge/license-MIT-green)

## Installation

```sh
npm install @86d-app/digital-downloads
```

## Usage

```ts
import digitalDownloads from "@86d-app/digital-downloads";
import { createModuleClient } from "@86d-app/core";

const client = createModuleClient([
  digitalDownloads({
    defaultTokenExpiryDays: 7,
    defaultMaxDownloads: 3,
  }),
]);
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `defaultTokenExpiryDays` | `number` | `undefined` | Default token expiry in days (0 or undefined = no expiry) |
| `defaultMaxDownloads` | `number` | `undefined` | Default max downloads per token (0 or undefined = unlimited) |

## Token Flow

```
1. Admin creates a file record linked to a product
2. After order payment, create download token(s) for the customer
3. Customer accesses GET /downloads/:token
4. useToken validates and increments the download count
5. Returns the file URL on success
```

Token validation checks in order:
1. Token not found
2. `revokedAt` is set (permanently disabled)
3. `expiresAt` is in the past
4. `downloadCount >= maxDownloads`

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/downloads/:token` | Consume a token and retrieve the file URL |
| `GET` | `/downloads/me` | List download tokens for authenticated user |
| `GET` | `/downloads/product/:productId` | List file metadata for a product (public, no URLs) |

### GET /downloads/product/:productId

Returns active file metadata (id, name, fileSize, mimeType) without download URLs. Use on product pages to show available downloads.

## Admin Endpoints

### Files

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/downloads/files` | List all downloadable files |
| `POST` | `/admin/downloads/files/create` | Create a file record |
| `GET` | `/admin/downloads/files/:id` | Get a file by ID |
| `PUT` | `/admin/downloads/files/:id/update` | Update a file record |
| `DELETE` | `/admin/downloads/files/:id/delete` | Delete a file record |

### Tokens

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/downloads/tokens` | List all download tokens |
| `POST` | `/admin/downloads/tokens/create` | Create a download token |
| `POST` | `/admin/downloads/tokens/batch` | Create tokens for multiple files at once |
| `GET` | `/admin/downloads/tokens/:id` | Get a token by ID |
| `POST` | `/admin/downloads/tokens/:id/revoke` | Revoke a download token |

## Controller API

```ts
// ── Files ──────────────────────────────────────────────────────────────

controller.createFile(params: {
  productId: string;
  name: string;
  url: string;         // raw storage URL
  fileSize?: number;
  mimeType?: string;
  isActive?: boolean;
}): Promise<DownloadableFile>

controller.getFile(id: string): Promise<DownloadableFile | null>
controller.listFiles(params?: { productId?: string; take?: number; skip?: number }): Promise<DownloadableFile[]>
controller.updateFile(id, params): Promise<DownloadableFile | null>
controller.deleteFile(id: string): Promise<boolean>

// ── Tokens ─────────────────────────────────────────────────────────────

controller.createToken(params: {
  fileId: string;
  email: string;
  orderId?: string;
  maxDownloads?: number;
  expiresAt?: Date;
}): Promise<DownloadToken>

controller.createTokenBatch(params: {
  fileIds: string[];       // one token per file
  email: string;
  orderId?: string;
  maxDownloads?: number;
  expiresAt?: Date;
}): Promise<DownloadToken[]>

controller.getToken(id: string): Promise<DownloadToken | null>
controller.getTokenByValue(token: string): Promise<DownloadToken | null>
controller.useToken(token: string): Promise<{ ok, reason?, file?, token? }>
controller.revokeToken(token: string): Promise<boolean>      // by token value
controller.revokeTokenById(id: string): Promise<boolean>     // by record ID
controller.listTokensByEmail(params: { email; take?; skip? }): Promise<DownloadToken[]>
controller.listTokens(params?: { fileId?; orderId?; email?; take?; skip? }): Promise<DownloadToken[]>
```

## Example: Order Fulfillment with Batch Tokens

```ts
// 1. After payment confirmed, create tokens for all purchased digital files
const files = await controller.listFiles({ productId: "prod_ebook" });

const tokens = await controller.createTokenBatch({
  fileIds: files.map(f => f.id),
  email: "customer@example.com",
  orderId: "ord_abc123",
  maxDownloads: 5,
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
});

// 2. Send download links to customer (each token.token is a UUID)
for (const t of tokens) {
  console.log(`Download: /downloads/${t.token}`);
}

// 3. Admin can revoke a token if needed
await controller.revokeTokenById(tokens[0].id);

// 4. Admin can check token usage
const tokenInfo = await controller.getToken(tokens[0].id);
console.log(`Downloaded ${tokenInfo?.downloadCount} times`);
```

## Types

```ts
interface DownloadableFile {
  id: string;
  productId: string;
  name: string;
  url: string;
  fileSize?: number;
  mimeType?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface DownloadToken {
  id: string;
  token: string;          // UUID used in download URL
  fileId: string;
  orderId?: string;
  email: string;
  maxDownloads?: number;
  downloadCount: number;
  expiresAt?: Date;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

> Note: The controller key uses a hyphen: `"digital-downloads"`. Access it via bracket notation: `controllers["digital-downloads"]`.

## Store Components

### MyDownloads

Lists downloadable files for a customer by email.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `email` | `string` | -- | Customer email to fetch downloads for |
| `title` | `string` | `"My Downloads"` | Section heading |

### DownloadButton

Single download button for a specific token.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `token` | `string` | -- | Download token |
| `label` | `string` | `"Download"` | Button label |
