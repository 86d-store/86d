<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/icon" height="96" alt="86d" />
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

📚 **Documentation:** [86d.app/docs/modules/square](https://86d.app/docs/modules/square)

# Square Module

Square payment provider implementing the `PaymentProvider` interface from `@86d-app/payments`. Uses Square's Payments API via raw `fetch()` — no Square SDK required.

## Installation

```ts
import { SquarePaymentProvider } from "@86d-app/square";
import payments from "@86d-app/payments";

const provider = new SquarePaymentProvider("your-access-token");
const paymentsModule = payments({ currency: "USD", provider });
```

## Options

```ts
import square from "@86d-app/square";

const squareModule = square({
  accessToken: "your-access-token",
  webhookSignatureKey: "optional-signature-key",
});
```

| Option | Type | Required | Description |
|---|---|---|---|
| `accessToken` | `string` | yes | Square access token (production or sandbox) |
| `webhookSignatureKey` | `string` | no | Signature key for webhook verification |

## API Mapping

| PaymentProvider method | Square API endpoint |
|---|---|
| `createIntent` | `POST /v2/payments` (autocomplete: false) |
| `confirmIntent` | `POST /v2/payments/{id}/complete` |
| `cancelIntent` | `POST /v2/payments/{id}/cancel` |
| `createRefund` | `POST /v2/refunds` |

## Status Mapping

| Square status | Provider status |
|---|---|
| `COMPLETED` | `succeeded` |
| `CANCELED` | `cancelled` |
| `FAILED` | `failed` |
| `APPROVED`, `PENDING` | `pending` |

## Webhook

The `square()` module registers `POST /square/webhook` with HMAC-SHA256 verification against the configured signature key and exact notification URL. Missing verification configuration returns `503`, and missing or invalid signatures return `401`. A verified event returns `503 PAYMENT_WEBHOOK_DURABILITY_REQUIRED` so Square retries; it does not mutate Payment state or emit a commerce outcome. The previous process-local mapper remains deliberately unregistered.

## Usage with payments module

```ts
import { SquarePaymentProvider } from "@86d-app/square";
import payments from "@86d-app/payments";
import square from "@86d-app/square";
import { createStore } from "@86d-app/core";

const provider = new SquarePaymentProvider(process.env.SQUARE_ACCESS_TOKEN);

const store = createStore({
  modules: [
    payments({ currency: "USD", provider }),
    square({ accessToken: process.env.SQUARE_ACCESS_TOKEN }),
  ],
});
```

## Notes

- Uses Square API version `2024-01-18`
- `createIntent` uses `source_id: "EXTERNAL"` and `autocomplete: false` — the payment is authorized but not completed until `confirmIntent` is called
- `createIntent` includes an `idempotency_key` generated via `crypto.randomUUID()` to prevent duplicate charges
- Amounts are in cents in the `PaymentProvider` interface; Square uses cents as well (`amount_money.amount`)
- Content-Type is `application/json` (unlike Stripe which uses form-encoded)

## Types

```ts
import type { SquareOptions } from "@86d-app/square";
import { SquarePaymentProvider } from "@86d-app/square";
```
