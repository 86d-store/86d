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

📚 **Documentation:** [86d.app/docs/modules/managed-payments](https://86d.app/docs/modules/managed-payments)

# Managed Payments Module

Cross-plane managed Payment bridge for the 86d Store Runtime. Managed Deployments do not hold provider credentials; this Module authenticates with the Store's workload credential, asks the Control Plane to run a payment operation, and applies durable outcomes to the local Payment record.

Requires `@86d-app/payments` and reads `paymentStatus` and `paymentAmount` from it. Experimental: prepare remains fail-closed until production evidence exists (`86D_PAYMENTS_LIVE_ACTIVATION=true`).

## Installation

```sh
npm install @86d-app/managed-payments
```

## Usage

```ts
import managedPayments from "@86d-app/managed-payments";

const module = managedPayments();
```

Managed provisioning typically installs this Module. For direct Payment provider setup today, use a provider Module such as `@86d-app/stripe` instead.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `workloadConfig` | `ManagedWorkloadConfig` | env via `readManagedWorkloadConfig()` | Override managed workload configuration instead of reading env vars |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/payments/managed/prepare` | Prepare a managed payment operation for the current Checkout (workload identity; not a shopper session) |

`POST /payments/managed/prepare` body fields:

| Field | Type | Description |
|---|---|---|
| `bindingId` | `string` | Store binding id |
| `merchantPaymentAccountId` | `string` | Merchant Payment Account id |
| `mode` | `"sandbox"` \| `"live"` | Explicit mode (default `"sandbox"`) |
| `option` | `"card"` \| `"apple_pay"` \| `"google_pay"` | Shopper-visible payment option (default `"card"`) |

Until live activation is enabled, the endpoint returns `503` with `PAYMENT_ACTIVATION_REQUIRED`.

## Workload scopes

Tokens exchanged by this Module are scoped to:

| Scope | What it allows |
|---|---|
| `payments.operation:submit` | Submit an operation for execution |
| `payments.operation:read` | Read the state of an operation it submitted |
| `payments.outcome:read` | Read durable outcomes waiting to be applied |
| `payments.outcome:acknowledge` | Mark an outcome as applied |
| `payments.connection:read` | Read the Connection an operation is bound to |

Audience: `https://86d.app/api/store-runtime`.

## Exported helpers

| Export | Description |
|---|---|
| `createManagedPaymentClient` | Workload-auth client for Control Plane payment operations |
| `createManagedPaymentOutcomeConsumer` | Applies confirmed/declined outcomes to local Payment aggregates |
| `consumeManagedPaymentOutcomes` | One-shot outcome consumption helper |
| `MANAGED_PAYMENT_WORKLOAD_SCOPES` | Scope list for token exchange |
| `STORE_RUNTIME_WORKLOAD_AUDIENCE` | Required token audience |

Operation kinds that cross the boundary: `authorize`, `capture`, `void`, and `refund`. Outcomes carry an event id, version, and payment sequence; the consumer deduplicates on event id and refuses out-of-sequence application before acknowledging.

Provider secrets never enter the Store Runtime. Callers receive opaque references and health state only.
