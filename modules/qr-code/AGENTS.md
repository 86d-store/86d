# QR Code Module

Generate and track QR codes for products, collections, pages, orders, or custom URLs.

## Structure

```
src/
  index.ts              Factory: qrCode(options?) => Module + admin nav (Marketing)
  schema.ts             Zod models: qrCode, qrScan
  service.ts            QrCodeController interface
  service-impl.ts       QrCodeController implementation
  mdx.d.ts              MDX type declarations
  store/endpoints/      get-qr-code, record-scan
  admin/endpoints/      CRUD qr-codes, batch create, list-scans
  admin/components/     QrCodeList (filterable list + create form), QrCodeDetail (view/edit + scans)
  __tests__/            controllers (39), endpoint-security (15), events (12)
```

## Options

```ts
interface QrCodeOptions extends ModuleConfig {
  defaultSize?: string;        // default: "256" (pixels)
  defaultFormat?: string;      // default: "svg"
  errorCorrection?: string;    // default: "M" (L|M|Q|H)
}
```

## Data models

- **QrCode** — id, label, targetUrl, targetType (product|collection|page|order|custom), targetId, format (svg|png), size, errorCorrection (L|M|Q|H), scanCount, isActive, metadata, timestamps
- **QrScan** — id, qrCodeId, scannedAt, userAgent, ipAddress, referrer

## Patterns

- `recordScan` increments qrCode.scanCount and creates a qrScan record
- `getByTarget(targetType, targetId)` looks up QR code by target reference
- `createBatch` creates multiple QR codes and emits qr.batch.created with all IDs
- Events: qr.created, qr.scanned, qr.deleted, qr.batch.created
- Exports: qrCodeTargetUrl, qrCodeTargetType
