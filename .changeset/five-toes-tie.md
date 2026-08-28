---
"@86d-app/revenue": patch
"@86d-app/analytics": patch
"@86d-app/ui": patch
"@86d-app/products": patch
"@86d-app/reviews": patch
"@86d-app/store-pickup": patch
"@86d-app/core": patch
"@86d-app/search": patch
"@86d-app/runtime": patch
---

Fix the Analytics and Revenue admin runtimes, keep merchant semantic colors WCAG AA compliant through shared hover states, keep product-list controls and table columns reachable on narrow screens, send valid volume-pricing requests from product pages, preserve review photo and search synonym arrays through compiled storage with valid PostgreSQL array constraints, align search synonym rows across supported viewports, keep compiled reads and transactional row locks deterministic without recursion, and request pickup windows only after a shopper selects a location.
