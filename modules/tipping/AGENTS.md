# Tipping Module

Order tipping with preset/custom amounts, tip splitting, payouts, and configurable settings.

## Structure

```
src/
  index.ts          Factory: tipping(options?) => Module + admin nav (Sales)
  schema.ts         Zod models: tip, tipPayout, tipSettings
  service.ts        TippingController interface
  service-impl.ts   TippingController implementation
  store/endpoints/  add-tip, update-tip, remove-tip, get-order-tips, get-settings
  admin/endpoints/  list-tips, get-tip, split-tip, create-payout, list-payouts, stats, get-settings, update-settings
  admin/components/ tipping-admin.mdx, tipping-admin.tsx, tip-payouts.mdx, tip-payouts.tsx, index.tsx
  __tests__/        controllers (45), endpoint-security (4), events (5)
```

## Options

```ts
interface TippingOptions extends ModuleConfig {
  defaultPercents?: string;      // default: "15,18,20,25"
  allowCustomAmount?: string;    // default: "true"
  maxTipPercent?: string;        // default: "100"
  enableTipSplitting?: string;   // default: "false"
}
```

## Data models

- **Tip** — id, orderId, amount, percentage, type (preset|custom), recipientType (driver|server|staff|store), recipientId, customerId, status (pending|paid|refunded), paidAt, metadata, timestamps
- **TipPayout** — id, recipientId, recipientType, amount, tipCount, periodStart, periodEnd, status (pending|processing|paid|failed), paidAt, reference, timestamps
- **TipSettings** — id (singleton "default"), presetPercents[], allowCustom, maxPercent, maxAmount, enableSplitting, defaultRecipientType, updatedAt

## Patterns

- Settings use singleton ID "default"; `getSettings()` auto-creates with defaults if missing
- `splitTip` deletes original tip, creates N new tips with `metadata.splitFrom` referencing original ID
- `getTipTotal` sums non-refunded tips for an order
- `updateTip` auto-sets `paidAt` when status changes to "paid"
- Events: tip.added, tip.updated, tip.removed, tip.split, tip.payout.created
- Exports: tipTotal, tipSettings
- Controller does NOT receive events emitter (only `data`), unlike most modules
