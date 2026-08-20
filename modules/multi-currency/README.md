

# @86d-app/multi-currency

📚 **Documentation:** [86d.app/docs/modules/multi-currency](https://86d.app/docs/modules/multi-currency)

Multi-currency support for 86d commerce stores. Manage currencies, exchange rates, price conversions, and per-product price overrides.

## Installation

The module is included in the 86d monorepo. Enable it in your store's template `config.json`:

```json
{
  "modules": ["multi-currency"]
}
```

## Usage

```typescript
import multiCurrency from "@86d-app/multi-currency";

// Register with options
multiCurrency({
  baseCurrency: "USD",
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseCurrency` | `string` | `"USD"` | Default base currency ISO 4217 code |

## Store Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/currencies` | GET | List all active currencies |
| `/currencies/convert` | POST | Convert an amount between currencies |
| `/currencies/product-price` | POST | Get a product's price in a specific currency |

### Convert Price

```json
POST /currencies/convert
{
  "amount": 100,
  "to": "EUR",
  "from": "USD"  // optional, defaults to base currency
}
// Response: { "amount": 85, "formatted": "85,00EUR", "currency": "EUR" }
```

### Get Product Price

```json
POST /currencies/product-price
{
  "productId": "prod-123",
  "basePriceInCents": 9999,
  "currencyCode": "EUR"
}
// Response: { "amount": 8499, "formatted": "84,99EUR", "currency": "EUR" }
```

## Admin Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/currencies` | GET | List all currencies |
| `/admin/currencies/create` | POST | Create a new currency |
| `/admin/currencies/:id` | GET | Get currency by ID |
| `/admin/currencies/:id/update` | POST | Update a currency |
| `/admin/currencies/:id/delete` | POST | Delete a currency |
| `/admin/currencies/:id/set-base` | POST | Set as base currency |
| `/admin/currencies/update-rate` | POST | Update a single exchange rate |
| `/admin/currencies/bulk-update-rates` | POST | Update multiple exchange rates |
| `/admin/currencies/rate-history` | POST | Get exchange rate history |
| `/admin/currencies/price-override` | POST | Set a product price override |
| `/admin/currencies/price-overrides/:productId` | GET | List overrides for a product |
| `/admin/currencies/price-overrides/:id/delete` | POST | Delete a price override |

## Store Components

The module exports customer-facing components for MDX templates:

### CurrencySelector

Dropdown to switch the active currency. Hidden when only one currency is active.

```mdx
<CurrencySelector value={selectedCurrency} onChange={setCurrency} />
<CurrencySelector compact />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | — | Currently selected currency code (ISO 4217) |
| `onChange` | `(code: string) => void` | — | Called when user selects a different currency |
| `compact` | `boolean` | `false` | Show code only (no full name) |

### PriceDisplay

Show a price converted to the selected currency, with optional compare-at (sale) display.

```mdx
<PriceDisplay productId="prod-123" basePriceInCents={9999} currencyCode="EUR" />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `productId` | `string` | — | Product ID (used for price override lookup) |
| `basePriceInCents` | `number` | **required** | Base price in smallest currency unit |
| `currencyCode` | `string` | — | Target currency code |
| `compareAtPriceInCents` | `number` | — | Compare-at price for sale display |
| `className` | `string` | — | Additional CSS class |

## Admin UI

The module includes admin UI components in `src/admin/components/index.tsx` (client components using `useModuleClient`):

| Page | Component | Description |
|------|-----------|-------------|
| `/admin/currencies` | `CurrencyList` | Currency list with exchange rates and status indicators |
| `/admin/currencies/new` | `CurrencyForm` | Create a new currency |
| `/admin/currencies/:id` | `CurrencyDetail` | Currency detail with rate history and price overrides |
| `/admin/currencies/:id/edit` | `CurrencyForm` | Edit an existing currency |

## Controller API

Access via `ctx.context.controllers.multiCurrency`:

### Currency Management

- `create(params)` — Create a currency (code is auto-uppercased)
- `getById(id)` / `getByCode(code)` — Lookup
- `update(id, params)` — Update currency details
- `delete(id)` — Delete (cannot delete base currency)
- `list({ activeOnly? })` — List currencies sorted by `sortOrder`

### Base Currency

- `getBaseCurrency()` — Get the store's base currency
- `setBaseCurrency(id)` — Set a new base currency (unsets previous)

### Exchange Rates

- `updateRate({ currencyCode, rate, source? })` — Update rate and record history
- `bulkUpdateRates(rates[])` — Update multiple rates at once
- `getRateHistory({ currencyCode, limit? })` — Get historical rates

### Price Conversion

- `convert({ amount, to, from? })` — Convert between currencies
- `formatPrice(amount, currencyCode)` — Format with locale settings
- `getProductPrice({ productId, basePriceInCents, currencyCode })` — Resolve best price

### Price Overrides

- `setPriceOverride({ productId, currencyCode, price, compareAtPrice? })` — Set fixed price
- `getPriceOverride(productId, currencyCode)` — Get override
- `listPriceOverrides(productId)` — List all overrides for a product
- `deletePriceOverride(id)` — Remove an override

## Types

```typescript
interface Currency {
  id: string;
  code: string;          // ISO 4217 (e.g., "USD")
  name: string;          // Display name
  symbol: string;        // Currency symbol
  decimalPlaces: number; // 0 for JPY, 2 for USD
  exchangeRate: number;  // Relative to base (base = 1)
  isBase: boolean;
  isActive: boolean;
  symbolPosition: "before" | "after";
  thousandsSeparator: string;
  decimalSeparator: string;
  roundingMode: "round" | "ceil" | "floor";
  sortOrder: number;
}

interface PriceOverride {
  id: string;
  productId: string;
  currencyCode: string;
  price: number;           // In smallest unit (cents)
  compareAtPrice?: number;
}

interface ConvertedPrice {
  amount: number;
  currency: Currency;
  formatted: string;
}
```

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `currency.created` | `{ id, code }` | New currency added |
| `currency.updated` | `{ id, code }` | Currency details changed |
| `currency.deleted` | `{ id, code }` | Currency removed |
| `currency.baseChanged` | `{ id, code }` | Base currency switched |
| `currency.rateUpdated` | `{ code, oldRate, newRate, source }` | Exchange rate changed |

## Notes

- Only one base currency per store. Base rate is always 1.
- Cross-currency conversion goes through the base rate (EUR -> USD -> GBP).
- Price overrides take priority over automatic conversion.
- Zero-decimal currencies (JPY, KRW) are fully supported via `decimalPlaces: 0`.
- Exchange rate history is recorded automatically on every rate update.
