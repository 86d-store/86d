# Discounts Module

Discount and promo code management. Supports percentage, fixed-amount, and free-shipping discount types with optional applies-to filters (all, products, categories). Standalone — no dependencies on other modules.

## Structure

```
src/
  index.ts          Factory: discounts(options?) => Module
  schema.ts         Zod models: discount, discountCode
  service.ts        DiscountController interface + types
  service-impl.ts   DiscountController implementation
  endpoints/
    store/          Customer-facing
      validate-code.ts      POST /discounts/validate
    admin/          Protected (store admin only)
      list-discounts.ts     GET  /admin/discounts
      create-discount.ts    POST /admin/discounts/create
      get-discount.ts       GET  /admin/discounts/:id  (returns discount + codes)
      update-discount.ts    PUT  /admin/discounts/:id/update
      delete-discount.ts    DELETE /admin/discounts/:id/delete
      create-code.ts        POST /admin/discounts/:id/codes
      delete-code.ts        DELETE /admin/discounts/codes/:id/delete
  __tests__/
    service-impl.test.ts    28 tests
```

## Data models

- **discount**: id, name, type, value, minimumAmount?, maximumUses?, usedCount, isActive, startsAt?, endsAt?, appliesTo (all|products|categories), appliesToIds?, stackable, createdAt, updatedAt
- **discountCode**: id, discountId (FK), code (unique, uppercased), usedCount, maximumUses?, isActive, createdAt, updatedAt

## Discount types

| type | value | behaviour |
|---|---|---|
| `percentage` | 0–100 | `subtotal * value / 100` |
| `fixed_amount` | cents | `min(value, subtotal)` |
| `free_shipping` | 0 | returns `freeShipping: true` |

## Exports (for inter-module contracts)

Types exported: `Discount`, `DiscountCode`, `DiscountController`, `DiscountType`, `DiscountAppliesTo`, `ApplyResult`

## Patterns

- Discount codes stored/queried as `toUpperCase().trim()` — case-insensitive matching
- `validateCode`: checks code active, usage limit, discount active, minimum amount, applies-to filter — does NOT increment counters
- `applyCode`: calls `validateCode` then increments both `discountCode.usedCount` and `discount.usedCount`
- `delete(id)` cascades: removes all codes first, then removes discount
- `exactOptionalPropertyTypes` compatible: all optional params use `T | undefined`
- `findMany` uses `take` (not `limit`) for the options API
