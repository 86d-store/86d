# saved-addresses

Customer address book management. Stores shipping and billing addresses with default selection per customer.

## File structure

```
src/
  index.ts              Module factory + SavedAddressesOptions
  schema.ts             ModuleSchema (address entity)
  service.ts            Controller interface + types
  service-impl.ts       Controller implementation
  mdx.d.ts              MDX type declarations
  store/endpoints/      9 customer-facing endpoints
  store/components/     AddressBook (customer address management)
  admin/endpoints/      3 admin endpoints
  admin/components/     AddressOverview (admin address list + stats)
  __tests__/            52 tests (service-impl, endpoint-security)
```

## Data model

**address**: id, customerId, label?, firstName, lastName, company?, line1, line2?, city, state?, postalCode, country (ISO 2-letter), phone?, isDefault, isDefaultBilling, createdAt, updatedAt

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| maxAddresses | string | "20" | Max addresses per customer |

## Key patterns

- First address auto-becomes default shipping + billing
- Setting a new default clears previous default (per customer)
- Ownership verified on every operation — returns 404 (not 403) on mismatch
- No `findById` — uses `findMany` with `where: { id }` (mock compat)
- All user text inputs sanitized via `sanitizeText`
- Country field capped at 2 chars (ISO 3166-1 alpha-2)

## Events emitted

`address.created`, `address.updated`, `address.deleted`, `address.defaultChanged`

## Admin group

Customers
