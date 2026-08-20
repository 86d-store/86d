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

# Stripe Module

📚 **Documentation:** [86d.app/docs/modules/stripe](https://86d.app/docs/modules/stripe)

Stripe payment provider for the 86d commerce platform. Implements the `PaymentProvider` interface from `@86d-app/payments` using raw `fetch()` calls to the Stripe REST API (no SDK dependency). Includes a webhook endpoint with HMAC-SHA256 signature verification.

![version](https://img.shields.io/badge/version-0.0.1-blue) ![license](https://img.shields.io/badge/license-MIT-green)

## Installation

```sh
npm install @86d-app/stripe @86d-app/payments
```

## Usage

Register the module and pass the provider to the payments module:

```ts
import stripe, { StripePaymentProvider } from "@86d-app/stripe";
import payments from "@86d-app/payments";
import { createModuleClient } from "@86d-app/core";

const stripeProvider = new StripePaymentProvider("sk_live_...");

const client = createModuleClient([
  stripe({
    apiKey: "sk_live_...",
    webhookSecret: "whsec_...",
  }),
  payments({ provider: stripeProvider }),
]);
```

## Configuration

| Option | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | Yes | Stripe secret key (`sk_live_...` or `sk_test_...`) |
| `webhookSecret` | `string` | No | Webhook signing secret (`whsec_...`) for signature verification |

## Payment Connection v2 adapter

The module also exports `createStripePaymentConnectionProvider` for the durable
Payment Connection contract. The factory binds one adapter instance to one
immutable Connection ID and server-provisioned Stripe account ID
(`providerAccountId`). The host must verify that its credential authorizes that
account before binding the adapter. Credential rotation cannot rebind historical
work to another account because the Payment owner requires that identity to
match its durable Connection. The adapter is intentionally not registered by the legacy
module initializer while Checkout migration and durable webhook ingress remain
contained.

The v2 adapter creates manual-capture PaymentIntents and performs one final
capture per authorization (`final_capture=true`). Every Stripe mutation receives
the operation envelope's `Idempotency-Key` unchanged. Unknown mutation outcomes
remain ambiguous and are reconciled with read-only retrieval or metadata search
against the exact PaymentIntent or refund. Refund responses are normalized only
from Stripe `refund` objects; disputes are never treated as refunds.

Referenced authorization, capture, refund, and void requests must include the
durable source operation descriptor. The adapter validates its operation type,
provider reference, amount, and currency before provider I/O. Capture is allowed
only when its amount exactly equals the source authorization amount, preventing
Stripe's final capture from releasing a remainder that local Payment state could
still consider claimable.

The adapter accepts only `sk_`/`rk_` keys whose `test` or `live` prefix matches
the immutable Connection mode, and pins REST requests to Stripe API version
`2026-02-25.clover`. It does not support incremental or partial capture. Known
`processing` responses persist as `pending`, while SCA persists distinctly as
`requires_action`; neither advances the Payment aggregate or consumes the
short ambiguity budget. The adapter still does not expose a safe shopper
action/return contract, so an SCA result cannot be completed through this path.
These limitations, the Checkout migration dependency, and the
durable webhook-ingress dependency keep the adapter unregistered; the existing
webhook continues to verify then return `503 PAYMENT_WEBHOOK_DURABILITY_REQUIRED`.

## Payment Provider

`StripePaymentProvider` implements the `PaymentProvider` interface:

```ts
const provider = new StripePaymentProvider("sk_live_...");

// Create a PaymentIntent (amount in cents)
const intent = await provider.createIntent({
  amount: 2500,        // $25.00
  currency: "usd",
});
// { providerIntentId: "pi_...", status: "pending", providerMetadata: { clientSecret: "..." } }

// Confirm after client-side payment
await provider.confirmIntent("pi_...");

// Cancel an uncaptured intent
await provider.cancelIntent("pi_...");

// Issue a full or partial refund
await provider.createRefund({
  providerIntentId: "pi_...",
  amount: 1000,        // $10.00 partial refund (omit for full)
  reason: "requested_by_customer",
});
```

### Status Mapping

| Stripe Status | Mapped Status |
|---|---|
| `succeeded` | `succeeded` |
| `canceled` | `cancelled` |
| `processing`, `requires_capture` | `processing` |
| `requires_payment_method`, `requires_confirmation`, `requires_action` | `pending` |

## Webhook Endpoint

| Method | Path | Description |
|---|---|---|
| `POST` | `/stripe/webhook` | Receive Stripe webhook events |

The webhook endpoint:

1. Reads the raw request body before parsing (required for HMAC verification)
2. Verifies the `Stripe-Signature` header using HMAC-SHA256 with timestamp replay protection (5-minute tolerance)
3. Returns `503 PAYMENT_WEBHOOK_DURABILITY_REQUIRED` after successful verification so Stripe retries; no Payment state or commerce event is changed

**Without `webhookSecret`:** The webhook endpoint returns `503` and performs no payment or event effects.

**With `webhookSecret`:** Invalid or expired signatures return `401`.

The previous process-local event handler remains unregistered until provider receipts and Payment outcome application are durable and idempotent.

### Webhook Verification

Signature verification uses the Web Crypto API (no external dependencies) and follows the Stripe signing scheme:

```
signed_payload = <timestamp> + "." + <raw_body>
expected_sig   = HMAC-SHA256(webhook_secret, signed_payload)
```

The `v1` signature from the `Stripe-Signature` header is compared using constant-time comparison to prevent timing attacks.

## Provider API Reference

```ts
interface PaymentProvider {
  createIntent(params: {
    amount: number;
    currency: string;
    metadata?: Record<string, unknown>;
  }): Promise<ProviderIntentResult>;

  confirmIntent(providerIntentId: string): Promise<ProviderIntentResult>;

  cancelIntent(providerIntentId: string): Promise<ProviderIntentResult>;

  createRefund(params: {
    providerIntentId: string;
    amount?: number;
    reason?: string;
  }): Promise<ProviderRefundResult>;
}
```

## Types

```ts
interface StripeOptions extends ModuleConfig {
  apiKey: string;
  webhookSecret?: string;
}

interface ProviderIntentResult {
  providerIntentId: string;
  status: "pending" | "processing" | "succeeded" | "cancelled" | "failed";
  providerMetadata?: Record<string, unknown>;
}

interface ProviderRefundResult {
  providerRefundId: string;
  status: "pending" | "succeeded" | "failed";
  providerMetadata?: Record<string, unknown>;
}
```
