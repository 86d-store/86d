---
"@86d-app/core": major
"@86d-app/payments": minor
"@86d-app/paypal": minor
"@86d-app/stripe": minor
"@86d-app/braintree": minor
---

Require reconciliation callers to supply the original durable operation
payload. Add the Store-owned Payment v2 aggregate, bounded operation recovery,
durable Connection-bound webhook receipts, and unregistered PayPal, Stripe,
and Braintree Payment Connection adapters. Freeze a server-provisioned upstream
provider account identity across credential rotation, and bound PayPal exact-request
capture/refund recovery by documented idempotency behavior. Checkout activation
and legacy provider webhook mutation remain contained until the commerce
dependency gate and provider evidence pass.
