---
"@86d-app/core": minor
"@86d-app/orders": minor
"@86d-app/fulfillment": major
---

Make standalone Fulfillment the delivery-obligation writer. Orders now exposes a
typed line-quantity validation capability, while Fulfillment creation requires
owner-local row-locking transactions and rejects cumulative active obligations
above the immutable Order quantities. Empty generic obligations remain rejected
until explicit zero-line obligation types are modeled. Direct status, tracking,
and cancellation routes remain contained until Shipping-aware durable workflows
replace the compatibility controller writers.
