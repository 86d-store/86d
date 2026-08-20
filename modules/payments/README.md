<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/logo" height="96" alt="86d" />
  </a>
</p>

<p align="center">
  Dynamic Commerce
</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use. Please proceed with caution. Use at your own risk.

# Payments Module

📚 **Documentation:** [86d.app/docs/modules/payments](https://86d.app/docs/modules/payments)

Provider-neutral payment ownership for the 86d commerce platform. The additive v2 boundary records named Store Payment Connections and durable provider operations; legacy intent, method, and refund APIs remain migration state.

![version](https://img.shields.io/badge/version-0.0.1-blue) ![license](https://img.shields.io/badge/license-MIT-green)

## Installation

```sh
npm install @86d-app/payments
```

## Usage

```ts
import payments from "@86d-app/payments";
import { createModuleClient } from "@86d-app/core";

// Without a provider (offline/test mode)
const client = createModuleClient([payments()]);

// With a Stripe provider
import { StripePaymentProvider } from "@86d-app/stripe";
const provider = new StripePaymentProvider("sk_live_...");
const client = createModuleClient([payments({ provider, currency: "USD" })]);
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `currency` | `string` | `"USD"` | Default currency for payment intents |
| `provider` | `PaymentProvider` | `undefined` | Payment processor implementation |
| `connectionProviders` | `PaymentConnectionProvider[]` | `undefined` | Server-created v2 adapters, each bound to one immutable Connection |

## PaymentProvider Interface

Implement this interface to connect any payment processor:

```ts
interface PaymentProvider {
  createIntent(params: {
    amount: number;      // in smallest currency unit (e.g. cents)
    currency: string;
    metadata?: Record<string, unknown>;
  }): Promise<ProviderIntentResult>;

  confirmIntent(providerIntentId: string): Promise<ProviderIntentResult>;

  cancelIntent(providerIntentId: string): Promise<ProviderIntentResult>;

  createRefund(params: {
    providerIntentId: string;
    amount?: number;    // partial refund; omit for full refund
    reason?: string;
  }): Promise<ProviderRefundResult>;
}
```

**Missing provider:** a positive Payment cannot be confirmed or refunded without a configured provider. Explicit offline behavior is restricted to non-production development callers.

## Payment Connections v2

`PaymentsOptions.connectionProviders` accepts server-created adapters bound to one immutable `connectionId` and server-provisioned provider-owned `providerAccountId`. The host is responsible for verifying that the credential inside the adapter authorizes that account before binding it; the local identifier is not provider approval or live evidence. The owner-local `paymentConnections` controller manages named Connections and durable intent, authorization, capture, refund, and void operations. Each operation records its Connection, operation-specific idempotency key, request digest, provider reference, attempt history, and ambiguous or needs-attention state.

The v2 service is intentionally not exposed as a shopper endpoint or wired into the legacy Checkout capability. A host must supply an owner-local locking transaction runner, and every enabled Connection must have an exact provider/account/mode/capability adapter match. Credential rotation disables the Connection but cannot change its persisted provider account identity; an adapter authorized for another upstream account is rejected after restart. Missing, disabled, revoked, unhealthy, or mismatched Connections fail closed. Capture, refund, and void operations must continue a succeeded source operation and use its original Connection and provider reference.

The opaque `secretReference` is server-side configuration data. It must never be returned by Store or admin endpoints, browser output, logs, or agent output.

### Payment aggregate and recovery

`paymentAggregates` owns the v2 shopper Payment record. Creation freezes the
Checkout, optional Order, Payment option, Connection, expected integer amount,
currency, and eligible-merchandise fee basis. Confirmed authorization, capture,
void, and refund facts cite exact source operations. Owner-local locks reserve
in-flight totals so distinct idempotency keys cannot bypass cumulative capture
or refund ceilings. Disputes update a separate projection and never count as
refunds or settlement.

The state projection is derived from confirmed totals: pending, authorized,
partially captured, captured, partially refunded, refunded, or voided. Only a
fully captured and fully refunded accepted amount is terminal `refunded`; a
full authorization void with no capture is terminal `voided`. Confirmed
transitions and their Payment snapshots enter the transactional outbox with the
aggregate update.

Provider-known `pending` and `requires_action` outcomes retain the provider
reference and normalized result without advancing the Payment aggregate. They
use longer, state-specific bounded polling schedules and remain distinguishable
from `ambiguous`, which means the provider outcome itself is unknown. Exhausted
known-state polling preserves that provider truth for manual attention; it does
not convert the operation to success or dead letter.

All nonfinal and stale operations retain their original Connection, immutable
creation time, caller key, and payload. The controller exposes bounded scheduled
backoff, stale-running recovery, dead-letter state for unresolved ambiguity, and
audited manual reconciliation. Caller keys are capped at 108 characters so the
same key can be forwarded to every supported provider. This is the durable
worker seam; no scheduler or shopper route is activated by the module.

### Durable webhook receipt foundation

`paymentWebhookReceipts` accepts only provider facts that a server-side
Integration has already signature-verified against the exact Connection. It
persists a unique Store/Connection/provider/event receipt, payload digest,
normalized fact, processing lease, attempts, and disposition without storing
the raw payload or a secret. Exact replays acknowledge the existing result;
digest or normalized-fact conflicts fail closed. A crash after applying a fact
is safe because Payment-owner operation/dispute identities replay exactly.

Provider network reconciliation occurs outside the receipt transaction.
Out-of-order or ambiguous facts remain unacknowledged in `needs_attention` until
canonical reconciliation completes. PayPal, Stripe, and Braintree registered
webhooks do not use this controller yet and continue returning the explicit 503
durability containment response.

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/payments/methods` | Contained: verified Customer + Payment Connection required |
| `DELETE` | `/payments/methods/:id` | Contained: verified Customer + Payment Connection required |

Generic shopper intent create/get/confirm/cancel and saved-method source files remain as migration history but their unsafe paths are not registered by the Module. Live activation stays contained until the v2 Checkout finalizer, verified Store Customer binding, and provider paths satisfy the critical-path contract.

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/payments` | List all intents (filter: `customerId`, `status`, `orderId`) |
| `GET` | `/admin/payments/:id` | Get intent detail |
| `POST` | `/admin/payments/:id/refund` | Contained: original-Connection-bound v2 operation required |
| `GET` | `/admin/payments/:id/refunds` | List refunds for an intent |

## Legacy v1 Controller API

```ts
// ── Payment intents ─────────────────────────────────────────────────────────

controller.createIntent(params: {
  amount: number;             // positive integer, smallest currency unit (e.g. cents)
  currency?: string;          // default: module currency option
  customerId?: string;
  email?: string;
  orderId?: string;
  checkoutSessionId?: string;
  metadata?: Record<string, unknown>;
}): Promise<PaymentIntent>
// Throws: "Amount must be a positive integer"

controller.getIntent(id: string): Promise<PaymentIntent | null>

controller.confirmIntent(id: string): Promise<PaymentIntent | null>
// Throws: "Cannot confirm intent in '{status}' state" for terminal states

controller.cancelIntent(id: string): Promise<PaymentIntent | null>
// Throws: "Cannot cancel intent in '{status}' state" for succeeded/failed/refunded

controller.listIntents(params?: {
  customerId?: string;
  status?: PaymentIntentStatus;
  orderId?: string;
  take?: number;
  skip?: number;
}): Promise<PaymentIntent[]>

// ── Payment methods ─────────────────────────────────────────────────────────

// Saves a payment method; if isDefault=true, clears all other defaults
controller.savePaymentMethod(params: {
  customerId: string;
  providerMethodId: string;  // e.g. Stripe's pm_xxx
  type?: string;             // "card" | "bank_transfer" | "wallet"
  last4?: string;
  brand?: string;            // "visa" | "mastercard" | etc.
  expiryMonth?: number;
  expiryYear?: number;
  isDefault?: boolean;
}): Promise<PaymentMethod>

controller.getPaymentMethod(id: string): Promise<PaymentMethod | null>

controller.listPaymentMethods(customerId: string): Promise<PaymentMethod[]>

controller.deletePaymentMethod(id: string): Promise<boolean>

// ── Refunds ─────────────────────────────────────────────────────────────────

// Only on succeeded/refunded intents. Cumulative refunds capped at intent amount.
controller.createRefund(params: {
  intentId: string;
  amount?: number;   // positive integer; omit for full refund
  reason?: string;
}): Promise<Refund>
// Throws: "Payment intent not found"
// Throws: "Cannot refund intent in '{status}' state"
// Throws: "Refund amount must be positive"
// Throws: "Refund amount {n} exceeds remaining refundable amount {m}"

controller.getRefund(id: string): Promise<Refund | null>

controller.listRefunds(intentId: string): Promise<Refund[]>
```

## Legacy Controller Example

This example describes direct server-side controller use during migration. It is not the active Store Checkout path and does not provide Payment Connection durability.

```ts
// 1. Customer initiates checkout — create intent
const intent = await controller.createIntent({
  amount: 4999,   // $49.99
  currency: "USD",
  customerId: "cust_123",
  orderId: "ord_456",
});
// intent.status === "pending"
// With Stripe: intent.providerMetadata.clientSecret → send to frontend

// 2. Customer completes payment on frontend → call confirm
const confirmed = await controller.confirmIntent(intent.id);
// confirmed.status === "succeeded"

// 3. Customer requests refund
const refund = await controller.createRefund({
  intentId: intent.id,
  reason: "customer request",
});
// refund.status === "succeeded"
// intent.status is now "refunded"

// 4. Save a payment method for future use
const method = await controller.savePaymentMethod({
  customerId: "cust_123",
  providerMethodId: "pm_stripe_xxx",
  type: "card",
  last4: "4242",
  brand: "visa",
  isDefault: true,
});
```

## Payment Intent Statuses

| Status | Description |
|---|---|
| `pending` | Intent created, payment not yet initiated |
| `processing` | Payment is being processed |
| `succeeded` | Payment completed successfully |
| `failed` | Payment failed |
| `cancelled` | Intent was cancelled |
| `refunded` | Legacy projection after a refund; not authoritative for partial-refund accounting |

## Financial Safety Guards

The payments controller enforces several financial safety rules at the controller level:

| Rule | Description |
|---|---|
| **Amount validation** | `createIntent` rejects zero, negative, and fractional amounts. Amount must be a positive integer (smallest currency unit). |
| **Confirm guards** | `confirmIntent` only works on `pending` or `processing` intents. Throws on `cancelled`, `failed`, `refunded`. |
| **Cancel guards** | `cancelIntent` only works on `pending` or `processing` intents. Throws on `succeeded`, `failed`, `refunded`. |
| **Refund guards** | `createRefund` only works on `succeeded` or `refunded` intents. Throws on `pending`, `processing`, `cancelled`, `failed`. |
| **Refund cap** | Cumulative non-failed refunds cannot exceed the original intent amount. Partial refunds are tracked and summed. |
| **Refund amount** | Refund amount must be positive. Zero and negative amounts are rejected. |
| **Webhook dedup** | `handleWebhookRefund` deduplicates by `providerRefundId` — webhook retries return the existing refund instead of creating duplicates. |

## Types

```ts
type PaymentIntentStatus =
  | "pending" | "processing" | "succeeded"
  | "failed" | "cancelled" | "refunded";

type RefundStatus = "pending" | "succeeded" | "failed";

interface PaymentIntent {
  id: string;
  providerIntentId?: string;   // e.g. Stripe's pi_xxx
  customerId?: string;
  email?: string;
  amount: number;
  currency: string;
  status: PaymentIntentStatus;
  paymentMethodId?: string;
  orderId?: string;
  checkoutSessionId?: string;
  metadata: Record<string, unknown>;
  providerMetadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface PaymentMethod {
  id: string;
  customerId: string;
  providerMethodId: string;
  type: string;
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Refund {
  id: string;
  paymentIntentId: string;
  providerRefundId: string;
  amount: number;
  reason?: string;
  status: RefundStatus;
  createdAt: Date;
  updatedAt: Date;
}
```
