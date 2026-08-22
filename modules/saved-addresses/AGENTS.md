# Saved Addresses Module

Customer address book management. Stores shipping and billing addresses with default selection per customer.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

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

## Patterns

- First address auto-becomes default shipping + billing
- Setting a new default clears previous default (per customer)
- Ownership verified on every operation — returns 404 (not 403) on mismatch
- No `findById` — uses `findMany` with `where: { id }` (mock compat)
- All user text inputs sanitized via `sanitizeText`
- Country field capped at 2 chars (ISO 3166-1 alpha-2)

## Events

`address.created`, `address.updated`, `address.deleted`, `address.defaultChanged`

## Admin group

Customers
