---
"@86d-app/core": minor
"@86d-app/customers": minor
"@86d-app/orders": major
---

Add a typed Customer identity resolution capability and a row-locked,
idempotent Store Customer binding service. Verified authentication subjects are
digested rather than reused as Customer IDs, while email-only guest Order
claims remain unavailable until a proof-bearing Orders capability exists.
Customers profile and address routes now use the verified binding, and duplicate
Customers-owned loyalty endpoints are no longer registered. Authenticated Order
history, detail, invoice, reorder, and cancellation remain contained until an
Orders-owned audited migration attributes legacy rows without losing history.
