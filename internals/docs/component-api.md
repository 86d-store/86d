# Component API Reference

Auto-generated from module source files. Run `bun run generate:docs` to regenerate.

Generated: 2026-08-14  
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

- [`@86d-app/abandoned-carts`](#86d-appabandoned-carts) — 1 store, 1 admin components
- [`@86d-app/affiliates`](#86d-appaffiliates) — 2 store, 4 admin components
- [`@86d-app/amazon`](#86d-appamazon) — 2 admin components
- [`@86d-app/analytics`](#86d-appanalytics) — 2 admin components
- [`@86d-app/announcements`](#86d-appannouncements) — 3 store, 3 admin components
- [`@86d-app/appointments`](#86d-appappointments) — 2 store, 4 admin components
- [`@86d-app/auctions`](#86d-appauctions) — 3 store, 2 admin components
- [`@86d-app/audit-log`](#86d-appaudit-log) — 2 admin components
- [`@86d-app/automations`](#86d-appautomations) — 2 admin components
- [`@86d-app/backorders`](#86d-appbackorders) — 2 store, 2 admin components
- [`@86d-app/blog`](#86d-appblog) — 2 store, 1 admin components
- [`@86d-app/braintree`](#86d-appbraintree) — 1 admin component
- [`@86d-app/brands`](#86d-appbrands) — 2 store, 1 admin components
- [`@86d-app/bulk-pricing`](#86d-appbulk-pricing) — 1 store, 2 admin components
- [`@86d-app/bundles`](#86d-appbundles) — 2 store, 1 admin components
- [`@86d-app/cart`](#86d-appcart) — 5 store, 3 admin components
- [`@86d-app/checkout`](#86d-appcheckout) — 7 store, 2 admin components
- [`@86d-app/collections`](#86d-appcollections) — 2 store, 1 admin components
- [`@86d-app/comparisons`](#86d-appcomparisons) — 2 store, 1 admin components
- [`@86d-app/customer-groups`](#86d-appcustomer-groups) — 2 store, 2 admin components
- [`@86d-app/customers`](#86d-appcustomers) — 2 store, 3 admin components
- [`@86d-app/delivery-slots`](#86d-appdelivery-slots) — 1 store, 4 admin components
- [`@86d-app/digital-downloads`](#86d-appdigital-downloads) — 3 store, 1 admin components
- [`@86d-app/discounts`](#86d-appdiscounts) — 4 store, 5 admin components
- [`@86d-app/doordash`](#86d-appdoordash) — 1 store, 1 admin components
- [`@86d-app/ebay`](#86d-appebay) — 1 admin component
- [`@86d-app/etsy`](#86d-appetsy) — 1 admin component
- [`@86d-app/facebook-shop`](#86d-appfacebook-shop) — 1 admin component
- [`@86d-app/faq`](#86d-appfaq) — 2 store, 4 admin components
- [`@86d-app/favor`](#86d-appfavor) — 1 store, 1 admin components
- [`@86d-app/flash-sales`](#86d-appflash-sales) — 6 store, 2 admin components
- [`@86d-app/forms`](#86d-appforms) — 2 store, 4 admin components
- [`@86d-app/fulfillment`](#86d-appfulfillment) — 3 store, 1 admin components
- [`@86d-app/gamification`](#86d-appgamification) — 1 store, 2 admin components
- [`@86d-app/gift-registry`](#86d-appgift-registry) — 2 store, 2 admin components
- [`@86d-app/gift-wrapping`](#86d-appgift-wrapping) — 1 store, 2 admin components
- [`@86d-app/giftcards`](#86d-appgiftcards) — 2 store, 1 admin components
- [`@86d-app/google-shopping`](#86d-appgoogle-shopping) — 1 admin component
- [`@86d-app/import-export`](#86d-appimport-export) — 2 admin components
- [`@86d-app/instagram-shop`](#86d-appinstagram-shop) — 1 admin component
- [`@86d-app/inventory`](#86d-appinventory) — 3 store, 2 admin components
- [`@86d-app/invoices`](#86d-appinvoices) — 2 store, 3 admin components
- [`@86d-app/kiosk`](#86d-appkiosk) — 1 store, 2 admin components
- [`@86d-app/loyalty`](#86d-apployalty) — 4 store, 3 admin components
- [`@86d-app/media`](#86d-appmedia) — 3 store, 1 admin components
- [`@86d-app/memberships`](#86d-appmemberships) — 3 store, 2 admin components
- [`@86d-app/multi-currency`](#86d-appmulti-currency) — 2 store, 3 admin components
- [`@86d-app/navigation`](#86d-appnavigation) — 3 store, 1 admin components
- [`@86d-app/newsletter`](#86d-appnewsletter) — 3 store, 2 admin components
- [`@86d-app/notifications`](#86d-appnotifications) — 3 store, 4 admin components
- [`@86d-app/order-notes`](#86d-apporder-notes) — 1 store, 1 admin components
- [`@86d-app/orders`](#86d-apporders) — 4 store, 5 admin components
- [`@86d-app/pages`](#86d-apppages) — 2 store, 1 admin components
- [`@86d-app/payments`](#86d-apppayments) — 1 store, 1 admin components
- [`@86d-app/paypal`](#86d-apppaypal) — 1 admin component
- [`@86d-app/photo-booth`](#86d-appphoto-booth) — 2 store, 2 admin components
- [`@86d-app/pinterest-shop`](#86d-apppinterest-shop) — 1 admin component
- [`@86d-app/preorders`](#86d-apppreorders) — 5 store, 2 admin components
- [`@86d-app/price-lists`](#86d-appprice-lists) — 2 store, 3 admin components
- [`@86d-app/product-feeds`](#86d-appproduct-feeds) — 2 admin components
- [`@86d-app/product-labels`](#86d-appproduct-labels) — 1 store, 1 admin components
- [`@86d-app/product-qa`](#86d-appproduct-qa) — 4 store, 3 admin components
- [`@86d-app/products`](#86d-appproducts) — 1 store, 8 admin components
- [`@86d-app/qr-code`](#86d-appqr-code) — 1 store, 2 admin components
- [`@86d-app/quotes`](#86d-appquotes) — 3 store, 2 admin components
- [`@86d-app/recently-viewed`](#86d-apprecently-viewed) — 2 store, 1 admin components
- [`@86d-app/recommendations`](#86d-apprecommendations) — 2 store, 2 admin components
- [`@86d-app/redirects`](#86d-appredirects) — 1 admin component
- [`@86d-app/referrals`](#86d-appreferrals) — 3 store, 3 admin components
- [`@86d-app/returns`](#86d-appreturns) — 1 store, 2 admin components
- [`@86d-app/revenue`](#86d-apprevenue) — 1 store, 1 admin components
- [`@86d-app/reviews`](#86d-appreviews) — 8 store, 3 admin components
- [`@86d-app/saved-addresses`](#86d-appsaved-addresses) — 1 store, 1 admin components
- [`@86d-app/search`](#86d-appsearch) — 3 store, 1 admin components
- [`@86d-app/seo`](#86d-appseo) — 3 store, 1 admin components
- [`@86d-app/settings`](#86d-appsettings) — 5 admin components
- [`@86d-app/shipping`](#86d-appshipping) — 3 store, 3 admin components
- [`@86d-app/sitemap`](#86d-appsitemap) — 1 admin component
- [`@86d-app/social-proof`](#86d-appsocial-proof) — 3 store, 1 admin components
- [`@86d-app/social-sharing`](#86d-appsocial-sharing) — 1 store, 1 admin components
- [`@86d-app/square`](#86d-appsquare) — 1 admin component
- [`@86d-app/store-credits`](#86d-appstore-credits) — 3 store, 2 admin components
- [`@86d-app/store-locator`](#86d-appstore-locator) — 2 store, 3 admin components
- [`@86d-app/store-pickup`](#86d-appstore-pickup) — 1 store, 3 admin components
- [`@86d-app/stripe`](#86d-appstripe) — 1 admin component
- [`@86d-app/subscriptions`](#86d-appsubscriptions) — 4 store, 1 admin components
- [`@86d-app/tax`](#86d-apptax) — 2 store, 2 admin components
- [`@86d-app/tickets`](#86d-apptickets) — 3 store, 4 admin components
- [`@86d-app/tiktok-shop`](#86d-apptiktok-shop) — 1 admin component
- [`@86d-app/tipping`](#86d-apptipping) — 1 store, 2 admin components
- [`@86d-app/toast`](#86d-apptoast) — 1 admin component
- [`@86d-app/uber-direct`](#86d-appuber-direct) — 1 store, 1 admin components
- [`@86d-app/uber-eats`](#86d-appuber-eats) — 1 admin component
- [`@86d-app/vendors`](#86d-appvendors) — 3 store, 2 admin components
- [`@86d-app/waitlist`](#86d-appwaitlist) — 3 store, 1 admin components
- [`@86d-app/walmart`](#86d-appwalmart) — 1 admin component
- [`@86d-app/warranties`](#86d-appwarranties) — 2 store, 2 admin components
- [`@86d-app/wish`](#86d-appwish) — 1 admin component
- [`@86d-app/wishlist`](#86d-appwishlist) — 3 store, 1 admin components
- [`@86d-app/x-shop`](#86d-appx-shop) — 1 admin component

---

## `@86d-app/abandoned-carts`

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

## `@86d-app/affiliates`

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

## `@86d-app/amazon`

Amazon Seller Central integration for listing management, order fulfillment, and inventory sync.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `AmazonAdmin`

#### `AmazonInventory`


---

## `@86d-app/analytics`

Event tracking and reporting for the 86d store. Records page views, product views, cart events, purchases, and custom events. Provides admin endpoints for stats, top-product reports, and raw event access.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `AnalyticsAdmin`

#### `AnalyticsSettings`


---

## `@86d-app/announcements`

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

## `@86d-app/appointments`

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

## `@86d-app/auctions`

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

## `@86d-app/audit-log`

Records admin actions, system events, and API key usage for security auditing, compliance, and accountability.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `AuditLogDetail`

#### `AuditLogList`


---

## `@86d-app/automations`

Event-driven workflow automation. Rules trigger on platform events, evaluate conditions, and execute configurable actions.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `AutomationDetail`

#### `AutomationList`


---

## `@86d-app/backorders`

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

## `@86d-app/blog`

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

## `@86d-app/braintree`

Braintree payment provider implementing the `PaymentProvider` interface from `@86d-app/payments`.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `BraintreeAdmin`


---

## `@86d-app/brands`

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

## `@86d-app/bulk-pricing`

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

## `@86d-app/bundles`

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

## `@86d-app/cart`

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

## `@86d-app/checkout`

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

## `@86d-app/collections`

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

## `@86d-app/comparisons`

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

## `@86d-app/customer-groups`

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

## `@86d-app/customers`

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

## `@86d-app/delivery-slots`

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

## `@86d-app/digital-downloads`

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

## `@86d-app/discounts`

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

## `@86d-app/doordash`

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

## `@86d-app/ebay`

eBay marketplace integration for fixed-price and auction listings, order management, and channel analytics.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `EbayAdmin`


---

## `@86d-app/etsy`

Etsy marketplace integration for handmade/vintage listing management, orders, reviews, and shop analytics.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `EtsyAdmin`


---

## `@86d-app/facebook-shop`

Facebook/Meta Commerce integration for catalog sync, product listings, order management, and collections.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `FacebookShopAdmin`


---

## `@86d-app/faq`

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

## `@86d-app/favor`

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

## `@86d-app/flash-sales`

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

## `@86d-app/forms`

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

## `@86d-app/fulfillment`

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

## `@86d-app/gamification`

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

## `@86d-app/gift-registry`

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

## `@86d-app/gift-wrapping`

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

## `@86d-app/giftcards`

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

#### `GiftCardOverview`


---

## `@86d-app/google-shopping`

Integrates with Google Merchant Center for product feed management, feed submissions, order handling, and diagnostics.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `GoogleShoppingAdmin`


---

## `@86d-app/import-export`

Manages bulk data import and export jobs for products, customers, orders, and inventory.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `ImportDetail`

#### `ImportExportOverview`


---

## `@86d-app/instagram-shop`

Instagram Shopping integration for product listings, media tagging, catalog sync, and order management.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `InstagramShopAdmin`


---

## `@86d-app/inventory`

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

## `@86d-app/invoices`

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

## `@86d-app/kiosk`

Self-service kiosk station management with session-based ordering, item management, and payment tracking.

### Store components

Use in MDX template files:

#### `KioskTerminal`

```mdx
<KioskTerminal />
```

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `stationId` | `string \| undefined` | No | Station ID this terminal is registered as |
| `currency` | `string` | No | ISO 4217 currency code (default: "USD") |
| `idleTimeout` | `number` | No | Idle timeout in seconds before auto-reset (default: 120) |
| `params` | `Record<string, string> \| undefined` | No |  |

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `KioskAdmin`

#### `KioskStations`


---

## `@86d-app/loyalty`

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

## `@86d-app/media`

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

## `@86d-app/memberships`

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

## `@86d-app/multi-currency`

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

## `@86d-app/navigation`

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

## `@86d-app/newsletter`

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

## `@86d-app/notifications`

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

## `@86d-app/order-notes`

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

## `@86d-app/orders`

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

## `@86d-app/pages`

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

## `@86d-app/payments`

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

## `@86d-app/paypal`

PayPal Third-party Payment Integration. The connection-bound adapter implements

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `PayPalAdmin`


---

## `@86d-app/photo-booth`

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

## `@86d-app/pinterest-shop`

Integrates with Pinterest for catalog management, shopping pin creation, and pin analytics tracking.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `PinterestShopAdmin`


---

## `@86d-app/preorders`

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

## `@86d-app/price-lists`

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

## `@86d-app/product-feeds`

Product feed generation for shopping channels (Google Shopping, Facebook/Meta, Microsoft, Pinterest, TikTok, custom).

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `ProductFeedDetail`

#### `ProductFeedsOverview`


---

## `@86d-app/product-labels`

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

## `@86d-app/product-qa`

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

## `@86d-app/products`

Product and Variant catalog with accepted Categories. New price writes use integer

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

## `@86d-app/qr-code`

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

## `@86d-app/quotes`

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

## `@86d-app/recently-viewed`

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

## `@86d-app/recommendations`

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

## `@86d-app/redirects`

URL redirect management for SEO and URL migration. Supports exact-match and regex-based redirects with 301/302/307/308 status codes, hit tracking, and bulk operations.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `RedirectsAdmin`


---

## `@86d-app/referrals`

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

## `@86d-app/returns`

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

## `@86d-app/revenue`

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

## `@86d-app/reviews`

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

## `@86d-app/saved-addresses`

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

## `@86d-app/search`

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

## `@86d-app/seo`

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

## `@86d-app/settings`

Settings owns shopper-visible Store presentation. The typed

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `SettingsCommerce`

#### `SettingsContact`

#### `SettingsGeneral`

#### `SettingsLegal`

#### `SettingsSocial`


---

## `@86d-app/shipping`

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

## `@86d-app/sitemap`

XML sitemap generation from products, collections, pages, blog posts, and brands. Supports custom entries, configurable priorities/frequencies, path exclusions, and on-demand regeneration.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `SitemapAdmin`


---

## `@86d-app/social-proof`

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

## `@86d-app/social-sharing`

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

## `@86d-app/square`

Square payment provider implementing the `PaymentProvider` interface from `@86d-app/payments`.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `SquareAdmin`


---

## `@86d-app/store-credits`

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

## `@86d-app/store-locator`

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

## `@86d-app/store-pickup`

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

## `@86d-app/stripe`

Stripe payment provider for @86d-app/payments. Implements the `PaymentProvider` interface using raw fetch to Stripe's REST API — no Stripe SDK required.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `StripeAdmin`


---

## `@86d-app/subscriptions`

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

## `@86d-app/tax`

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

## `@86d-app/tickets`

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

## `@86d-app/tiktok-shop`

Integrates with TikTok Shop for product listing sync, order management, and catalog synchronization.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `TikTokShopAdmin`


---

## `@86d-app/tipping`

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

## `@86d-app/toast`

Toast POS integration with bidirectional sync for menus, orders, and inventory.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `ToastAdmin`


---

## `@86d-app/uber-direct`

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

## `@86d-app/uber-eats`

Uber Eats marketplace integration with order management, menu syncing, and order statistics.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `UberEatsAdmin`


---

## `@86d-app/vendors`

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

## `@86d-app/waitlist`

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

## `@86d-app/walmart`

Integrates with Walmart Marketplace for item management, feed submissions, order fulfillment, and inventory tracking.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `WalmartAdmin`


---

## `@86d-app/warranties`

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

## `@86d-app/wish`

Integrates with Wish marketplace for product listing, order management, and shipment tracking.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `WishAdmin`


---

## `@86d-app/wishlist`

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

## `@86d-app/x-shop`

Integrates with X (Twitter) Commerce for product listings, order management, and product drop campaigns.

### Admin components

Registered as admin pages — accessed via the admin sidebar.

#### `XShopAdmin`


---
