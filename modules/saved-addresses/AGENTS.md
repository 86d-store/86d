# Saved Addresses Module

Customer address book management. Stores shipping and billing addresses with default selection per customer.

**Scope:** This guide owns Module-specific mechanics. In the 86d.store source checkout, read the repository root [`AGENTS.md`](../../AGENTS.md) for shared rules and gates. In another project, follow that project's instructions and the installed `@86d-store/core` contracts.

## Change protocol

1. **Route.** Read this guide and the Module's [`README.md`](./README.md). In the 86d.store source checkout, storage or cross-Module changes also follow the root [Module contracts](../../AGENTS.md#module-contracts) routes.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** In the 86d.store source checkout, run `bun run generate:modules` after a Module change, then `bun run generate:modules -- --frozen` and the parent gates. In another project, use that project's checks. Run the Module's focused tests when available.
   - Done when the current project's required checks pass; source-checkout work also requires a passing frozen registry check.

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
