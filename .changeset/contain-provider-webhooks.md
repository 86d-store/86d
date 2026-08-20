---
"@86d-app/stripe": major
"@86d-app/paypal": major
"@86d-app/square": major
"@86d-app/braintree": major
"@86d-app/shipping": major
---

Contain process-local provider webhook effects while preserving strict signature
verification. Registered payment and EasyPost callbacks now reject missing or
invalid verification and return an explicit retryable durability-required error
after successful verification until provider receipts and outcome workflows are
durable.
