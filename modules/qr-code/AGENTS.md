# QR Code Module

Generate and track QR codes for products, collections, pages, orders, or custom URLs.

**Scope:** This guide owns Module-specific mechanics. In the 86d.store source checkout, read the repository root [`AGENTS.md`](../../AGENTS.md) for shared rules and gates. In another project, follow that project's instructions and the installed `@86d-app/core` contracts.

## Change protocol

1. **Route.** Read this guide and the Module's [`README.md`](./README.md). In the 86d.store source checkout, storage or cross-Module changes also follow the root [Module contracts](../../AGENTS.md#module-contracts) routes.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** In the 86d.store source checkout, run `bun run generate:modules` after a Module change, then `bun run generate:modules -- --frozen` and the parent gates. In another project, use that project's checks. Run the Module's focused tests when available.
   - Done when the current project's required checks pass; source-checkout work also requires a passing frozen registry check.

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
