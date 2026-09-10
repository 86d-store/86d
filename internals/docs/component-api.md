# Component API Reference

Auto-generated from module source files. Run `bun run generate:docs` to regenerate.

Generated: 2026-09-10  
Modules with components: 100

---

## Quick start

Add components to your MDX templates by importing them from the module system.
Modules must be listed in `templates/brisa/config.json` to be available.

```mdx
{/* templates/brisa/index.mdx */}
<FeaturedProducts limit={4} title="Featured" />
<CollectionGrid title="Shop by collection" featured />
<NewsletterInline source="homepage" />
```

---

## Modules

- [`@86d-store/abandoned-carts`](#86d-storeabandoned-carts) — 1 store, 1 admin components
- [`@86d-store/affiliates`](#86d-storeaffiliates) — 2 store, 4 admin components
- [`@86d-store/amazon`](#86d-storeamazon) — 2 admin components
- [`@86d-store/analytics`](#86d-storeanalytics) — 2 admin components
- [`@86d-store/announcements`](#86d-storeannouncements) — 3 store, 3 admin components
- [`@86d-store/appointments`](#86d-storeappointments) — 2 store, 4 admin components
- [`@86d-store/auctions`](#86d-storeauctions) — 3 store, 2 admin components
- [`@86d-store/audit-log`](#86d-storeaudit-log) — 2 admin components
- [`@86d-store/automations`](#86d-storeautomations) — 2 admin components
- [`@86d-store/backorders`](#86d-storebackorders) — 2 store, 2 admin components
- [`@86d-store/blog`](#86d-storeblog) — 2 store, 1 admin components
- [`@86d-store/braintree`](#86d-storebraintree) — 1 admin component
- [`@86d-store/brands`](#86d-storebrands) — 2 store, 1 admin components
- [`@86d-store/bulk-pricing`](#86d-storebulk-pricing) — 1 store, 2 admin components
- [`@86d-store/bundles`](#86d-storebundles) — 2 store, 1 admin components
- [`@86d-store/cart`](#86d-storecart) — 5 store, 3 admin components
- [`@86d-store/checkout`](#86d-storecheckout) — 7 store, 2 admin components
- [`@86d-store/collections`](#86d-storecollections) — 2 store, 1 admin components
- [`@86d-store/comparisons`](#86d-storecomparisons) — 2 store, 1 admin components
- [`@86d-store/customer-groups`](#86d-storecustomer-groups) — 2 store, 2 admin components
- [`@86d-store/customers`](#86d-storecustomers) — 2 store, 3 admin components
- [`@86d-store/delivery-slots`](#86d-storedelivery-slots) — 1 store, 4 admin components
- [`@86d-store/digital-downloads`](#86d-storedigital-downloads) — 3 store, 1 admin components
- [`@86d-store/discounts`](#86d-storediscounts) — 4 store, 5 admin components
- [`@86d-store/doordash`](#86d-storedoordash) — 1 store, 1 admin components
- [`@86d-store/ebay`](#86d-storeebay) — 1 admin component
- [`@86d-store/etsy`](#86d-storeetsy) — 1 admin component
- [`@86d-store/facebook-shop`](#86d-storefacebook-shop) — 1 admin component
- [`@86d-store/faq`](#86d-storefaq) — 2 store, 4 admin components
- [`@86d-store/favor`](#86d-storefavor) — 1 store, 1 admin components
- [`@86d-store/flash-sales`](#86d-storeflash-sales) — 6 store, 2 admin components
- [`@86d-store/forms`](#86d-storeforms) — 2 store, 4 admin components
- [`@86d-store/fulfillment`](#86d-storefulfillment) — 3 store, 1 admin components
- [`@86d-store/gamification`](#86d-storegamification) — 1 store, 2 admin components
- [`@86d-store/gift-registry`](#86d-storegift-registry) — 2 store, 2 admin components
- [`@86d-store/gift-wrapping`](#86d-storegift-wrapping) — 1 store, 2 admin components
- [`@86d-store/giftcards`](#86d-storegiftcards) — 2 store, 8 admin components
- [`@86d-store/google-shopping`](#86d-storegoogle-shopping) — 1 admin component
- [`@86d-store/import-export`](#86d-storeimport-export) — 2 admin components
- [`@86d-store/instagram-shop`](#86d-storeinstagram-shop) — 1 admin component
- [`@86d-store/inventory`](#86d-storeinventory) — 3 store, 2 admin components
- [`@86d-store/invoices`](#86d-storeinvoices) — 2 store, 3 admin components
- [`@86d-store/kiosk`](#86d-storekiosk) — 1 store, 11 admin components
- [`@86d-store/loyalty`](#86d-storeloyalty) — 4 store, 3 admin components
- [`@86d-store/media`](#86d-storemedia) — 3 store, 1 admin components
- [`@86d-store/memberships`](#86d-storememberships) — 3 store, 2 admin components
- [`@86d-store/multi-currency`](#86d-storemulti-currency) — 2 store, 3 admin components
- [`@86d-store/navigation`](#86d-storenavigation) — 3 store, 1 admin components
- [`@86d-store/newsletter`](#86d-storenewsletter) — 3 store, 2 admin components
- [`@86d-store/notifications`](#86d-storenotifications) — 3 store, 4 admin components
- [`@86d-store/order-notes`](#86d-storeorder-notes) — 1 store, 1 admin components
- [`@86d-store/orders`](#86d-storeorders) — 4 store, 5 admin components
- [`@86d-store/pages`](#86d-storepages) — 2 store, 1 admin components
- [`@86d-store/payments`](#86d-storepayments) — 1 store, 1 admin components
- [`@86d-store/paypal`](#86d-storepaypal) — 1 admin component
- [`@86d-store/photo-booth`](#86d-storephoto-booth) — 2 store, 2 admin components
- [`@86d-store/pinterest-shop`](#86d-storepinterest-shop) — 1 admin component
- [`@86d-store/preorders`](#86d-storepreorders) — 5 store, 2 admin components
- [`@86d-store/price-lists`](#86d-storeprice-lists) — 2 store, 3 admin components
- [`@86d-store/product-feeds`](#86d-storeproduct-feeds) — 2 admin components
- [`@86d-store/product-labels`](#86d-storeproduct-labels) — 1 store, 1 admin components
- [`@86d-store/product-qa`](#86d-storeproduct-qa) — 4 store, 3 admin components
- [`@86d-store/products`](#86d-storeproducts) — 1 store, 10 admin components
- [`@86d-store/qr-code`](#86d-storeqr-code) — 1 store, 2 admin components
- [`@86d-store/quotes`](#86d-storequotes) — 3 store, 2 admin components
- [`@86d-store/recently-viewed`](#86d-storerecently-viewed) — 2 store, 1 admin components
- [`@86d-store/recommendations`](#86d-storerecommendations) — 2 store, 2 admin components
- [`@86d-store/redirects`](#86d-storeredirects) — 1 admin component
- [`@86d-store/referrals`](#86d-storereferrals) — 3 store, 3 admin components
- [`@86d-store/returns`](#86d-storereturns) — 1 store, 2 admin components
- [`@86d-store/revenue`](#86d-storerevenue) — 1 store, 1 admin components
- [`@86d-store/reviews`](#86d-storereviews) — 8 store, 3 admin components
- [`@86d-store/saved-addresses`](#86d-storesaved-addresses) — 1 store, 1 admin components
- [`@86d-store/search`](#86d-storesearch) — 3 store, 1 admin components
- [`@86d-store/seo`](#86d-storeseo) — 3 store, 1 admin components
- [`@86d-store/settings`](#86d-storesettings) — 5 admin components
- [`@86d-store/shipping`](#86d-storeshipping) — 3 store, 3 admin components
- [`@86d-store/sitemap`](#86d-storesitemap) — 1 admin component
- [`@86d-store/social-proof`](#86d-storesocial-proof) — 3 store, 1 admin components
- [`@86d-store/social-sharing`](#86d-storesocial-sharing) — 1 store, 1 admin components
- [`@86d-store/square`](#86d-storesquare) — 1 admin component
- [`@86d-store/store-credits`](#86d-storestore-credits) — 3 store, 2 admin components
- [`@86d-store/store-locator`](#86d-storestore-locator) — 2 store, 3 admin components
- [`@86d-store/store-pickup`](#86d-storestore-pickup) — 1 store, 3 admin components
- [`@86d-store/stripe`](#86d-storestripe) — 1 admin component
- [`@86d-store/subscriptions`](#86d-storesubscriptions) — 4 store, 1 admin components
- [`@86d-store/tax`](#86d-storetax) — 2 store, 2 admin components
- [`@86d-store/tickets`](#86d-storetickets) — 3 store, 4 admin components
- [`@86d-store/tiktok-shop`](#86d-storetiktok-shop) — 1 admin component
- [`@86d-store/tipping`](#86d-storetipping) — 1 store, 2 admin components
- [`@86d-store/toast`](#86d-storetoast) — 1 admin component
- [`@86d-store/uber-direct`](#86d-storeuber-direct) — 1 store, 1 admin components
- [`@86d-store/uber-eats`](#86d-storeuber-eats) — 1 admin component
- [`@86d-store/vendors`](#86d-storevendors) — 3 store, 2 admin components
- [`@86d-store/waitlist`](#86d-storewaitlist) — 3 store, 1 admin components
- [`@86d-store/walmart`](#86d-storewalmart) — 1 admin component
- [`@86d-store/warranties`](#86d-storewarranties) — 2 store, 2 admin components
- [`@86d-store/wish`](#86d-storewish) — 1 admin component
- [`@86d-store/wishlist`](#86d-storewishlist) — 3 store, 1 admin components
- [`@86d-store/x-shop`](#86d-storex-shop) — 1 admin component

---

## `@86d-store/abandoned-carts`

Tracks abandoned shopping carts and manages multi-channel recovery campaigns (email, SMS, push).

### Store components

Use in MDX template files:

#### `CartRecovery`

```mdx
<CartRecovery />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `AbandonedCartOverview`


---

## `@86d-store/affiliates`

Affiliate marketing program — partners promote products for commission on sales.

### Store components

Use in MDX template files:

#### `AffiliateApply`

```mdx
<AffiliateApply />
```

#### `AffiliateDashboard`

```mdx
<AffiliateDashboard />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `AffiliateList`

#### `ApplicationList`

#### `ConversionList`

#### `PayoutList`


---

## `@86d-store/amazon`

Amazon Seller Central integration for listing management, order fulfillment, and inventory sync.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `AmazonAdmin`

#### `AmazonInventory`


---

## `@86d-store/analytics`

Event tracking and reporting for the 86d store. Records page views, product views, cart events, purchases, and custom events. Provides admin endpoints for stats, top-product reports, and raw event access.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `AnalyticsAdmin`

#### `AnalyticsSettings`


---

## `@86d-store/announcements`

Site-wide announcement bars, promotional banners, and popup notices with scheduling, audience targeting, and engagement analytics.

### Store components

Use in MDX template files:

#### `AnnouncementBanner`

```mdx
<AnnouncementBanner />
```

#### `AnnouncementBar`

```mdx
<AnnouncementBar />
```

#### `AnnouncementPopup`

```mdx
<AnnouncementPopup />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `AnnouncementDetail`

#### `AnnouncementForm`

#### `AnnouncementList`


---

## `@86d-store/appointments`

Service-based booking with staff scheduling, time-slot availability, and customer appointment management. Enables stores to offer bookable services (salons, consultations, classes, etc.).

### Store components

Use in MDX template files:

#### `AppointmentBooking`

```mdx
<AppointmentBooking />
```

#### `MyAppointments`

```mdx
<MyAppointments />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `AppointmentDetail`

#### `AppointmentList`

#### `ServiceList`

#### `StaffList`


---

## `@86d-store/auctions`

Time-limited product auctions with bidding, reserve prices, and buy-it-now.

### Store components

Use in MDX template files:

#### `AuctionListing`

```mdx
<AuctionListing />
```

#### `AuctionPage`

```mdx
<AuctionPage />
```

#### `AuctionsHomepageSection`

```mdx
<AuctionsHomepageSection />
```

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `limit` | `number` | No | Max number of auctions to display. Defaults to 4. |

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `AuctionDetail`

#### `AuctionsList`


---

## `@86d-store/audit-log`

Records admin actions, system events, and API key usage for security auditing, compliance, and accountability.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `AuditLogDetail`

#### `AuditLogList`


---

## `@86d-store/automations`

Event-driven workflow automation. Rules trigger on platform events, evaluate conditions, and execute configurable actions.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `AutomationDetail`

#### `AutomationList`


---

## `@86d-store/backorders`

Manages backorder requests when customers purchase out-of-stock products. Tracks the full lifecycle from request to delivery, with configurable per-product policies.

### Store components

Use in MDX template files:

#### `BackorderButton`

```mdx
<BackorderButton />
```

#### `MyBackorders`

```mdx
<MyBackorders />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `BackorderList`

#### `BackorderPolicies`


---

## `@86d-store/blog`

Content management for blog posts with drafts, scheduled publishing, featured posts, view tracking, and markdown rendering for store pages.

### Store components

Use in MDX template files:

#### `BlogList`

```mdx
<BlogList />
```

#### `BlogPostDetail`

```mdx
<BlogPostDetail />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `BlogAdmin`


---

## `@86d-store/braintree`

Braintree payment provider implementing the `PaymentProvider` interface from `@86d-store/payments`.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `BraintreeAdmin`


---

## `@86d-store/brands`

Product brand management. Organize products by manufacturer or brand with brand pages, featured brands, and SEO metadata.

### Store components

Use in MDX template files:

#### `BrandList`

```mdx
<BrandList />
```

#### `FeaturedBrands`

```mdx
<FeaturedBrands />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `BrandAdmin`


---

## `@86d-store/bulk-pricing`

Quantity-based tiered pricing module. Define rules that give customers lower per-unit prices when they buy in larger quantities.

### Store components

Use in MDX template files:

#### `BulkPricingTiers`

```mdx
<BulkPricingTiers productId="..." basePriceInCents={0} />
```

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `productId` | `string` | Yes | Product ID to show tiers for |
| `basePriceInCents` | `number` | Yes | Base price in cents |
| `title` | `string \| undefined` | No | Section title |
| `quantity` | `number \| undefined` | No | Currently selected quantity (highlights the active tier) |

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `BulkPricingDetail`

#### `BulkPricingList`


---

## `@86d-store/bundles`

Groups products into discounted bundles with fixed-price or percentage-off pricing and date-based availability.

### Store components

Use in MDX template files:

#### `BundleDetail`

```mdx
<BundleDetail />
```

#### `BundleList`

```mdx
<BundleList />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `BundleOverview`


---

## `@86d-store/cart`

Shopping cart for guest and registered customers. Supports adding, updating, removing items and cart expiration.

### Store components

Use in MDX template files:

#### `Cart`

```mdx
<Cart />
```

#### `CartButton`

```mdx
<CartButton />
```

#### `CartDrawerInner`

```mdx
<CartDrawerInner />
```

#### `CartFloatingPill`

```mdx
<CartFloatingPill />
```

#### `CartPage`

```mdx
<CartPage />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `AbandonedCarts`

#### `CartDetail`

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `cartId` | `string` | No |  |
| `params` | `Record<string, string>` | No |  |

#### `CartList`


---

## `@86d-store/checkout`

Checkout session management: cart-to-order conversion flow. Handles session creation, address collection, discount application, payment coordination, and authoritative Order creation. It has customer-facing endpoints plus bounded Store Admin maintenance endpoints.

### Store components

Use in MDX template files:

#### `CheckoutForm`

```mdx
<CheckoutForm />
```

#### `CheckoutInformation`

```mdx
<CheckoutInformation />
```

#### `CheckoutPayment`

```mdx
<CheckoutPayment />
```

#### `CheckoutReview`

```mdx
<CheckoutReview />
```

#### `CheckoutShipping`

```mdx
<CheckoutShipping />
```

#### `CheckoutSummary`

```mdx
<CheckoutSummary />
```

#### `OrderConfirmation`

```mdx
<OrderConfirmation />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `CheckoutDetail`

#### `CheckoutList`


---

## `@86d-store/collections`

Curated product collections for merchandising. Supports manual (hand-picked) and automatic (rule-based) groupings with featured collection highlighting, SEO fields, and drag-and-drop product ordering.

### Store components

Use in MDX template files:

#### `CollectionList`

```mdx
<CollectionList />
```

#### `FeaturedCollections`

```mdx
<FeaturedCollections />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `CollectionAdmin`


---

## `@86d-store/comparisons`

Product comparison for side-by-side feature/price/attribute comparison. Supports guest and registered customers with configurable product limits.

### Store components

Use in MDX template files:

#### `ComparisonBar`

```mdx
<ComparisonBar />
```

#### `ComparisonTable`

```mdx
<ComparisonTable />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `ComparisonAdmin`


---

## `@86d-store/customer-groups`

Customer segmentation with manual/automatic groups, rule-based membership, and group-specific price adjustments. Enables B2B wholesale, VIP tiers, and targeted pricing.

### Store components

Use in MDX template files:

#### `CustomerGroupMembership`

```mdx
<CustomerGroupMembership />
```

#### `CustomerGroupPricing`

```mdx
<CustomerGroupPricing />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `CustomerGroupDetail`

#### `CustomerGroupList`


---

## `@86d-store/customers`

Customer profile and address management. Supports authenticated customers viewing/editing their profile and addresses, plus admin access to all customers.

### Store components

Use in MDX template files:

#### `AccountProfile`

```mdx
<AccountProfile />
```

#### `AddressBook`

```mdx
<AddressBook />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `CustomerDetail`

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `customerId` | `string` | No |  |
| `params` | `Record<string, string>` | No |  |

#### `CustomerList`

#### `CustomerTags`


---

## `@86d-store/delivery-slots`

Scheduled delivery time windows by day of week with capacity limits, surcharges, and blackout dates.

### Store components

Use in MDX template files:

#### `SlotPicker`

```mdx
<SlotPicker />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `BlackoutList`

#### `BookingList`

#### `ScheduleDetail`

#### `ScheduleList`


---

## `@86d-store/digital-downloads`

File delivery via secure, expiring download tokens. Associates downloadable files with products and generates single-use or limited-use tokens for order fulfillment. Supports batch token creation for orders with multiple digital products.

### Store components

Use in MDX template files:

#### `DownloadButton`

```mdx
<DownloadButton />
```

#### `DownloadRow`

```mdx
<DownloadRow />
```

#### `MyDownloads`

```mdx
<MyDownloads />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `DownloadsAdmin`


---

## `@86d-store/discounts`

Discount and promo code management. Supports percentage, fixed-amount, and free-shipping discount types with optional applies-to filters (all, products, categories). Standalone — no dependencies on other modules.

### Store components

Use in MDX template files:

#### `AutoAppliedSavings`

```mdx
<AutoAppliedSavings />
```

#### `CartDiscounts`

```mdx
<CartDiscounts />
```

#### `DiscountBanner`

```mdx
<DiscountBanner />
```

#### `DiscountCodeInput`

```mdx
<DiscountCodeInput />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `DiscountAnalytics`

#### `DiscountDetail`

#### `DiscountForm`

#### `DiscountList`

#### `PriceRuleAdmin`


---

## `@86d-store/doordash`

DoorDash delivery integration with zone-based availability, delivery tracking, and driver info.

### Store components

Use in MDX template files:

#### `DeliveryChecker`

```mdx
<DeliveryChecker />
```

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `currency` | `string` | No |  |

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `DoorDashAdmin`


---

## `@86d-store/ebay`

eBay marketplace integration for fixed-price and auction listings, order management, and channel analytics.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `EbayAdmin`


---

## `@86d-store/etsy`

Etsy marketplace integration for handmade/vintage listing management, orders, reviews, and shop analytics.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `EtsyAdmin`


---

## `@86d-store/facebook-shop`

Facebook/Meta Commerce integration for catalog sync, product listings, order management, and collections.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `FacebookShopAdmin`


---

## `@86d-store/faq`

Self-service knowledge base with categorized questions, full-text search, and helpfulness voting.

### Store components

Use in MDX template files:

#### `FaqAccordion`

```mdx
<FaqAccordion />
```

#### `FaqSearch`

```mdx
<FaqSearch />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `FaqCategories`

#### `FaqCategoryDetail`

#### `FaqDetail`

#### `FaqList`


---

## `@86d-store/favor`

Favor delivery integration with zip-code-based service areas, runner tracking, and delivery stats.

### Store components

Use in MDX template files:

#### `DeliveryCheck`

```mdx
<DeliveryCheck />
```

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `currency` | `string` | No |  |

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `FavorAdmin`


---

## `@86d-store/flash-sales`

Time-limited promotional events with per-product sale pricing, stock limits, and countdown support. Creates urgency-driven shopping experiences.

### Store components

Use in MDX template files:

#### `Countdown`

```mdx
<Countdown endsAt="string" />
```

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `endsAt` | `string \| Date` | Yes |  |
| `label` | `string` | No |  |
| `onExpire` | `() => void` | No |  |

#### `FlashDealBadge`

```mdx
<FlashDealBadge productId="..." />
```

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `productId` | `string` | Yes |  |

#### `FlashSaleDetail`

```mdx
<FlashSaleDetail />
```

#### `FlashSaleListing`

```mdx
<FlashSaleListing />
```

#### `FlashSaleProductCard`

```mdx
<FlashSaleProductCard />
```

#### `FlashSalesHomepageSection`

```mdx
<FlashSalesHomepageSection />
```

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `productLimit` | `number` | No | Max number of products to show per sale. Defaults to 4. |
| `saleLimit` | `number` | No | Max number of sales to show. Defaults to 1. |

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `FlashSaleDetail`

#### `FlashSaleList`


---

## `@86d-store/forms`

Custom forms for contact, surveys, inquiries, and feedback. Merchants create form definitions with configurable fields; customers submit responses via store endpoints.

### Store components

Use in MDX template files:

#### `FormEmbed`

```mdx
<FormEmbed />
```

#### `FormList`

```mdx
<FormList />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `FormCreate`

#### `FormDetail`

#### `FormSubmissions`

#### `FormsList`


---

## `@86d-store/fulfillment`

Authoritative delivery-obligation foundation with quantity-validated creation. Shipping owns parcels, labels, and tracking; Orders owns only the accepted commercial lines. Direct status, tracking, and cancellation transport is contained until durable workflows own those transitions.

### Store components

Use in MDX template files:

#### `FulfillmentSummary`

```mdx
<FulfillmentSummary orderId="..." />
```

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `orderId` | `string` | Yes | Order ID to look up fulfillments for. |

#### `FulfillmentTracker`

```mdx
<FulfillmentTracker status={...} createdAt="string" />
```

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `status` | `FulfillmentStatus` | Yes | Current fulfillment status. |
| `createdAt` | `string \| Date` | Yes | When the fulfillment was created. |
| `shippedAt` | `string \| Date \| null` | No | When it was shipped, if applicable. |
| `deliveredAt` | `string \| Date \| null` | No | When it was delivered, if applicable. |

#### `TrackingInfo`

```mdx
<TrackingInfo status={...} />
```

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `status` | `FulfillmentStatus` | Yes | Current fulfillment status. |
| `carrier` | `string \| null` | No | Carrier name (e.g. UPS, FedEx). |
| `trackingNumber` | `string \| null` | No | Tracking number. |
| `trackingUrl` | `string \| null` | No | Full tracking URL. |

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `FulfillmentAdmin`


---

## `@86d-store/gamification`

Spin-to-win, scratch-off, and slot-machine games with prize management and play-rate limiting.

### Store components

Use in MDX template files:

#### `GameWidget`

```mdx
<GameWidget />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `GameList`

#### `GamificationAdmin`


---

## `@86d-store/gift-registry`

Customer-created gift registries (wedding, baby, birthday, etc.) that visitors can purchase from.

### Store components

Use in MDX template files:

#### `RegistryBrowse`

```mdx
<RegistryBrowse />
```

#### `RegistryPage`

```mdx
<RegistryPage />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `RegistriesList`

#### `RegistryDetail`


---

## `@86d-store/gift-wrapping`

Add-on gift wrapping options for order items with custom messages and recipient names.

### Store components

Use in MDX template files:

#### `WrapOptionBrowse`

```mdx
<WrapOptionBrowse />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `WrapOptionDetail`

#### `WrapOptionList`


---

## `@86d-store/giftcards`

Read-only gift card records, balance and status lookup, owned-card delivery metadata, and analytics. Issuance, funding, redemption, status mutation, and deletion stay unavailable until complete Workflows own those operations with durable evidence.

### Store components

Use in MDX template files:

#### `GiftCardBalance`

```mdx
<GiftCardBalance />
```

#### `GiftCardLanding`

```mdx
<GiftCardLanding />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `GiftCardDataTable`

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `cards` | `GiftCardAdminRecord[]` | Yes |  |
| `total` | `number` | Yes |  |
| `isLoading` | `boolean` | No |  |
| `pageSize` | `number` | Yes |  |
| `skip` | `number` | Yes |  |
| `stateController` | `GiftCardTableStateController` | Yes |  |
| `onStatusFilterChange` | `(value: string) => void` | Yes |  |
| `onView` | `(id: string) => void` | Yes |  |
| `onPreviousPage` | `() => void` | Yes |  |
| `onNextPage` | `() => void` | Yes |  |

#### `GiftCardDetailContent`

#### `GiftCardListError`

#### `GiftCardOverview`

#### `GiftCardRowActions`

#### `GiftCardStatsPanel`

#### `GiftCardStatusBadge`

#### `ReadOnlyNotice`


---

## `@86d-store/google-shopping`

Integrates with Google Merchant Center for product feed management, feed submissions, order handling, and diagnostics.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `GoogleShoppingAdmin`


---

## `@86d-store/import-export`

Manages bulk data import and export jobs for products, customers, orders, and inventory.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `ImportDetail`

#### `ImportExportOverview`


---

## `@86d-store/instagram-shop`

Instagram Shopping integration for product listings, media tagging, catalog sync, and order management.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `InstagramShopAdmin`


---

## `@86d-store/inventory`

Stock tracking for products across variants and locations. Supports reservations, deductions, low-stock alerts, back-in-stock subscriptions, and backorder control.

### Store components

Use in MDX template files:

#### `BackInStockForm`

```mdx
<BackInStockForm />
```

#### `StockAvailability`

```mdx
<StockAvailability />
```

#### `StockStatus`

```mdx
<StockStatus />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `BackInStockAdmin`

#### `InventoryList`


---

## `@86d-store/invoices`

Invoice lifecycle management with payment terms, partial payments, credit notes, and configurable numbering.

### Store components

Use in MDX template files:

#### `InvoiceHistory`

```mdx
<InvoiceHistory />
```

#### `InvoiceTracker`

```mdx
<InvoiceTracker />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `InvoiceDetail`

#### `InvoiceList`

#### `OverdueList`


---

## `@86d-store/kiosk`

Kiosk station registration and legacy lifecycle-record inspection. The public terminal is a static unavailable surface. Public sessions, health, commerce actions, and station deletion remain unavailable until complete authoritative Workflows own them.

### Store components

Use in MDX template files:

#### `KioskTerminal`

```mdx
<KioskTerminal />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `CREATE_STATION_AMBIGUOUS_ERROR`

#### `KioskAdmin`

#### `KioskStations`

#### `KioskUnavailableState`

#### `SessionDataTable`

#### `SessionStatusBadge`

#### `StationDataTable`

#### `StationRegistrationBadge`

#### `StationRowActions`

#### `StationSheet`

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `station` | `AdminKioskStation` | No |  |
| `onSaved` | `() => void` | Yes |  |
| `onCancel` | `() => void` | Yes |  |

#### `UPDATE_STATION_ERROR`


---

## `@86d-store/loyalty`

Points-based loyalty program with tiered rewards, earning rules, and order-event integration.

### Store components

Use in MDX template files:

#### `LoyaltyPage`

```mdx
<LoyaltyPage />
```

#### `PointsBalance`

```mdx
<PointsBalance />
```

#### `PointsHistory`

```mdx
<PointsHistory />
```

#### `TierProgress`

```mdx
<TierProgress />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `LoyaltyOverview`

#### `LoyaltyRules`

#### `LoyaltyTiers`


---

## `@86d-store/media`

Digital asset management with folder organization, tagging, bulk operations, and store-facing display components.

### Store components

Use in MDX template files:

#### `ImageDisplay`

```mdx
<ImageDisplay id="..." />
```

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | Yes | Asset ID to display |
| `className` | `string` | No | Optional CSS class for the container |
| `showCaption` | `boolean` | No | Show caption below the image |

#### `MediaGallery`

```mdx
<MediaGallery />
```

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `folder` | `string` | No | Filter by folder ID |
| `type` | `string` | No | Filter by MIME type prefix (e.g. "image", "video") |
| `tag` | `string` | No | Filter by tag |
| `pageSize` | `number` | No | Number of items per page |

#### `VideoPlayer`

```mdx
<VideoPlayer id="..." />
```

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | Yes | Asset ID of the video |
| `autoPlay` | `boolean` | No | Auto-play (muted) when visible |
| `loop` | `boolean` | No | Loop playback |
| `className` | `string` | No | Optional CSS class for the container |

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `MediaAdmin`


---

## `@86d-store/memberships`

Paid membership plans with exclusive benefits, gated products, and member pricing. Customers subscribe to plans that grant access to restricted products and perks like discounts and free shipping.

### Store components

Use in MDX template files:

#### `MyMembership`

```mdx
<MyMembership />
```

#### `PlanDetail`

```mdx
<PlanDetail />
```

#### `PlanListing`

```mdx
<PlanListing />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `MembershipAdmin`

#### `MembershipPlans`


---

## `@86d-store/multi-currency`

Manages multiple currencies, exchange rates, price conversions, and per-product price overrides for international commerce.

### Store components

Use in MDX template files:

#### `CurrencySelector`

```mdx
<CurrencySelector />
```

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `string \| undefined` | No | Currently selected currency code (ISO 4217) |
| `onChange` | `((code: string) => void) \| undefined` | No | Called when user selects a different currency |
| `compact` | `boolean \| undefined` | No | Show compact mode (code only, no name) |

#### `PriceDisplay`

```mdx
<PriceDisplay basePriceInCents={0} />
```

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `productId` | `string \| undefined` | No | Product ID for price override lookup |
| `basePriceInCents` | `number` | Yes | Base price in cents (smallest unit of base currency) |
| `currencyCode` | `string \| undefined` | No | Target currency code (ISO 4217) |
| `compareAtPriceInCents` | `number \| undefined` | No | Compare-at price in cents (for sale display) |
| `className` | `string \| undefined` | No | Additional CSS class for the container |

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `CurrencyDetail`

#### `CurrencyForm`

#### `CurrencyList`


---

## `@86d-store/navigation`

Manages store navigation menus (header, footer, sidebar, mobile) with nested menu items supporting links, categories, collections, pages, and products.

### Store components

Use in MDX template files:

#### `NavFooter`

```mdx
<NavFooter />
```

#### `NavMenu`

```mdx
<NavMenu />
```

#### `NavMobileMenu`

```mdx
<NavMobileMenu />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `NavigationAdmin`


---

## `@86d-store/newsletter`

Manages an email subscriber list. Does NOT send emails — that is left to external integrations. Simply manages the subscriber database.

### Store components

Use in MDX template files:

#### `NewsletterForm`

```mdx
<NewsletterForm />
```

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `showName` | `boolean \| undefined` | No |  |
| `source` | `string \| undefined` | No |  |
| `title` | `string \| undefined` | No |  |
| `description` | `string \| undefined` | No |  |
| `compact` | `boolean \| undefined` | No |  |

#### `NewsletterInline`

```mdx
<NewsletterInline />
```

#### `NewsletterUnsubscribe`

```mdx
<NewsletterUnsubscribe />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `CampaignAdmin`

#### `NewsletterAdmin`


---

## `@86d-store/notifications`

In-app and email notification system with templates, batch send, priority levels, event emission, and per-customer preferences.

### Store components

Use in MDX template files:

#### `NotificationBell`

```mdx
<NotificationBell />
```

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `href` | `string \| undefined` | No |  |

#### `NotificationInbox`

```mdx
<NotificationInbox />
```

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `title` | `string \| undefined` | No |  |
| `emptyMessage` | `string \| undefined` | No |  |

#### `NotificationPreferences`

```mdx
<NotificationPreferences />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `NotificationComposer`

#### `NotificationList`

#### `NotificationSettings`

#### `NotificationTemplateList`


---

## `@86d-store/order-notes`

Notes and comments on orders from customers, admins, and system events. Supports internal (admin-only) notes, pinning, and per-author access control.

### Store components

Use in MDX template files:

#### `OrderNotes`

```mdx
<OrderNotes />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `OrderNotesOverview`


---

## `@86d-store/orders`

Order ownership and compatibility reads for the accepted commercial agreement. Competing Fulfillment/Return writers, destructive bulk operations, and identifier-plus-email guest lookup are contained.

### Store components

Use in MDX template files:

#### `OrderDetail`

```mdx
<OrderDetail />
```

#### `OrderHistory`

```mdx
<OrderHistory />
```

#### `OrderReturns`

```mdx
<OrderReturns />
```

#### `OrderTracker`

```mdx
<OrderTracker />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `OrderActivity`

#### `OrderDetail`

#### `OrderInvoice`

#### `OrderList`

#### `ReturnList`


---

## `@86d-store/pages`

CMS-style static pages with draft/published/archived workflow, hierarchical structure, and optional navigation visibility.

### Store components

Use in MDX template files:

#### `PageDetail`

```mdx
<PageDetail />
```

#### `PageListing`

```mdx
<PageListing />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `PagesAdmin`


---

## `@86d-store/payments`

Provider-neutral payment ownership. The legacy v1 controller tracks payment intents, saved payment methods, and refunds. The additive v2 boundary owns named Payment Connections and durable connection-bound provider operations without exposing live shopper routes.

### Store components

Use in MDX template files:

#### `SavedPaymentMethods`

```mdx
<SavedPaymentMethods />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `PaymentsAdmin`


---

## `@86d-store/paypal`

PayPal Third-party Payment Integration. The connection-bound adapter implements the durable provider-neutral contract; the singleton provider remains migration compatibility only.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `PayPalAdmin`


---

## `@86d-store/photo-booth`

Event photo capture with sessions, live streams, and email/SMS delivery.

### Store components

Use in MDX template files:

#### `PhotoGallery`

```mdx
<PhotoGallery />
```

#### `PhotoStream`

```mdx
<PhotoStream streamId="..." />
```

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `streamId` | `string` | Yes | Stream ID to display |
| `refreshInterval` | `number` | No | Auto-refresh interval in milliseconds (0 = no auto-refresh, default: 10000) |

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `PhotoBoothAdmin`

#### `PhotoStreamList`


---

## `@86d-store/pinterest-shop`

Integrates with Pinterest for catalog management, shopping pin creation, and pin analytics tracking.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `PinterestShopAdmin`


---

## `@86d-store/preorders`

Manages preorder campaigns for upcoming or limited-edition products. Supports full payment and deposit-based preorders with quantity limits, estimated ship dates, and customer notifications.

### Store components

Use in MDX template files:

#### `CampaignDetail`

```mdx
<CampaignDetail />
```

#### `CampaignList`

```mdx
<CampaignList />
```

#### `MyPreorders`

```mdx
<MyPreorders />
```

#### `PreorderButton`

```mdx
<PreorderButton />
```

#### `PreordersHomepageSection`

```mdx
<PreordersHomepageSection />
```

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `limit` | `number` | No | Max number of campaigns to show. Defaults to 3. |

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `CampaignDetail`

#### `CampaignList`


---

## `@86d-store/price-lists`

Tiered and group-specific pricing for products. Supports multiple price lists with priority-based resolution, quantity tiers, currency filtering, and customer group targeting.

### Store components

Use in MDX template files:

#### `PriceDisplay`

```mdx
<PriceDisplay />
```

#### `PriceListTable`

```mdx
<PriceListTable />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `PriceListAdmin`

#### `PriceListCreate`

#### `PriceListDetail`


---

## `@86d-store/product-feeds`

Product feed generation for shopping channels (Google Shopping, Facebook/Meta, Microsoft, Pinterest, TikTok, custom).

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `ProductFeedDetail`

#### `ProductFeedsOverview`


---

## `@86d-store/product-labels`

Visual labels and badges for products — "New", "Sale", "Best Seller", "Limited Edition", etc. Supports scheduled labels, conditional assignment rules, and bulk operations.

### Store components

Use in MDX template files:

#### `ProductBadges`

```mdx
<ProductBadges />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `LabelAdmin`


---

## `@86d-store/product-qa`

Product-specific questions and answers for customer-facing product pages. Distinct from reviews (ratings), FAQ (store-wide), and tickets (private support).

### Store components

Use in MDX template files:

#### `AnswerList`

```mdx
<AnswerList />
```

#### `ProductQuestions`

```mdx
<ProductQuestions />
```

#### `QuestionCard`

```mdx
<QuestionCard />
```

#### `QuestionForm`

```mdx
<QuestionForm />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `QaAnalytics`

#### `QuestionDetail`

#### `QuestionList`


---

## `@86d-store/products`

Product and Variant catalog with accepted Categories. New price writes use integer minor units. Inventory is authoritative for stock, and Collections is authoritative for Collection writes; the similarly named Products fields/tables are temporary read projections. Direct spreadsheet import is contained until the reviewed revision pipeline exists.

### Store components

Use in MDX template files:

#### `ProductCard`

```mdx
<ProductCard />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `CategoriesAdmin`

#### `CategoryForm`

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `categoryId` | `string` | No |  |
| `onSuccess` | `() => void` | No |  |

#### `CategoryList`

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `onCreateNew` | `() => void` | No |  |
| `onEdit` | `(categoryId: string) => void` | No |  |

#### `ProductCreateForm`

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `onNavigate` | `(path: string) => void` | Yes |  |

#### `ProductDataTable`

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `data` | `ProductTableRow[]` | Yes |  |
| `isLoading` | `boolean` | No |  |
| `deleting` | `string \| null` | No |  |
| `onDelete` | `(id: string) => void` | Yes |  |
| `statusFilter` | `string` | Yes |  |
| `onStatusFilterChange` | `(value: string) => void` | Yes |  |

#### `ProductDetail`

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `productId` | `string` | No |  |
| `params` | `Record<string, string>` | No |  |

#### `ProductEdit`

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `params` | `Record<string, string>` | No |  |

#### `ProductForm`

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `productId` | `string` | No |  |
| `onNavigate` | `(path: string) => void` | Yes |  |

#### `ProductList`

#### `ProductNew`


---

## `@86d-store/qr-code`

Generate and track QR codes for products, collections, pages, orders, or custom URLs.

### Store components

Use in MDX template files:

#### `QrRedirect`

```mdx
<QrRedirect />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `QrCodeDetail`

#### `QrCodeList`


---

## `@86d-store/quotes`

B2B request-for-quote (RFQ) module. Customers create quotes with line items, submit for review, and negotiate pricing with admin before converting to orders.

### Store components

Use in MDX template files:

#### `MyQuotes`

```mdx
<MyQuotes />
```

#### `QuoteDetail`

```mdx
<QuoteDetail />
```

#### `QuoteRequest`

```mdx
<QuoteRequest />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `QuoteDetail`

#### `QuoteList`


---

## `@86d-store/recently-viewed`

Tracks products customers have viewed and surfaces them for rediscovery. Supports both authenticated (customerId) and anonymous (sessionId) users. Deduplicates repeat views within a 5-minute window.

### Store components

Use in MDX template files:

#### `RecentlyViewedCompact`

```mdx
<RecentlyViewedCompact />
```

#### `RecentlyViewedGrid`

```mdx
<RecentlyViewedGrid />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `RecentlyViewedAdmin`


---

## `@86d-store/recommendations`

Product recommendation engine with four strategies: manual (admin-curated), bought_together (co-occurrence), trending (interaction velocity), and personalized (category affinity + co-occurrence fallback).

### Store components

Use in MDX template files:

#### `ProductRecommendations`

```mdx
<ProductRecommendations productId="..." />
```

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `productId` | `string` | Yes | The product ID to get recommendations for |
| `title` | `string \| undefined` | No | Section title |
| `strategy` | `"manual" \| "bought_together" \| undefined` | No | Recommendation strategy to use |
| `limit` | `number \| undefined` | No | Max number of recommendations |

#### `TrendingProducts`

```mdx
<TrendingProducts />
```

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `title` | `string \| undefined` | No | Section title |
| `limit` | `number \| undefined` | No | Max number of products |

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `RecommendationAdmin`

#### `RecommendationSettings`


---

## `@86d-store/redirects`

URL redirect management for SEO and URL migration. Supports exact-match and regex-based redirects with 301/302/307/308 status codes, hit tracking, and bulk operations.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `RedirectsAdmin`


---

## `@86d-store/referrals`

Customer referral program with unique codes, referral tracking, and configurable reward rules for both referrer and referee.

### Store components

Use in MDX template files:

#### `ReferralApply`

```mdx
<ReferralApply />
```

#### `ReferralDashboard`

```mdx
<ReferralDashboard />
```

#### `ReferralShare`

```mdx
<ReferralShare />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `CodeList`

#### `ReferralList`

#### `RewardRules`


---

## `@86d-store/returns`

The standalone authority for Return state, with a multi-step approval workflow (requested -> approved -> received -> completed) and line-item tracking. Orders-owned Return rows are compatibility reads only; their HTTP writers must remain contained.

### Store components

Use in MDX template files:

#### `ReturnStatus`

```mdx
<ReturnStatus />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `ReturnDetail`

#### `ReturnsList`


---

## `@86d-store/revenue`

Revenue and transaction reporting for the 86d commerce platform. Reads local Payment intents through the Payments capability, calculates volume, count, average value, status counts, and basic refund figures for a date range, and supports paginated transaction lists plus CSV export.

### Store components

Use in MDX template files:

#### `TransactionHistory`

```mdx
<TransactionHistory />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `RevenueAdmin`


---

## `@86d-store/reviews`

Product reviews, ratings, reporting, and helpfulness voting. Reviews start as `pending` and require admin approval before being publicly visible (unless `autoApprove` is set).

### Store components

Use in MDX template files:

#### `DistributionBars`

```mdx
<DistributionBars />
```

#### `MyReviewsPage`

```mdx
<MyReviewsPage />
```

#### `ProductReviews`

```mdx
<ProductReviews />
```

#### `ReviewCard`

```mdx
<ReviewCard />
```

#### `ReviewForm`

```mdx
<ReviewForm />
```

#### `ReviewsSummary`

```mdx
<ReviewsSummary />
```

#### `StarDisplay`

```mdx
<StarDisplay />
```

#### `StarPicker`

```mdx
<StarPicker />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `ReviewAnalytics`

#### `ReviewList`

#### `ReviewModeration`


---

## `@86d-store/saved-addresses`

Customer address book management. Stores shipping and billing addresses with default selection per customer.

### Store components

Use in MDX template files:

#### `AddressBook`

```mdx
<AddressBook />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `AddressOverview`


---

## `@86d-store/search`

In-memory full-text search with fuzzy matching, faceted filtering, click tracking, and query analytics.

### Store components

Use in MDX template files:

#### `SearchBar`

```mdx
<SearchBar />
```

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `placeholder` | `string \| undefined` | No |  |
| `onSearch` | `((query: string) => void) \| undefined` | No |  |

#### `SearchPage`

```mdx
<SearchPage />
```

#### `SearchResults`

```mdx
<SearchResults query="..." />
```

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `query` | `string` | Yes |  |
| `entityType` | `string \| undefined` | No |  |
| `sessionId` | `string \| undefined` | No |  |
| `limit` | `number \| undefined` | No |  |

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `SearchAnalytics`


---

## `@86d-store/seo`

Manages per-page meta tags (title, description, Open Graph, Twitter Card, JSON-LD), URL redirects, and sitemap generation.

### Store components

Use in MDX template files:

#### `SeoHead`

```mdx
<SeoHead path="..." />
```

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | Yes | Page path to fetch meta tags for |
| `fallbackTitle` | `string` | No | Fallback title if none configured |
| `fallbackDescription` | `string` | No | Fallback description if none configured |

#### `Sitemap`

```mdx
<Sitemap />
```

#### `SitemapPage`

```mdx
<SitemapPage />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `SeoAdmin`


---

## `@86d-store/settings`

Settings owns shopper-visible Store presentation. The typed `settings.presentation.resolve@1.0.0` capability exposes validated name, description, support email, and currency decisions without giving consumers Settings data access. Missing or malformed required presentation fails closed. Key-value store for global store configuration organized by group (general, contact, social, legal, commerce, appearance).

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `SettingsCommerce`

#### `SettingsContact`

#### `SettingsGeneral`

#### `SettingsLegal`

#### `SettingsSocial`


---

## `@86d-store/shipping`

Shipping zone/rate configuration plus a dormant v2 foundation for Connection-bound, fulfillment-linked quotes, labels, tracking, refunds, and adjustments. Shopper quote/tracking and legacy shipment mutation routes are contained until that foundation is durably activated.

### Store components

Use in MDX template files:

#### `ShippingEstimator`

```mdx
<ShippingEstimator />
```

#### `ShippingOptions`

```mdx
<ShippingOptions country="..." orderAmount={0} />
```

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `country` | `string` | Yes | ISO 3166-1 alpha-2 country code. |
| `orderAmount` | `number` | Yes | Cart total in cents. |
| `weight` | `number` | No | Total weight in grams (optional). |
| `onSelect` | `(rate: CalculatedRate) => void` | No | Called when a rate is selected. |
| `selectedRateId` | `string` | No | Pre-selected rate ID. |

#### `ShippingRateSummary`

```mdx
<ShippingRateSummary rateName="..." price={0} />
```

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `rateName` | `string` | Yes | Name of the selected shipping rate. |
| `zoneName` | `string` | No | Name of the shipping zone. |
| `price` | `number` | Yes | Price in cents. |

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `ShipmentsAdmin`

#### `ShippingAdmin`

#### `ShippingCarriersAdmin`


---

## `@86d-store/sitemap`

XML sitemap generation from products, collections, pages, blog posts, and brands. Supports custom entries, configurable priorities/frequencies, path exclusions, and on-demand regeneration.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `SitemapAdmin`


---

## `@86d-store/social-proof`

Social proof and trust signals for products — purchase counts, viewer counts, trending indicators, recent activity feeds, and configurable trust badges. Drives conversions by showing aggregate activity data to store visitors.

### Store components

Use in MDX template files:

#### `ProductActivity`

```mdx
<ProductActivity />
```

#### `RecentPurchases`

```mdx
<RecentPurchases />
```

#### `TrustBadges`

```mdx
<TrustBadges />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `SocialProofAdmin`


---

## `@86d-store/social-sharing`

Track and generate share links for products, collections, pages, and blog posts across social networks.

### Store components

Use in MDX template files:

#### `ShareButtons`

```mdx
<ShareButtons targetType="..." targetId="..." url="..." />
```

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `targetType` | `string` | Yes |  |
| `targetId` | `string` | Yes |  |
| `url` | `string` | Yes |  |
| `message` | `string` | No |  |

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `SocialSharingAdmin`


---

## `@86d-store/square`

Square payment provider implementing the `PaymentProvider` interface from `@86d-store/payments`.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `SquareAdmin`


---

## `@86d-store/store-credits`

Customer credit accounts for returns, referrals, and manual adjustments — debitable at checkout.

### Store components

Use in MDX template files:

#### `StoreCreditApply`

```mdx
<StoreCreditApply />
```

#### `StoreCreditBalance`

```mdx
<StoreCreditBalance />
```

#### `StoreCreditTransactions`

```mdx
<StoreCreditTransactions />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `StoreCreditDetail`

#### `StoreCreditsDashboard`


---

## `@86d-store/store-locator`

Physical store location management with proximity search, hours tracking, and click-and-collect support. Omnichannel bridge for brands with brick-and-mortar presence.

### Store components

Use in MDX template files:

#### `LocationDetail`

```mdx
<LocationDetail />
```

#### `LocationList`

```mdx
<LocationList />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `LocationDetail`

#### `LocationForm`

#### `LocationList`


---

## `@86d-store/store-pickup`

BOPIS (Buy Online, Pick Up In Store) module. Manages pickup locations, time windows, and order pickup lifecycle.

### Store components

Use in MDX template files:

#### `LocationPicker`

```mdx
<LocationPicker />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `LocationDetail`

#### `LocationList`

#### `PickupQueue`


---

## `@86d-store/stripe`

Stripe payment provider for @86d-store/payments. Implements the `PaymentProvider` interface using raw fetch to Stripe's REST API — no Stripe SDK required.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `StripeAdmin`


---

## `@86d-store/subscriptions`

Subscription plan and subscriber management. Handles trial and subscription lifecycle status only. Free plans and paid plans with a free trial can be activated through the Store endpoint. Non-trial paid activation remains unavailable until P3 provides purpose-bound, duplicate-safe payment proof consumption.

### Store components

Use in MDX template files:

#### `MySubscriptions`

```mdx
<MySubscriptions />
```

#### `PlanCard`

```mdx
<PlanCard />
```

#### `SubscriptionCard`

```mdx
<SubscriptionCard />
```

#### `SubscriptionPlans`

```mdx
<SubscriptionPlans />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `SubscriptionsAdmin`


---

## `@86d-store/tax`

Jurisdiction-based tax calculation engine with nexus management, transaction audit logging, compliance reporting, tax-inclusive pricing, categories, exemptions, compound rates, and rate stacking.

### Store components

Use in MDX template files:

#### `TaxBreakdown`

```mdx
<TaxBreakdown />
```

#### `TaxEstimate`

```mdx
<TaxEstimate />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `TaxRates`

#### `TaxReporting`


---

## `@86d-store/tickets`

Customer support ticket system with threaded messages, categories, priority levels, and status tracking.

### Store components

Use in MDX template files:

#### `MyTickets`

```mdx
<MyTickets />
```

#### `TicketDetail`

```mdx
<TicketDetail />
```

#### `TicketForm`

```mdx
<TicketForm />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `TicketCategories`

#### `TicketCategoryDetail`

#### `TicketDetail`

#### `TicketList`


---

## `@86d-store/tiktok-shop`

Integrates with TikTok Shop for product listing sync, order management, and catalog synchronization.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `TikTokShopAdmin`


---

## `@86d-store/tipping`

Order tipping with preset/custom amounts, tip splitting, payouts, and configurable settings.

### Store components

Use in MDX template files:

#### `TipSelector`

```mdx
<TipSelector orderId="..." orderTotal={0} />
```

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `orderId` | `string` | Yes | The order ID to attach the tip to |
| `orderTotal` | `number` | Yes | Order subtotal in smallest currency unit (cents) |
| `currency` | `string` | No | ISO 4217 currency code (default: "USD") |

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `TipPayouts`

#### `TippingAdmin`


---

## `@86d-store/toast`

Toast POS integration with bidirectional sync for menus, orders, and inventory.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `ToastAdmin`


---

## `@86d-store/uber-direct`

Uber Direct delivery integration with quote-based pricing, courier tracking, and delivery stats.

### Store components

Use in MDX template files:

#### `DeliveryChecker`

```mdx
<DeliveryChecker />
```

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `currency` | `string` | No |  |

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `UberDirectAdmin`


---

## `@86d-store/uber-eats`

Uber Eats marketplace integration with order management, menu syncing, and order statistics.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `UberEatsAdmin`


---

## `@86d-store/vendors`

Multi-vendor marketplace support. Vendor profiles, product assignments, commission tracking, and payout management.

### Store components

Use in MDX template files:

#### `VendorApply`

```mdx
<VendorApply />
```

#### `VendorDirectory`

```mdx
<VendorDirectory />
```

#### `VendorProfile`

```mdx
<VendorProfile />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `VendorAdmin`

#### `VendorPayouts`


---

## `@86d-store/waitlist`

Product waitlist that lets customers subscribe to out-of-stock notifications and tracks demand per product.

### Store components

Use in MDX template files:

#### `BellIcon`

```mdx
<BellIcon />
```

#### `WaitlistButton`

```mdx
<WaitlistButton />
```

#### `WaitlistPage`

```mdx
<WaitlistPage />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `WaitlistDashboard`


---

## `@86d-store/walmart`

Integrates with Walmart Marketplace for item management, feed submissions, order fulfillment, and inventory tracking.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `WalmartAdmin`


---

## `@86d-store/warranties`

Product warranty plans, registrations, and claims management.

### Store components

Use in MDX template files:

#### `ClaimForm`

```mdx
<ClaimForm />
```

#### `WarrantyStatus`

```mdx
<WarrantyStatus />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `ClaimDetail`

#### `WarrantiesList`


---

## `@86d-store/wish`

Integrates with Wish marketplace for product listing, order management, and shipment tracking.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `WishAdmin`


---

## `@86d-store/wishlist`

Customer wishlists for saving and tracking favorite products across sessions. Supports sharing via token-based public links.

### Store components

Use in MDX template files:

#### `HeartIcon`

```mdx
<HeartIcon />
```

#### `WishlistButton`

```mdx
<WishlistButton />
```

#### `WishlistPage`

```mdx
<WishlistPage />
```

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `WishlistOverview`


---

## `@86d-store/x-shop`

Integrates with X (Twitter) Commerce for product listings, order management, and product drop campaigns.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `XShopAdmin`


---
