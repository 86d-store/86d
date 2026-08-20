# PayPal Integration

PayPal Third-party Payment Integration. The connection-bound adapter implements
the durable provider-neutral contract; the singleton provider remains migration
compatibility only.

## Structure

```
src/
  index.ts              Factory: paypal(options) => Module + admin nav
  connection-provider.ts PaymentConnectionProvider for one immutable Connection
  provider.ts           PayPalPaymentProvider class (OAuth2 + REST API)
  mdx.d.ts              MDX module type declaration
  store/
    endpoints/
      index.ts          Store endpoint exports
      webhook.ts        POST /paypal/webhook — PayPal signature verification via API
  admin/
    endpoints/
      index.ts          Admin endpoint exports
      get-settings.ts   GET /admin/paypal/settings — masked credentials
    components/
      index.tsx         Component exports
      paypal-admin.tsx  "use client" admin dashboard
      paypal-admin.mdx  Admin page template
  __tests__/
    provider.test.ts          25 tests (OAuth, intent lifecycle, status mapping, refunds)
    webhook.test.ts           15 tests (signature verification, event handling)
    endpoint-security.test.ts 27 tests (header validation, event filtering, refund integrity)
    admin-settings.test.ts    22 tests (key masking, mode detection, config status)
    module-factory.test.ts    18 tests (module identity, options, admin pages, endpoints)
```

## Options

```ts
PayPalOptions {
  clientId: string          // PayPal app client ID
  clientSecret: string      // PayPal app client secret
  sandbox?: string          // "true" or "1" for sandbox
  webhookId?: string        // Webhook ID for signature verification
}

PayPalPaymentConnectionProviderOptions {
  connectionId: string
  providerAccountId: string // server-provisioned immutable PayPal payer/merchant ID
  clientId: string
  clientSecret: string
  mode: "test" | "live"
  returnUrl: string       // trusted HTTPS Store callback
  cancelUrl: string       // trusted HTTPS Store callback
}
```

## Authentication

OAuth2 client credentials flow. Tokens cached with 60-second expiry buffer.

## Connection-bound API mapping

| Operation | PayPal endpoint |
|---|---|
| intent | POST /v2/checkout/orders (intent: AUTHORIZE) |
| authorization | POST /v2/checkout/orders/{orderId}/authorize |
| capture | POST /v2/payments/authorizations/{authorizationId}/capture |
| void | POST /v2/payments/authorizations/{authorizationId}/void, then GET |
| refund | POST /v2/payments/captures/{captureId}/refund |
| reconcile | canonical GET when an exact resource is known; bounded Create Order replay only inside documented retention |

The v2 adapter forwards the durable operation key unchanged as
`PayPal-Request-Id`, verifies the exact source provenance and returned money,
and never searches for a different order, authorization, capture, or
Connection. Equal partial refunds remain distinct through distinct caller
operation keys. It honors PayPal's HUF/JPY/TWD zero-digit currency exponents;
all other supported currencies use two digits. Shopper handoff recognizes the
current `payer-action` relation, and known payer/PENDING states remain
`requires_action`/`pending` rather than consuming the ambiguity budget.

The legacy `PayPalPaymentProvider` creates `CAPTURE` orders. It is not the
authorize/capture contract above and must not be used to activate Checkout.

## Status mapping

| PayPal status | Provider status |
|---|---|
| COMPLETED, APPROVED | succeeded when valid for the operation |
| PENDING | pending |
| CREATED/SAVED with payer link, PAYER_ACTION_REQUIRED | requires_action |
| CREATED/SAVED without payer link | pending |

## Webhook

- PayPal uses RSA signatures verified via REST API (not local crypto)
- Requires all 5 transmission headers or verification fails
- The registered endpoint verifies every callback, then returns `503 PAYMENT_WEBHOOK_DURABILITY_REQUIRED` so PayPal retries; it does not mutate Payments or emit commerce events
- Missing credentials or `webhookId` fail closed with `503`; missing, invalid, or unverifiable signatures return `401`
- The legacy process-local event mapper remains in source for migration reference but is deliberately unregistered

## Patterns

- Amounts: currency minor units in the provider interface → exponent-aware PayPal values
- Sandbox URL: `api-m.sandbox.paypal.com` vs `api-m.paypal.com`
- Admin endpoint masks credentials (first 7 chars visible)
- Tests use official-shape HTTP fixtures through `globalThis.fetch` — no sandbox
  or live PayPal calls, so the Integration remains below Stable
