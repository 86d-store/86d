# Emails

Transactional email templates and send client for the Store Runtime.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide and this file. Merchant-reachable email copy follows parent product language (supplier invisibility).
2. **Implement** using the local patterns below.
3. **Verify.** Focused package tests while iterating. Full pre-commit gates live in the parent guide. After `modules/` changes, prove `bun run generate:modules -- --frozen` from repo root.
   - Done when every required parent gate for the _slice_ is _green_.

## Structure

```
src/
  index.ts              Send client instance (default export)
  templates/
    base.tsx            BaseEmail layout wrapper (header, body, footer)
    styles.ts           Shared inline CSS styles, formatCurrency, formatDate
    welcome.tsx         Welcome email
    order-confirmation.tsx
    order-completed.tsx
    order-cancelled.tsx
    shipping-notification.tsx
    delivery-confirmation.tsx
    payment-failed.tsx
    refund-processed.tsx
    return-approved.tsx
    review-request.tsx
    contact.tsx
    low-stock-alert.tsx
    back-in-stock.tsx
    subscription-complete.tsx
    subscription-cancel.tsx
    subscription-update.tsx
```

## Exports and import paths

| Path | Export |
|---|---|
| `emails` | Send client instance (reads `RESEND_API_KEY` from env) |
| `emails/<template-name>` | React component (default export) |

## Patterns

- Templates are React components with inline styles (no CSS-in-JS or external stylesheets)
- `BaseEmail` wraps every template with consistent header/footer and preview text
- `styles.ts` shared style objects plus `formatCurrency` / `formatDate`
- `formatCurrency` expects amounts in **cents** (divides by 100)
- Template props (`storeName`, `orderNumber`, `items`, …) are self-documenting per file
- Sixteen templates cover orders, shipping, payments, subscriptions, reviews, and admin alerts

## Gotchas

- `RESEND_API_KEY` must be set for the client to work (no validation at import time)
- Templates use raw React elements compatible with the send client's `emails.send()` API — not a separate JSX email framework
