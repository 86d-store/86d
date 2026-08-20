---
"@86d-app/core": major
"@86d-app/cart": major
"@86d-app/checkout": major
"@86d-app/inventory": major
"@86d-app/products": major
"@86d-app/orders": major
"@86d-app/product-feeds": major
"@86d-app/tax": minor
---

Replace caller-supplied Checkout line items and totals with an owner-authorized,
versioned Cart snapshot capability. Guest Checkout access now requires a
high-entropy httpOnly proof rather than possession of a session UUID.
Products now accept only integer-minor-unit prices, reject stock mutations that
belong to Inventory, contain direct imports, and retire duplicate Collection
write endpoints.
Order-creation contracts now reject non-integer monetary snapshots.
Inventory adjustments now enter through an authenticated, idempotent Command
transport, while checkout reservations use durable row-locked v2 operations.
Tax exposes explicit v2 jurisdiction and quote decisions with deterministic
integer allocation and effective-dated policy provenance.
Product-feed generation is contained until it derives output from an immutable
published Catalog revision instead of caller-supplied product data.
Products now exposes an owner-local Catalog revision engine with
immutable digests, reviewed publication, stale-base conflict detection,
transition audit, replay receipts, and an atomic `catalog.published@1` fact.
Authenticated Store Admin transport now creates, reviews, publishes, gets, and
lists those revisions while deriving actor and Store authority from the session.
Checkout now exports a dormant, owner-local Checkout Request foundation with
row-locked idempotent creation, sanitized contact data, immutable Cart choices,
bounded retention, invitation state, and no live-money or inventory authority.
Its bounded Store transport resolves a caller-owned Cart and protects request
reads with authenticated ownership or a request-scoped guest proof. Invitation
transitions remain unavailable until durable delivery can prove the send.
