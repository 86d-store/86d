---
"@86d-app/core": major
"@86d-app/runtime": major
"@86d-app/abandoned-carts": major
"@86d-app/automations": major
"@86d-app/braintree": major
"@86d-app/cart": major
"@86d-app/checkout": major
"@86d-app/customers": major
"@86d-app/discounts": major
"@86d-app/gift-wrapping": major
"@86d-app/giftcards": major
"@86d-app/inventory": major
"@86d-app/multi-currency": major
"@86d-app/notifications": major
"@86d-app/order-notes": major
"@86d-app/orders": major
"@86d-app/payments": major
"@86d-app/paypal": major
"@86d-app/price-lists": major
"@86d-app/products": major
"@86d-app/returns": major
"@86d-app/revenue": major
"@86d-app/reviews": major
"@86d-app/shipping": major
"@86d-app/square": major
"@86d-app/store-credits": major
"@86d-app/stripe": major
"@86d-app/subscriptions": major
"@86d-app/tax": major
"@86d-app/tipping": major
---

Replace Module-visible cross-data and aggregate-controller access with owner-scoped contexts and versioned, runtime-validated capabilities. Required capabilities now fail admission before initialization effects, each consumer is restricted to its accepted operations, provider requests and outcomes are validated at both contract boundaries, and commerce call sites fail closed through typed owner decisions. Paid subscription activation remains unavailable until payment proof consumption is purpose-bound and duplicate-safe.
