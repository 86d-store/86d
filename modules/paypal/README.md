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

# PayPal Module

📚 **Documentation:** [86d.app/docs/modules/paypal](https://86d.app/docs/modules/paypal)

PayPal Third-party Payment Integration using the PayPal Orders and Payments v2 APIs through raw server-side `fetch()` calls. The connection-bound adapter implements the durable `PaymentConnectionProvider` contract. The older singleton `PaymentProvider` export remains only for migration compatibility.

## Installation

```ts
import { PayPalPaymentConnectionProvider } from "@86d-app/paypal";
import payments from "@86d-app/payments";

const provider = new PayPalPaymentConnectionProvider({
  connectionId: "paypal-primary",
  providerAccountId: "PAYPAL_PAYER_ID",
  clientId: "CLIENT_ID",
  clientSecret: "CLIENT_SECRET",
  mode: "test",
  returnUrl: "https://store.example/paypal/return",
  cancelUrl: "https://store.example/paypal/cancel",
});
const paymentsModule = payments({ connectionProviders: [provider] });
```

## Options

```ts
import paypal from "@86d-app/paypal";

const paypalModule = paypal({
  clientId: "your-client-id",
  clientSecret: "your-client-secret",
  sandbox: "true",       // optional — use sandbox environment
  webhookId: "webhook-id", // optional — for signature verification
});
```

| Option | Type | Required | Description |
|---|---|---|---|
| `clientId` | `string` | yes | PayPal application client ID |
| `clientSecret` | `string` | yes | PayPal application client secret |
| `sandbox` | `"true" \| ""` | no | Pass `"true"` to use sandbox environment |
| `webhookId` | `string` | no | PayPal webhook ID for signature verification |

## Authentication

Uses OAuth2 client credentials flow automatically. The provider:
1. Fetches an access token via `POST /v1/oauth2/token` with Basic auth
2. Caches the token until 60 seconds before expiry
3. Automatically refreshes on the next request after expiry

No manual token management required.

## Connection-bound API mapping

The versioned contract uses an explicit authorize-then-capture strategy. Each operation stores one immutable Connection and exact source provider reference before any continuation occurs.

| Operation | PayPal API endpoint |
|---|---|
| Create intent | `POST /v2/checkout/orders` (`intent: AUTHORIZE`) |
| Authorize | `POST /v2/checkout/orders/{orderId}/authorize` |
| Capture | `POST /v2/payments/authorizations/{authorizationId}/capture` |
| Void | `POST /v2/payments/authorizations/{authorizationId}/void`, then canonical `GET` confirmation |
| Refund | `POST /v2/payments/captures/{captureId}/refund` |
| Reconcile | Canonical resource `GET` when an exact resource is known; bounded exact-request replay where PayPal idempotency permits it; otherwise remain ambiguous |

Every supported POST receives the durable operation idempotency key unchanged as `PayPal-Request-Id` and enforces the Orders v2 108-character ceiling. Create Order includes trusted HTTPS return/cancel URLs and uses PayPal's current `payer-action` handoff (with `approve` accepted for compatibility). An unknown Create Order may repeat only within a conservative five-hour window inside PayPal's documented six-hour request-ID retention. PayPal explicitly documents replaying an unclear capture with the same request ID and body, but does not publish a capture retention floor; this adapter therefore uses a deliberately short five-minute operational recovery bound and does not claim that as provider retention. PayPal documents refund request IDs for up to 45 days, and the adapter stays one day inside that bound at 44 days. After any bound expires, reconciliation remains ambiguous and does not call PayPal. Equal-value partial refunds remain distinct because they use distinct operation keys and the exact capture reference. Every continuation validates the durable source operation, provider reference, and money before I/O. Currency comes from the server-owned Payment operation; PayPal's `HUF`, `JPY`, and `TWD` zero-digit exponents are honored and unsupported currencies fail before I/O.

The adapter also freezes the server-provisioned PayPal payer/merchant identity
as `providerAccountId`. The host must verify that its credential authorizes that
account before binding the adapter; this local assertion is not sandbox or live
evidence. The Payment owner compares the value to its durable Connection on
enablement and every operation, so rotating credentials cannot silently route
historical work to another PayPal account.

## Status Mapping

| PayPal status | Provider status |
|---|---|
| `COMPLETED`, `APPROVED` | `succeeded` when valid for that operation |
| `VOIDED` | `failed` for an Order, `succeeded` for an explicit void |
| `PENDING` | `pending` |
| `CREATED`, `SAVED` with a payer link; `PAYER_ACTION_REQUIRED` | `requires_action` |
| `CREATED`, `SAVED` without a payer link | `pending` |

## Webhook

The `paypal()` module registers `POST /paypal/webhook` with PayPal's remote signature verification. Missing verification configuration returns `503`, and missing or unverifiable signatures return `401`. A verified event returns `503 PAYMENT_WEBHOOK_DURABILITY_REQUIRED` so PayPal retries; it does not mutate Payment state or emit a commerce outcome. The previous process-local mapper remains deliberately unregistered.

## Migration compatibility

`PayPalPaymentProvider` is the legacy singleton adapter. It creates a PayPal order with `intent: CAPTURE` and then captures that order. It does not implement the new immutable Connection, exact continuation, or durable reconciliation contract and must not be used to activate Checkout. It is retained so existing stored configuration is not silently stranded while the Store Runtime migration is incomplete.

## Usage with Payments

```ts
import payments from "@86d-app/payments";
import { PayPalPaymentConnectionProvider } from "@86d-app/paypal";

const connection = new PayPalPaymentConnectionProvider({
  connectionId: "paypal-primary",
  providerAccountId: process.env.PAYPAL_PAYER_ID,
  clientId: process.env.PAYPAL_CLIENT_ID,
  clientSecret: process.env.PAYPAL_CLIENT_SECRET,
  mode: process.env.NODE_ENV === "production" ? "live" : "test",
  returnUrl: "https://store.example/paypal/return",
  cancelUrl: "https://store.example/paypal/cancel",
});

const paymentModule = payments({ connectionProviders: [connection] });
```

## Notes

- The registered webhook verifies PayPal's signature but intentionally returns a retryable `503` until the durable Payment-owned receipt workflow is wired end to end.
- The connection adapter is exported as contained foundation code but is not registered by the default Store Runtime while the M5 dependency gate remains open.
- No client secret, access token, or raw provider response is returned as safe browser configuration.
- The adapter and fetch-mocked official-shape fixtures are implementation evidence, not a live PayPal smoke. This Integration remains below Stable until the required targeted production transaction exists.

## Types

```ts
import type {
  PayPalOptions,
  PayPalPaymentConnectionProviderOptions,
} from "@86d-app/paypal";
import {
  PayPalPaymentConnectionProvider,
  PayPalPaymentProvider,
} from "@86d-app/paypal";
```
