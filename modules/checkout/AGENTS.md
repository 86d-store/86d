# Checkout Module

Checkout session management: cart-to-order conversion flow. Handles session creation, address collection, discount application, payment coordination, and authoritative Order creation. It has customer-facing endpoints plus bounded Store Admin maintenance endpoints.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

```
src/
  checkout-request.ts  Dormant non-binding Checkout Request aggregate foundation
  finalization.ts      Dormant durable Finalization ledger and lifecycle fact
  index.ts          Factory and accepted capability metadata
  schema.ts         Zod models: checkoutSession, checkoutLineItem
  service.ts        Checkout-owned controller and types
  service-impl.ts   Checkout-owned controller implementation
  store/endpoints/  Customer-facing Checkout HTTP surface
  admin/endpoints/  Store Admin inspection; stale-session expiry is contained
  __tests__/        Service, endpoint, containment, and capability integration tests
```

## Options

```ts
CheckoutOptions {
  sessionTtl?: number   // default 1800000 (30 minutes)
  currency?: string     // default "USD"
}
```

## Data models

- **checkoutSession**: id, revision, cartId?, customerId?, guestEmail?, status, subtotal, taxAmount, shippingAmount, discountAmount, total, currency, discountCode?, shippingAddress (JSON)?, billingAddress (JSON)?, paymentMethod?, orderId?, metadata, expiresAt, createdAt, updatedAt
- **checkoutLineItem**: productId, variantId?, name, sku?, price, quantity — stored with composite key `{sessionId}_{productId}[_{variantId}]`

## Session statuses

`pending → processing → completed`
`pending → expired` (owner-local controller compatibility only)
`pending/processing → abandoned`

## Capability boundary

Product and variant resolution plus Order creation are required capabilities. Inventory, Tax, Shipping, Discount, Store Credit, Payment, Price List, and currency conversion are explicit optional integrations whose call sites return bounded unavailability or domain failures. Checkout never receives another Module's data service or controller. Gift-card application is withdrawn from routes, `CheckoutController`, and session creation until one Workflow can coordinate the discount, debit, Payment, and Order; stored legacy fields remain readable and only removal remains for recovery.

The unregistered Finalization handlers also stop with `GIFT_CARD_WORKFLOW_REQUIRED` before invoking capabilities, creating an Order, or completing a Checkout whenever a legacy gift-card code or nonzero amount is stored.

M0 activation containment remains in force: confirm, payment, capture, payment-status, and completion routes return `CHECKOUT_ACTIVATION_UNAVAILABLE`. The consumer operation grants cover only currently reachable decisions (`check`/`release`, discount and store-credit validation/balance reads, and payment cancellation); duplicate-sensitive gift-card application/redeem, commit, debit, reserve, deduct, create, get, and confirm operations are not granted to Checkout.

The Store Admin expiry route also fails with `CHECKOUT_EXPIRY_WORKFLOW_REQUIRED`. Expiring a session cannot be activated until reservation release and Payment cancellation/reconciliation are a durable, idempotent workflow.

Session creation accepts a Cart identity and resolves an owner-authorized, versioned Cart snapshot before re-resolving Product/Variant prices. Guest access uses a high-entropy proof held in an httpOnly cookie; a Checkout UUID alone is not authorization. The accepted-offer/finalizer path is still unavailable, so this must not be described as activated commerce completion.

Every shopper mutation requires the session's current `expectedRevision`. Checkout locks the owner-local session row, compares that token, and increments `revision` in the same transaction. A stale token returns `CHECKOUT_REVISION_CONFLICT`; unavailable row locking fails closed.

## Checkout Requests

`createCheckoutRequestStore()` is an exported, owner-local foundation for an explicitly non-binding Checkout Request. Creation is deterministic and idempotent by operation key plus a canonical request digest. The aggregate stores a sanitized contact, failure reason, immutable Cart snapshot identity and line choices, 30-day expiry, invitation state, and audit actor.

`POST /checkout/requests` resolves the caller-owned active Cart snapshot and accepts only a reason, contact, Cart ID, and operation key. `GET /checkout/requests/:id` requires the same authenticated owner or a request-scoped high-entropy guest proof in a secure httpOnly cookie. The guest owner and proof are stored only as digests and are omitted from responses. Creation and reads require owner-local row-locking transactions and fail closed when that contract is unavailable. Creation is subject to the Store edge's strict sensitive-path rate limiter.

There is deliberately no invitation transition transport yet. Marking a request invited or reminded before a durable notification workflow proves the send would be false success. The persisted invitation state remains `not_invited` until that workflow exists.

The strict request input has no place for Payment credentials, totals, prices, final Tax or Shipping decisions, an Order reference, or an Inventory promise. A future activation workflow must calculate a fresh Checkout and obtain explicit shopper acceptance before an invitation can produce commerce state.

Checkout session containment remains separate: create/update reject Shipping addresses and caller Shipping/Payment selections until revision-bound Tax v2 and accepted-offer integration exists; rate lookup returns `CHECKOUT_SHIPPING_QUOTE_V2_REQUIRED`; confirmation success requires server verification.

## Checkout Finalization foundation

`createCheckoutFinalizationStore()` is an additive, unregistered Checkout-owned ledger. Its stable identity is derived from Checkout plus operation key. Admission locks the Checkout-local Finalization row, validates the expected Checkout revision, persists a canonical input digest and immutable accepted-input references, and conflicts if the same Checkout or operation is reused with changed input.

The ledger records current step, state, sequenced idempotent attempts, Order/Payment references, compensation/reconciliation records, and `needs_attention`. Each admission or progress record emits `checkout.finalization-lifecycle@1` atomically with its owner-local state. Its strict contracts contain identifiers and policy/decision references, never caller-supplied monetary values.

This foundation is not the finalizer. It invokes no capability, has no route or UI registration, and deliberately exposes no successful completion transition. The full ten-step orchestration, owner capability idempotency, per-step compensation/reconciliation, atomic Checkout completion, and injected-failure matrix must exist before activation.

## Patterns

- **Inter-module isolation**: immediate decisions use `ctx.context.capabilities`; `ctx.context.controllers.checkout` is owner-local compatibility access only.
- Missing authoritative Product or Order capabilities prevent Module initialization. Optional capability absence is explicit and required decisions fail closed at the endpoint.
- `getLineItems` strips the internal `sessionId` field before returning results
- `update` recalculates total when `shippingAmount` changes; blocks on completed/expired sessions
- `applyDiscount` handles `freeShipping: true` by zeroing `shippingAmount`; clamps total to 0
- `removeDiscount` restores `subtotal + taxAmount + shippingAmount` total
- `complete` only transitions from `pending` status; stores `orderId`
- `expireStale` remains an owner-local compatibility method and is not exposed as an active mutation path
- `exactOptionalPropertyTypes` compatible: all optional params use `T | undefined`
- `findMany` uses `take` (not `limit`) for the options API
