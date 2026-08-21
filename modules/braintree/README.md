<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/logo" height="96" alt="86d" />
  </a>
</p>

<p align="center">
  The Modern Foundation for Commerce
</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use. Please proceed with caution. Use at your own risk.

# Braintree Module

📚 **Documentation:** [86d.app/docs/modules/braintree](https://86d.app/docs/modules/braintree)

Braintree payment provider for 86d stores. Implements the `PaymentProvider` interface from `@86d-app/payments` using the Braintree REST API (no SDK dependency).

## Installation

```ts
import payments from "@86d-app/payments";
import braintree, { BraintreePaymentProvider } from "@86d-app/braintree";
import { createStore } from "@86d-app/core";

const provider = new BraintreePaymentProvider(
  "your_merchant_id",
  "your_public_key",
  "your_private_key",
);

const store = createStore({
  modules: [
    payments({ provider }),
    braintree({
      merchantId: "your_merchant_id",
      publicKey: "your_public_key",
      privateKey: "your_private_key",
    }),
  ],
});
```

## Options

| Option | Type | Required | Description |
|---|---|---|---|
| `merchantId` | `string` | Yes | Braintree merchant ID |
| `publicKey` | `string` | Yes | Braintree public API key |
| `privateKey` | `string` | Yes | Braintree private API key |
| `sandbox` | `string` | No | Pass `"true"` to use the sandbox environment |

## Payment Connection v2 adapter

The module also exports `createBraintreePaymentConnectionProvider`, a GraphQL
adapter bound to one immutable Connection ID and server-provisioned Braintree
merchant ID (`providerAccountId`). The host must verify that its credential
authorizes that merchant before binding the adapter. Credential rotation cannot
rebind historical work to another merchant because the Payment owner requires
that identity to match its durable Connection. It is intentionally not registered by the legacy module
initializer while Checkout migration and durable webhook ingress remain
contained.

The v2 adapter starts with authorization; it does not advertise or execute an
`intent` operation because doing so would create an unrecorded financial hold.
It uses one capture per authorization and routes new authorizations through the
Connection-owned `merchantAccountIds` mapping. Mutations forward the durable
idempotency key as `apiRequestKey` and the operation ID as `clientMutationId` and,
where supported, `orderId`. Reconciliation uses read-only GraphQL queries for the
exact transaction/refund reference or unique operation order ID. Braintree's
duplicate-request window is 30 days, so the Store's durable operation envelope
remains the permanent source of idempotency truth.

Referenced authorization, capture, refund, and void requests must include the
durable source operation descriptor. The adapter validates its operation type,
provider reference, amount, and currency before provider I/O. Capture is allowed
only when its amount exactly equals the source authorization amount, preventing
a final upstream capture from leaving a locally claimable remainder. Both
capture and refund are bound by the source transaction and deliberately do not
reselect a merchant account from mutable current configuration.

A provider-confirmed `AUTHORIZING` response persists as `pending`, not as an
unknown outcome. It retains the exact transaction reference for later canonical
reconciliation and does not advance the Payment aggregate.

Capture is a single final operation: partial and incremental capture are not
supported. The adapter does not yet provide a shopper-facing 3D Secure/SCA
challenge and return contract, so payment methods that require shopper action
cannot be activated through this path. These limitations, the Checkout migration
dependency, and the durable webhook-ingress dependency keep the adapter
unregistered; the existing webhook continues to verify then return
`503 PAYMENT_WEBHOOK_DURABILITY_REQUIRED`.

## Sandbox Mode

```ts
const provider = new BraintreePaymentProvider(
  merchantId,
  publicKey,
  privateKey,
  true, // sandbox
);
```

Sandbox base URL: `https://api.sandbox.braintreegateway.com`
Production base URL: `https://api.braintreegateway.com`

## Store Endpoints

### Webhook

```
POST /braintree/webhook
```

Authenticates Braintree's form payload with the configured public/private keys. Missing verification configuration returns `503`, and missing or invalid signatures return `401`. A verified callback returns `503 PAYMENT_WEBHOOK_DURABILITY_REQUIRED` so Braintree retries; it does not mutate Payment state or emit a commerce outcome. The previous process-local XML mapper remains deliberately unregistered.

## API Mapping

| PaymentProvider method | Braintree API |
|---|---|
| `createIntent` | `POST /merchants/{id}/transactions` (authorize only, `submit_for_settlement: false`) |
| `confirmIntent` | `POST /merchants/{id}/transactions/{txId}/submit_for_settlement` |
| `cancelIntent` | `POST /merchants/{id}/transactions/{txId}/void` |
| `createRefund` | `POST /merchants/{id}/transactions/{txId}/refunds` |

## Status Mapping

| Braintree Status | PaymentProvider Status |
|---|---|
| `settled` | `succeeded` |
| `voided` | `cancelled` |
| `submitted_for_settlement`, `settling`, `settlement_pending`, `settlement_confirmed` | `processing` |
| `failed`, `processor_declined`, `gateway_rejected`, `settlement_declined` | `failed` |
| `authorized` | `pending` |

## Authentication

Uses HTTP Basic auth: `Authorization: Basic base64(publicKey:privateKey)` with `Braintree-Version: 2019-01-01`.

## Amounts

Amounts are passed as integer minor units and converted with the currency's
supported exponent for the Braintree API (for example, USD `1000` → `"10.00"`,
while JPY, ISK, and LAK `1000` → `"1000"`).

## Payment Method Nonce

`createIntent` uses a `paymentMethodNonce` from `metadata`. In production, obtain this from the Braintree Drop-in UI or client SDK:

```ts
await paymentsController.createIntent({
  amount: 1999,
  currency: "USD",
  metadata: { paymentMethodNonce: "nonce-from-client" },
});
```
