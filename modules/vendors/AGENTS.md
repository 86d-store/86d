# Vendors Module

Multi-vendor marketplace support. Vendor profiles, product assignments, commission tracking, and payout management.

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

## Gotchas

- `exactOptionalPropertyTypes` is on — don't pass `undefined` for optional params, use conditional assignment
- All `data.upsert` calls need `biome-ignore lint/suspicious/noExplicitAny` comments
- Store `/vendors/apply` always creates vendors with `pending` status regardless of input
