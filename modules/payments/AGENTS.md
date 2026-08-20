# payments module

Provider-neutral payment ownership. The legacy v1 controller tracks payment intents, saved payment methods, and refunds. The additive v2 boundary owns named Payment Connections and durable connection-bound provider operations without exposing live shopper routes.

## File structure

```
src/
  index.ts              Module definition, PaymentsOptions
  schema.ts             legacy entities plus v2 Payment/Connection/operation/receipt records
  payment-service.ts     Store-owned Payment v2 aggregate and dispute projection
  connection-service.ts Named Connection lifecycle and durable operation service
  webhook-receipt-service.ts Durable post-verification provider ingress
  service.ts            PaymentController, PaymentProvider, type definitions
  service-impl.ts       createPaymentController(data, provider?) factory
  store/endpoints/      saved-method endpoints; generic intent routes contained
  admin/endpoints/      4 admin endpoints
  admin/components/     PaymentsAdmin UI (intents table, refund modal)
  __tests__/
    service-impl.test.ts      Core CRUD (47 tests)
    controllers.test.ts       Edge cases (65 tests)
    edge-cases.test.ts        Provider, webhook, filter edge cases (32 tests)
    endpoint-security.test.ts Security regressions (26 tests)
    financial-safety.test.ts  Amount validation, status guards, refund cap, webhook dedup (35 tests)
```

## Key patterns

- **Payment Connection v2**: Store-scoped, named, immutable identity with provider, server-provisioned upstream provider account ID, mode, capabilities, health, lifecycle, and an opaque server-only secret reference. The host must verify that its credential authorizes that account before binding the adapter.
- **Explicit routing**: A v2 adapter is bound to exactly one `connectionId`; no default provider or provider fallback exists in the v2 service.
- **Operation identity**: Every provider operation persists its immutable Connection, operation-specific idempotency key (8-108 characters), immutable creation time, request digest, attempt history, provider reference, and final or nonfinal state before and after the external call.
- **Payment authority**: Payment v2 freezes Checkout/Order references, Connection, option, accepted amount/currency, and fee basis; it alone applies confirmed totals and emits the outbox fact.
- **Reversal routing**: Capture, refund, and void must cite a succeeded source operation and its provider reference, so they retain the original Connection.
- **Financial ceilings**: Owner-local locks serialize confirmed plus in-flight authorization, capture, void, and refund totals. Different keys cannot bypass the accepted or exact-source ceilings.
- **Recovery**: Provider-known `pending`/`requires_action` work uses longer state-specific polling and preserves provider truth when that budget ends; stale/ambiguous work uses short bounded backoff and dead-letter state. All paths support audited manual reconciliation without changing Connection or payload.
- **Webhook ingress**: The receipt controller accepts only already-verified normalized facts, binds Store/Connection/provider/event identity, rejects digest conflicts, and replays through the Payment owner. Raw provider payloads are not stored.
- **Containment**: v2 has owner-local production exports only. It is not registered as a shopper endpoint or as the legacy Checkout payment capability. Saved-method routes and the legacy Admin refund route also return explicit v2-required errors.
- **Transactions**: Connection and operation writes fail closed unless the host supplies an owner-local locking transaction runner.

Legacy v1 migration behavior follows:

- **Amount**: Always in smallest currency unit (cents). Must be a positive integer at controller level.
- **Status machine**: `pending → processing → succeeded → refunded`. Terminal states: `cancelled`, `failed`, `refunded`.
- **Status guards**: `confirmIntent` only from pending/processing. `cancelIntent` only from pending/processing. `createRefund` only from succeeded/refunded.
- **Refund cap**: Cumulative non-failed refunds cannot exceed original intent amount. Controller calculates `totalRefunded()` before each refund.
- **Webhook dedup**: `handleWebhookRefund` deduplicates by `providerRefundId` — retries return the existing refund.
- **Default payment method**: Only one per customer. `savePaymentMethod(isDefault: true)` clears previous defaults.
- **Ownership**: Controller has no ownership checks — endpoints must verify `session.user.id === intent.customerId`.
- **Provider delegation**: A manually configured legacy provider can still serve v1 internal consumers during migration. Missing provider fails closed for confirmation and refund outside explicit non-production development mode.

## Data models

- **paymentConnection**: id, unique normalized name, provider, mode, capabilities, health, lifecycle, opaque secret reference, lifecycle timestamps
- **paymentV2**: immutable accepted identity and fee basis, confirmed totals, exact provider references, dispute projection, lifecycle and revisions
- **paymentOperationV2**: payment and source references, immutable connectionId, operation-specific idempotency key, request digest, attempt, provider reference, outcome, ambiguous/needs-attention state
- **paymentOperationAttemptV2**: immutable per-call attempt history
- **paymentWebhookReceiptV2**: verified event identity/digest, normalized fact, processing lease/attempts, final disposition

- **paymentIntent**: id, providerIntentId?, customerId?, email?, amount, currency, status, orderId?, checkoutSessionId?, metadata, providerMetadata, timestamps
- **paymentMethod**: id, customerId, providerMethodId, type, last4?, brand?, expiryMonth?, expiryYear?, isDefault, timestamps
- **refund**: id, paymentIntentId, providerRefundId, amount, reason?, status (pending|succeeded|failed), timestamps

## Events emitted

`payment.completed`, `payment.failed`, `payment.refunded`

## Gotchas

- Endpoint validates `amount` as `z.number().int().positive()` — controller also validates (defense in depth).
- `createRefund` throws on non-existent intent, wrong status, exceeded cap, or missing provider. Endpoints should catch and return structured errors.
- `handleWebhookEvent` has no status guards — it trusts the provider (Stripe can set any status). `handleWebhookRefund` deduplicates but doesn't cap amounts (provider-side refunds are authoritative).
- The legacy Admin refund handler remains in source for migration reference but is unregistered; the registered path requires a durable original-Connection-bound v2 operation.

## Tests (205 total)

Run: `bun test` from this directory. All 5 test files cover: CRUD, status guards, refund cap, webhook dedup, provider delegation, customer isolation, pagination.
