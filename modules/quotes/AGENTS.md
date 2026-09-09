# Quotes Module

B2B request-for-quote (RFQ) module. Customers create quotes with line items, submit for review, and negotiate pricing with admin before converting to orders.

**Scope:** This guide owns Module-specific mechanics. In the 86d.store source checkout, read the repository root [`AGENTS.md`](../../AGENTS.md) for shared rules and gates. In another project, follow that project's instructions and the installed `@86d-app/core` contracts.

## Change protocol

1. **Route.** Read this guide and the Module's [`README.md`](./README.md). In the 86d.store source checkout, storage or cross-Module changes also follow the root [Module contracts](../../AGENTS.md#module-contracts) routes.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** In the 86d.store source checkout, run `bun run generate:modules` after a Module change, then `bun run generate:modules -- --frozen` and the parent gates. In another project, use that project's checks. Run the Module's focused tests when available.
   - Done when the current project's required checks pass; source-checkout work also requires a passing frozen registry check.

## Structure

```
src/
  index.ts              Factory, types, admin pages
  schema.ts             4 entities (quote, quoteItem, quoteComment, quoteHistory)
  service.ts            Types + QuoteController interface
  service-impl.ts       Controller implementation
  store/endpoints/      10 customer-facing endpoints
  store/components/     Customer-facing components
    _hooks.ts           API hooks (useQuotesApi)
    _utils.ts           Shared utilities
    index.tsx           Component exports
    *.tsx               Component logic
    *.mdx               Component templates
  admin/endpoints/      10 admin endpoints
  __tests__/            54 tests
```

## Data model

| Entity | Key fields |
|--------|-----------|
| quote | customerId, customerEmail, customerName, companyName, status, subtotal, discount, total, expiresAt, convertedOrderId |
| quoteItem | quoteId (FK), productId, productName, sku, quantity, unitPrice, offeredPrice |
| quoteComment | quoteId (FK), authorType (customer/admin), authorId, authorName, message |
| quoteHistory | quoteId (FK), fromStatus, toStatus, changedBy, reason |

## Status flow

```
draft → submitted → under_review → countered → accepted → converted
                  ↘                ↗           ↘
                   countered ─────┘             rejected
                                  ↘
                                   expired
```

- `draft`: Customer building quote, can add/update/remove items
- `submitted`: Awaiting admin review (requires at least 1 item)
- `under_review`: Admin actively reviewing
- `countered`: Admin set offered prices + expiration, awaiting customer
- `accepted`: Customer accepted counter-offer
- `rejected`: Admin or customer rejected (terminal)
- `expired`: Counter-offer expired (terminal)
- `converted`: Linked to an order via convertedOrderId (terminal)

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| defaultExpirationDays | number | 30 | Days until counter-offer expires |

## Patterns

- Items can only be added/updated/removed in `draft` status
- Submit requires at least 1 item
- Counter-offer applies `offeredPrice` per item; totals use offered price when set, else unitPrice
- `approveAsIs` accepts customer pricing without changes (transitions to `countered`)
- `acceptQuote` only works from `countered` status
- `rejectQuote` (admin) works from any non-terminal status
- `declineQuote` (customer) only works from `countered` status
- All status changes recorded in quoteHistory with changedBy + optional reason
- Expired quotes cannot be accepted

## Caveats

- `exactOptionalPropertyTypes` is on — use `| undefined` on all optional interface fields
- QuoteController extends ModuleController (required for endpoint cast)
- findMany skip/take must not be passed as undefined — use conditional query building
