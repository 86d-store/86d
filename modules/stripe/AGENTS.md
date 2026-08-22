# Stripe Module

Stripe payment provider for @86d-app/payments. Implements the `PaymentProvider` interface using raw fetch to Stripe's REST API — no Stripe SDK required.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

```
src/
  index.ts              Factory: stripe(options) => Module + admin nav
  provider.ts           StripePaymentProvider class (PaymentProvider interface)
  connection-provider.ts  Contained PaymentConnectionProvider v2 adapter
  mdx.d.ts              MDX module type declaration
  store/
    endpoints/
      index.ts          Store endpoint exports
      webhook.ts        POST /stripe/webhook — HMAC-SHA256 signature verification
  admin/
    endpoints/
      index.ts          Admin endpoint exports
      get-settings.ts   GET /admin/stripe/settings — masked credentials
    components/
      index.tsx         Component exports
      stripe-admin.tsx  "use client" admin dashboard
      stripe-admin.mdx  Admin page template
  __tests__/
    provider.test.ts          20 tests (provider methods, status mapping, error handling)
    webhook.test.ts           16 tests (signature verification, event handling, domain events)
    endpoint-security.test.ts 27 tests (replay protection, payload safety, refund extraction)
    admin-settings.test.ts    20 tests (key masking, mode detection, config status)
    module-factory.test.ts    12 tests (module identity, options, admin pages, endpoints)
    connection-provider.test.ts  Durable envelope and reconciliation contracts
```

## Payment Connection v2

- `StripePaymentConnectionProvider` is bound to one immutable Connection ID.
- It uses manual authorization and one final capture per authorization.
- Every mutation forwards the durable operation idempotency key unchanged.
- Reconciliation is read-only and uses exact provider references or exact operation metadata.
- Known processing and SCA responses persist as `pending` and `requires_action`; they are not unknown outcomes and never advance the Payment aggregate.
- No safe shopper SCA continuation transport is activated, so `requires_action` remains contained for manual attention.
- The adapter is exported for migration and contract testing but is not registered by the module initializer.
- Durable webhook receipt/application is not implemented here; the registered webhook remains contained behind `503 PAYMENT_WEBHOOK_DURABILITY_REQUIRED`.

## Options

```ts
StripeOptions {
  apiKey: string            // sk_live_... or sk_test_...
  webhookSecret?: string    // whsec_... for signature verification
}
```

## Status mapping

| Stripe status | Provider status |
|---|---|
| succeeded | succeeded |
| canceled | cancelled |
| processing, requires_capture | processing |
| requires_payment_method, requires_confirmation, requires_action | pending |

## Webhook

- Signature: HMAC-SHA256 via Web Crypto API, timing-safe comparison
- Replay protection: 5-minute timestamp tolerance
- The registered endpoint verifies every callback, then returns `503 PAYMENT_WEBHOOK_DURABILITY_REQUIRED` so Stripe retries; it does not mutate Payments or emit commerce events
- The legacy process-local event mapper remains in source for migration reference but is deliberately unregistered

## Patterns

- Without `webhookSecret` the endpoint fails closed with `503`; invalid or expired signatures return `401`
- Admin endpoint masks API keys (first 7 chars visible)
- Admin detects key mode: `sk_live_` → "live", `sk_test_` → "test"
- Tests mock `globalThis.fetch` — no real Stripe calls
