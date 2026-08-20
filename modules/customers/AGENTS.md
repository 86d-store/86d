# Customers Module

Customer profile and address management. Supports authenticated customers viewing/editing their profile and addresses, plus admin access to all customers.

## Structure

```
src/
  identity-binding.ts  Verified auth identity -> Store Customer foundation
  index.ts          Factory: customers(options?) => Module
  schema.ts         Zod models: customer, customerAddress
  service.ts        CustomerController interface
  service-impl.ts   CustomerController implementation
  endpoints/
    store/          Customer-facing (requires session)
      get-me.ts             GET  /customers/me
      update-me.ts          PUT  /customers/me/update
      list-addresses.ts     GET  /customers/me/addresses
      create-address.ts     POST /customers/me/addresses/create
      update-address.ts     PUT  /customers/me/addresses/:id
      delete-address.ts     DELETE /customers/me/addresses/:id/delete
    admin/          Protected (store admin only)
      list-customers.ts     GET  /admin/customers
      get-customer.ts       GET  /admin/customers/:id
      update-customer.ts    PUT  /admin/customers/:id/update
      delete-customer.ts    DELETE /admin/customers/:id/delete
  __tests__/
    service-impl.test.ts    21 tests
```

## Options

```ts
CustomersOptions {
  autoCreateOnSignup?: boolean  // default true
}
```

## Data models

- **customer**: id, email, firstName, lastName, phone?, dateOfBirth?, metadata, createdAt, updatedAt
- **customerAddress**: id, customerId (FK), type (billing|shipping), firstName, lastName, company?, line1, line2?, city, state, postalCode, country (2-char ISO), phone?, isDefault, createdAt, updatedAt

## Exports (for inter-module contracts)

Types exported: `Customer`, `CustomerAddress`, `CustomerController`

`customers.identity.resolve@1.0.0` is the typed cross-Module path for mapping a
server-verified authentication principal to a Store-owned Customer. It stores a
digest of the raw authentication subject, never uses that subject as the
Customer ID, serializes identity and normalized-email claims with owner-local
row locks, and records the initial audit binding. Missing transactions or row
locking fail closed.

The identity service does not accept an Order ID, email-only claim, or guest
claim token. Guest Order/history attribution remains unavailable until Orders
provides a typed claim capability that verifies the scoped guest proof and
records idempotent claim audit.

The `/customers/me` profile and address endpoints resolve the active trusted
Better Auth session through this binding before every read or mutation. The
session ID supplies audit correlation, and an unverified email, missing
transaction, or missing row lock fails closed. Raw auth user IDs are not used as
Customer IDs on these routes.

Customers-owned loyalty endpoints are not registered. Loyalty remains the sole
active points authority; the old Customers controller methods and source files
are compatibility code only. Customers does not export loyalty admin or
Storefront components; loyalty presentation belongs to the Loyalty Module.

## Patterns

- All store endpoints require an authenticated session (`ctx.context.session?.user.id`)
- Address ownership verified before update/delete
- `setDefaultAddress` automatically clears previous defaults of same type
- `exactOptionalPropertyTypes` compatible: all optional params use `T | undefined`
- `findMany` uses `take` (not `limit`) for the options API
