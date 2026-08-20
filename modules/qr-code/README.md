<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/logo" height="96" alt="86d" />
  </a>
</p>

<p align="center">Dynamic Commerce</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use.

# QR Code Module

📚 **Documentation:** [86d.app/docs/modules/qr-code](https://86d.app/docs/modules/qr-code)

Generate, manage, and track QR codes for products, collections, pages, orders, or custom URLs with scan analytics.

## Installation

```sh
npm install @86d-app/qr-code
```

## Usage

```ts
import qrCode from "@86d-app/qr-code";

const module = qrCode({
  defaultSize: "256",
  defaultFormat: "svg",
  errorCorrection: "M",
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultSize` | `string` | `"256"` | Default QR code size in pixels |
| `defaultFormat` | `string` | `"svg"` | Output format (svg or png) |
| `errorCorrection` | `string` | `"M"` | Error correction level (L, M, Q, H) |

## Store Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/qr-codes/:id` | Get QR code details |
| POST | `/qr-codes/:id/scan` | Record a scan event |

## Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/qr-codes` | List all QR codes |
| POST | `/admin/qr-codes/create` | Create a QR code |
| POST | `/admin/qr-codes/batch` | Batch create QR codes |
| GET | `/admin/qr-codes/:id` | Get QR code details |
| POST | `/admin/qr-codes/:id/update` | Update a QR code |
| POST | `/admin/qr-codes/:id/delete` | Delete a QR code |
| GET | `/admin/qr-codes/:id/scans` | List scans for a QR code |

## Controller API

```ts
interface QrCodeController extends ModuleController {
  create(params: { label: string; targetUrl: string; ... }): Promise<QrCode>;
  get(id: string): Promise<QrCode | null>;
  getByTarget(targetType: QrCodeTargetType, targetId: string): Promise<QrCode | null>;
  update(id: string, params: Partial<QrCode>): Promise<QrCode | null>;
  delete(id: string): Promise<boolean>;
  list(params?: { targetType?: QrCodeTargetType; isActive?: boolean; ... }): Promise<QrCode[]>;
  recordScan(id: string, params?: { userAgent?: string; ipAddress?: string; referrer?: string }): Promise<QrScan | null>;
  getScanCount(id: string): Promise<number>;
  listScans(qrCodeId: string, params?: { take?: number; skip?: number }): Promise<QrScan[]>;
  createBatch(items: Array<{ label: string; targetUrl: string; ... }>): Promise<QrCode[]>;
}
```

## Types

- **QrCodeTargetType** — `"product" | "collection" | "page" | "order" | "custom"`
- **QrCodeFormat** — `"svg" | "png"`
- **QrCodeErrorCorrection** — `"L" | "M" | "Q" | "H"`
- **QrCode** — QR code with target reference, format settings, and scan counter
- **QrScan** — Individual scan record with user agent, IP, and referrer

## Components

### Admin

- **QrCodeList** — Paginated QR code list with target type and active status filters. Inline create form (single + batch mode). Delete with confirmation.
- **QrCodeDetail** — Single QR code view with editable fields, overview cards (target type, status, scan count, format), and scan history table with pagination.

## Notes

- `recordScan` both increments the QR code's `scanCount` and creates a separate `QrScan` record for detailed analytics.
- `getByTarget` finds QR codes by their target type and ID, useful for checking if a product already has a QR code.
- `createBatch` processes items sequentially and emits individual `qr.created` events plus one `qr.batch.created` event.
