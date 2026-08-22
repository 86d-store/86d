# Vendors Module

Multi-vendor marketplace support. Vendor profiles, product assignments, commission tracking, and payout management.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

```
src/
  index.ts          Factory: vendors(options?) => Module + admin nav registration
  schema.ts         Zod models: vendor, vendorProduct, vendorPayout
  service.ts        VendorController interface + type definitions
  service-impl.ts   VendorController implementation
  store/endpoints/
    list-vendors.ts       GET  /vendors
    get-vendor.ts         GET  /vendors/:slug
    vendor-products.ts    GET  /vendors/:vendorId/products
    apply.ts              POST /vendors/apply
  admin/components/
    index.tsx             Admin UI (VendorAdmin, VendorPayouts) — "use client"
  admin/endpoints/
    list-vendors.ts       GET    /admin/vendors
    create-vendor.ts      POST   /admin/vendors/create
    get-stats.ts          GET    /admin/vendors/stats
    get-vendor.ts         GET    /admin/vendors/:id
    update-vendor.ts      PATCH  /admin/vendors/:id/update
    delete-vendor.ts      DELETE /admin/vendors/:id/delete
    update-status.ts      PATCH  /admin/vendors/:id/status
    list-products.ts      GET    /admin/vendors/:vendorId/products
    assign-product.ts     POST   /admin/vendors/:vendorId/products/assign
    unassign-product.ts   DELETE /admin/vendors/:vendorId/products/:productId/unassign
    list-payouts.ts       GET    /admin/vendors/:vendorId/payouts
    create-payout.ts      POST   /admin/vendors/:vendorId/payouts/create
    update-payout-status.ts PATCH /admin/vendors/payouts/:id/status
    payout-stats.ts       GET    /admin/vendors/payouts/stats
```

## Options

```ts
VendorsOptions {
  defaultCommissionRate?: string  // percentage, default "10"
  requireApproval?: string        // default "true"
}
```

## Data models

- **vendor**: id, name, slug (unique), email, phone?, description?, logo?, banner?, website?, commissionRate, status (pending|active|suspended|closed), address fields, metadata?, joinedAt, createdAt, updatedAt
- **vendorProduct**: id, vendorId (indexed), productId (indexed), commissionOverride?, status (active|paused), createdAt
- **vendorPayout**: id, vendorId (indexed), amount, currency, status (pending|processing|completed|failed), method?, reference?, periodStart, periodEnd, notes?, createdAt, completedAt?

## Patterns

- Vendors start as `pending` and require admin approval (status → `active`)
- Product assignment is idempotent — assigning the same product twice returns the existing record
- Deleting a vendor cascades to product assignments and payouts
- Commission can be overridden per-product via `commissionOverride` on vendorProduct
- Payout `completedAt` is auto-set when status transitions to `completed`
- Store endpoints only show `active` vendors and their `active` products
- `getProductVendor` only returns vendors with `active` product assignments

## Caveats

- `exactOptionalPropertyTypes` is on — omit absent optional params; do not pass `undefined`
- `data.upsert` call sites need concrete types at the boundary; fix the types rather than suppress diagnostics
- Store `/vendors/apply` always creates vendors with `pending` status regardless of input
