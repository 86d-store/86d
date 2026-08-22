# Braintree Module

Braintree payment provider implementing the `PaymentProvider` interface from `@86d-app/payments`.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

```
src/
  index.ts              Factory: braintree(options) => Module + admin nav
  provider.ts           BraintreePaymentProvider class (Basic auth)
  connection-provider.ts  Contained PaymentConnectionProvider v2 GraphQL adapter
  mdx.d.ts              MDX module type declaration
  store/
    endpoints/
      index.ts          Store endpoint exports
      webhook.ts        POST /braintree/webhook — HMAC-SHA1 signature verification
  admin/
    endpoints/
      index.ts          Admin endpoint exports
      get-settings.ts   GET /admin/braintree/settings — masked credentials
    components/
      index.tsx         Component exports
      braintree-admin.tsx  "use client" admin dashboard
      braintree-admin.mdx  Admin page template
  __tests__/
    provider.test.ts          38 tests (transaction lifecycle, 11 status mappings, auth, sandbox)
    webhook.test.ts           15 tests (HMAC verification, XML parsing, event handling)
    endpoint-security.test.ts 22 tests (signature security, kind filtering, amount integrity)
    admin-settings.test.ts    22 tests (key masking, mode detection, 3-key config check)
    module-factory.test.ts    18 tests (module identity, options, admin pages, endpoints)
    connection-provider.test.ts  Durable envelope and reconciliation contracts
```

## Payment Connection v2

- `BraintreePaymentConnectionProvider` is bound to one immutable Connection ID.
- It begins with authorization and deliberately does not advertise `intent`; each authorization permits one capture.
- Currency routes through Connection-owned merchant-account mappings.
- Mutations forward the durable key as `apiRequestKey` and use stable operation IDs for reconciliation.
- Known `AUTHORIZING` responses persist as `pending`, retain the exact transaction, and do not advance the Payment aggregate.
- Shopper-facing 3D Secure/SCA continuation is not activated.
- The adapter is exported for migration and contract testing but is not registered by the module initializer.
- Durable webhook receipt/application is not implemented here; the registered webhook remains contained behind `503 PAYMENT_WEBHOOK_DURABILITY_REQUIRED`.

## Options

```ts
BraintreeOptions {
  merchantId: string      // Braintree merchant ID
  publicKey: string       // API public key
  privateKey: string      // API private key
  sandbox?: string        // "true" or "1" for sandbox
}
```

## API mapping

| Method | Braintree endpoint |
| --- | --- |
| createIntent | POST /merchants/{id}/transactions (submit_for_settlement: false) |
| confirmIntent | POST /merchants/{id}/transactions/{txId}/submit_for_settlement |
| cancelIntent | POST /merchants/{id}/transactions/{txId}/void |
| createRefund | POST /merchants/{id}/transactions/{txId}/refunds |

## Status mapping

| Braintree status | Provider status |
| --- | --- |
| settled | succeeded |
| voided | cancelled |
| submitted_for_settlement, settling, settlement_pending, settlement_confirmed | processing |
| failed, processor_declined, gateway_rejected, settlement_declined | failed |
| authorized | pending |

## Webhook

- HMAC-SHA1 signature verification with timing-safe comparison
- `bt_signature` format: `PUBLIC_KEY|HEX_HMAC_SHA1`
- XML payload (base64 encoded)
- The registered endpoint verifies every callback, then returns `503 PAYMENT_WEBHOOK_DURABILITY_REQUIRED` so Braintree retries; it does not mutate Payments or emit commerce events
- Missing verification configuration fails with `503`; invalid or missing signatures return `401`
- The legacy process-local XML event mapper remains in source for migration reference but is deliberately unregistered

## Patterns

- Requires `metadata.paymentMethodNonce` for createIntent (from client-side Braintree.js)
- Amounts: cents in PaymentProvider → decimal strings in Braintree API (formatAmount)
- Auth: Basic auth header (`publicKey:privateKey` base64-encoded)
- Sandbox URL: `api.sandbox.braintreegateway.com` vs `api.braintreegateway.com`
- `configured` requires all three keys (merchantId + publicKey + privateKey)
- Tests mock `globalThis.fetch` — no real Braintree calls
