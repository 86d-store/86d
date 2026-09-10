---
"@86d-store/revenue": patch
"@86d-store/analytics": patch
"@86d-store/ui": patch
"@86d-store/products": patch
"@86d-store/reviews": patch
"@86d-store/store-pickup": patch
"@86d-store/core": patch
"@86d-store/search": patch
"@86d-store/runtime": patch
---

Fix the Analytics and Revenue admin runtimes, keep merchant semantic colors WCAG AA compliant through shared hover states, keep product-list controls and table columns reachable on narrow screens, send valid volume-pricing requests from product pages, preserve review photo and search synonym arrays through compiled storage with valid PostgreSQL array constraints, align search synonym rows across supported viewports, keep compiled reads and transactional row locks deterministic without recursion, and request pickup windows only after a shopper selects a location.
