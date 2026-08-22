# Multi-Currency Module

Manages multiple currencies, exchange rates, price conversions, and per-product price overrides for international commerce.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

```
src/
  index.ts              Module factory (id: "multi-currency")
  schema.ts             Data models: currency, exchangeRateHistory, priceOverride
  service.ts            Controller interface + types
  service-impl.ts       Controller implementation
  store/endpoints/      Public endpoints (3)
  store/components/
    index.tsx             Store UI exports (CurrencySelector, PriceDisplay) — "use client"
    _hooks.ts             useCurrencyApi() hook
    currency-selector.tsx Currency dropdown for switching active currency
    currency-selector.mdx Presentation template
    price-display.tsx     Show price in selected currency with compare-at support
    price-display.mdx     Presentation template
  admin/endpoints/      Protected admin endpoints (12)
  admin/components/
    index.tsx             Admin UI (CurrencyList, CurrencyForm, CurrencyDetail) — "use client"
  __tests__/            62 unit tests
```

## Data models

### currency
- `code` (string, unique) — ISO 4217 code, always uppercase
- `name`, `symbol` — display fields
- `decimalPlaces` (default 2) — 0 for JPY, 2 for USD/EUR, etc.
- `exchangeRate` — relative to the base currency (base always = 1)
- `isBase` — only one currency can be the base at a time
- `isActive` — controls visibility in store endpoints
- `symbolPosition` — "before" ($100) or "after" (100EUR)
- `thousandsSeparator`, `decimalSeparator` — formatting
- `roundingMode` — "round" | "ceil" | "floor" for conversions

### exchangeRateHistory
- `currencyCode`, `rate`, `source`, `recordedAt`
- Automatically recorded on every `updateRate()` call

### priceOverride
- `productId`, `currencyCode`, `price`, `compareAtPrice`
- Fixed price in a specific currency, bypasses conversion

## Controller: `multiCurrency`

Key methods:
- `create/getById/getByCode/update/delete/list` — currency CRUD
- `getBaseCurrency/setBaseCurrency` — manage base currency
- `updateRate/bulkUpdateRates/getRateHistory` — exchange rate management
- `convert({ amount, to, from? })` — currency conversion (from defaults to base)
- `formatPrice(amount, currencyCode)` — locale-aware formatting
- `setPriceOverride/getPriceOverride/listPriceOverrides/deletePriceOverride` — fixed prices
- `getProductPrice({ productId, basePriceInCents, currencyCode })` — resolves override or converts

## Patterns

- Currency codes are always stored/queried as uppercase
- Setting a new base currency automatically unsets the previous base and sets rate to 1
- Cannot delete the base currency
- Deleting a currency cascades to its price overrides and rate history
- `getProductPrice` checks for a price override first, falls back to conversion from base
- Rate updates emit `currency.rateUpdated` with old/new rates

## Options

```typescript
interface MultiCurrencyOptions {
  baseCurrency?: string; // Default: "USD"
}
```

## Caveats

- Base currency rate is always 1 — `updateRate` on the base currency is a no-op
- Cross-currency conversion (non-base to non-base) goes through the base rate
- Floating-point precision: use `roundingMode` to control rounding behavior
- Price overrides store amounts in the currency's smallest unit (cents)
