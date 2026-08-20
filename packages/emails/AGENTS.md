# Emails

Transactional email templates and Resend client for the 86d platform.

## Structure

```
src/
  index.ts              Resend client instance (default export)
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

## Key exports

- Default export: `resend` — Resend client instance (reads `RESEND_API_KEY` from env)
- Each template is a separate export path (e.g., `emails/welcome`, `emails/order-confirmation`)

## Import paths

| Path | Export |
|---|---|
| `emails` | Resend client instance |
| `emails/<template-name>` | React component (default export) |

## Patterns

- All templates are React components using inline styles (no CSS-in-JS or external stylesheets)
- `BaseEmail` wraps every template with consistent header/footer and email preview text
- `styles.ts` provides shared style objects and helper functions (`formatCurrency`, `formatDate`)
- `formatCurrency` expects amounts in **cents** (divides by 100)
- Templates accept props like `storeName`, `orderNumber`, `items`, etc. — each is self-documenting
- 16 templates total covering orders, shipping, payments, subscriptions, reviews, and admin alerts

## Gotchas

- `RESEND_API_KEY` must be set in env for the client to work (no validation at import time)
- Templates use raw React elements, not JSX email libraries — compatible with `resend.emails.send()`
