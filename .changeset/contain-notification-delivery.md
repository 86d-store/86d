---
"@86d-app/notifications": major
---

Contain registered process-local notification delivery. Admin create, batch,
and template-send routes now permit in-app notifications only, while Resend and
Twilio callbacks preserve strict verification and return retryable
durability-required responses until provider receipts and delivery projection
are durable.
