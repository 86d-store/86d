# Tax Module

Jurisdiction-based tax calculation engine with nexus management, transaction audit logging, compliance reporting, tax-inclusive pricing, categories, exemptions, compound rates, and rate stacking.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

```
src/
  index.ts          Factory: tax(options?) => Module
  schema.ts         Data models: taxRate, taxCategory, taxExemption, taxNexus, taxTransaction
  service.ts        TaxController interface + all type exports
  service-impl.ts   TaxController implementation + matchScore/applyRates helpers
  store/
    components/     Store-facing MDX + TSX (breakdown, estimate)
    endpoints/
      get-rates.ts        GET  /tax/rates
  admin/
    components/     Admin MDX + TSX (rates management, reporting)
    endpoints/
      list-rates.ts              GET  /admin/tax/rates
      create-rate.ts             POST /admin/tax/rates/create
      get-rate.ts                GET  /admin/tax/rates/:id
      update-rate.ts             POST /admin/tax/rates/:id/update
      delete-rate.ts             POST /admin/tax/rates/:id/delete
      list-categories.ts         GET  /admin/tax/categories
      create-category.ts         POST /admin/tax/categories/create
      delete-category.ts         POST /admin/tax/categories/:id/delete
      list-exemptions.ts         GET  /admin/tax/exemptions
      create-exemption.ts        POST /admin/tax/exemptions/create
      delete-exemption.ts        POST /admin/tax/exemptions/:id/delete
      list-nexus.ts              GET  /admin/tax/nexus
      create-nexus.ts            POST /admin/tax/nexus/create
      delete-nexus.ts            POST /admin/tax/nexus/:id/delete
      list-transactions.ts       GET  /admin/tax/transactions
      link-transaction.ts        POST /admin/tax/transactions/:id/link
      get-report.ts              GET  /admin/tax/report
```

## Options

```ts
TaxOptions {
  taxShipping?: boolean  // default false
}
```

## Data models

- **taxRate**: id, name, country, state, city, postalCode, rate (decimal), type (percentage|fixed), categoryId, enabled, priority, compound, inclusive
- **taxCategory**: id, name, description?
- **taxExemption**: id, customerId, type (full|category), categoryId?, taxIdNumber?, reason?, expiresAt?, enabled
- **taxNexus**: id, country, state, type (physical|economic|voluntary), enabled, notes?
- **taxTransaction**: id, orderId?, customerId?, country, state, city?, postalCode?, subtotal, shippingAmount, totalTax, shippingTax, effectiveRate, inclusive, exempt, lineDetails (json), rateNames (json)

## Patterns

- **Jurisdiction matching**: scoring system — country=1, +state=10, +city=100, +postal=1000. Higher score wins.
- **Category-specific rates** take precedence over "default" category rates.
- **Rate stacking**: same-priority rates are additive; compound rates apply to (base + prior tax).
- **Customer exemptions**: "full" exempts from all tax, "category" exempts from a specific category. Expired exemptions (expiresAt < now) are filtered at calculation time.
- **Nexus enforcement**: when taxNexus records exist, tax is only collected in jurisdictions where the store has nexus. When no nexus records exist, enforcement is off (tax collected everywhere).
- **Tax-inclusive pricing**: when a rate has `inclusive: true`, tax is extracted from the price (`tax = price - price/(1+rate)`) instead of added on top.
- **Transaction logging**: `logTransaction()` creates an immutable audit record. `linkTransactionToOrder()` associates a transaction with an order after checkout.
- **Reporting**: `getReport()` aggregates transactions by jurisdiction, returning totals, counts, and effective rates. Supports date range and jurisdiction filters.
- `roundCurrency()` uses banker's rounding to 2 decimal places.
- Shipping is taxed using "default" category rates when `shippingAmount > 0`.

## Events

Emits: `tax.rate_created`, `tax.rate_updated`, `tax.rate_deleted`, `tax.exemption_created`, `tax.exemption_deleted`, `tax.nexus_created`, `tax.nexus_deleted`, `tax.transaction_logged`

## Admin pages

- `/admin/tax` — Tax Rates (Finance group): manage rates, categories, exemptions
- `/admin/tax/reporting` — Tax Reporting (Finance group): summary report, transaction log, nexus management
