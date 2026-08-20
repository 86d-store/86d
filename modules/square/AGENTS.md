# Square Module

Square payment provider implementing the `PaymentProvider` interface from `@86d-app/payments`.

## Structure

```
src/
  index.ts              Factory: square(options) => Module + admin nav
  provider.ts           SquarePaymentProvider class (Bearer token auth)
  mdx.d.ts              MDX module type declaration
  store/
    endpoints/
      index.ts          Store endpoint exports
      webhook.ts        POST /square/webhook — HMAC-SHA256 signature verification
  admin/
    endpoints/
      index.ts          Admin endpoint exports
      get-settings.ts   GET /admin/square/settings — masked credentials
    components/
      index.tsx         Component exports
      square-admin.tsx  "use client" admin dashboard
      square-admin.mdx  Admin page template
  __tests__/
    provider.test.ts          23 tests (payment lifecycle, status mapping, idempotency)
    webhook.test.ts           13 tests (signature verification, event handling)
    endpoint-security.test.ts 25 tests (payload safety, provider auth, idempotency keys)
    admin-settings.test.ts    18 tests (key masking, webhook config, URL handling)
    module-factory.test.ts    11 tests (module identity, options, admin pages, endpoints)
```

## Options

```ts
SquareOptions {
  accessToken: string              // Square access token
  webhookSignatureKey?: string     // HMAC key for webhook verification
  webhookNotificationUrl?: string  // URL for signature verification
}
```

## API Mapping

| Method | Square endpoint |
|---|---|
| createIntent | POST /v2/payments (autocomplete: false, source_id: EXTERNAL) |
| confirmIntent | POST /v2/payments/{id}/complete |
| cancelIntent | POST /v2/payments/{id}/cancel |
| createRefund | POST /v2/refunds |

## Status mapping

| Square status | Provider status |
|---|---|
| COMPLETED | succeeded |
| CANCELED | cancelled |
| FAILED | failed |
| APPROVED, PENDING | pending |

| Refund status | Provider status |
|---|---|
| COMPLETED | succeeded |
| FAILED, REJECTED | failed |
| PENDING | pending |

## Webhook

- HMAC-SHA256 signature verification requires both the configured key and exact notification URL
- Timing-safe comparison prevents timing attacks
- The registered endpoint verifies every callback, then returns `503 PAYMENT_WEBHOOK_DURABILITY_REQUIRED` so Square retries; it does not mutate Payments or emit commerce events
- Missing verification configuration fails with `503`; invalid or missing signatures return `401`
- The legacy process-local event mapper remains in source for migration reference but is deliberately unregistered

## Patterns

- Every createIntent/createRefund generates unique idempotency_key via crypto.randomUUID()
- Amounts stay in cents (matches Square API)
- Square-Version header: 2024-01-18
- Admin endpoint masks tokens (first 7 chars visible)
- Tests mock `globalThis.fetch` — no real Square calls
