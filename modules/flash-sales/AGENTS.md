# Flash Sales Module

Time-limited promotional events with per-product sale pricing, stock limits, and countdown support. Creates urgency-driven shopping experiences.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

```
src/
  index.ts          Factory: flashSales(options?) => Module + admin nav
  schema.ts         Models: flashSale, flashSaleProduct
  service.ts        FlashSaleController interface
  service-impl.ts   FlashSaleController implementation
  store/endpoints/
    list-active.ts          GET  /flash-sales
    get-sale.ts             GET  /flash-sales/:slug
    get-product-deal.ts     GET  /flash-sales/product/:productId
    get-product-deals.ts    POST /flash-sales/products
  admin/endpoints/
    list-flash-sales.ts     GET  /admin/flash-sales
    get-flash-sale.ts       GET  /admin/flash-sales/:id
    create-flash-sale.ts    POST /admin/flash-sales/create
    update-flash-sale.ts    POST /admin/flash-sales/:id/update
    delete-flash-sale.ts    POST /admin/flash-sales/:id/delete
    list-products.ts        GET  /admin/flash-sales/:id/products
    add-product.ts          POST /admin/flash-sales/:id/products/add
    remove-product.ts       POST /admin/flash-sales/:id/products/:productId/remove
    bulk-add-products.ts    POST /admin/flash-sales/:id/products/bulk
    get-stats.ts            GET  /admin/flash-sales/stats
  store/components/
    _hooks.ts               useFlashSalesApi, useCartMutation
    _utils.ts               formatPrice, formatDate, formatDateTime, getTimeRemaining
    countdown.tsx           Live countdown timer (re-renders every second)
    flash-sale-product-card.tsx  Product card with discount badge, stock bar, add-to-cart
    flash-sale-listing.tsx  All active sales grid with countdowns and product previews
    flash-sale-detail.tsx   Single sale page with breadcrumb, header, product grid
    flash-deal-badge.tsx    Embeddable badge for product pages (shows deal pricing + countdown)
    index.tsx               MDXComponents export
  admin/components/
    index.tsx               FlashSaleList, FlashSaleDetail
  __tests__/
    service-impl.test.ts    77 tests (core CRUD, stock tracking, active queries, stats)
    endpoint-security.test.ts  14 tests (visibility rules, stock enforcement, cascade isolation)
    controllers.test.ts     24 tests (edge cases: upserts, pagination, discount calc, batch queries)
```

## Options

```ts
FlashSalesOptions {
  maxProductsPerSale?: number  // no limit by default
}
```

## Data models

- **flashSale**: id, name, slug (unique), description?, status (draft|scheduled|active|ended), startsAt, endsAt, createdAt, updatedAt
- **flashSaleProduct**: id, flashSaleId (indexed), productId (indexed), salePrice, originalPrice, stockLimit?, stockSold, sortOrder, createdAt

## Store components

| Component | Description |
| --- | --- |
| `FlashSaleListing` | All active sales with product grids, discount badges, countdowns, stock bars |
| `FlashSaleDetail` | Single sale page with breadcrumb, countdown, all products with add-to-cart |
| `FlashSaleProductCard` | Product card: discount badge, pricing, stock progress bar, add-to-cart button |
| `FlashDealBadge` | Embeddable on product pages — shows sale name, pricing, countdown, stock remaining |
| `Countdown` | Live countdown timer component (days/hours/minutes/seconds), calls `onExpire` callback |

## Admin components

| Component | Path | Description |
| --- | --- | --- |
| `FlashSaleList` | `/admin/flash-sales` | Stats (total/active/scheduled/products/units sold), status filter, sale list with status badges, inline create form with datetime pickers |
| `FlashSaleDetail` | `/admin/flash-sales/:id` | Edit sale details (name, slug, description, status, start/end dates), product management section with add form (product ID, prices, stock limit) and product list with discount % and remove |

## Patterns

- Status + date range determines visibility: a sale is shown on the storefront only when `status === "active"` AND `now` is between `startsAt` and `endsAt`
- Products upsert by flashSaleId + productId pair — adding the same product twice updates its pricing
- Stock tracking: `recordSale()` increments stockSold; returns null when exceeding stockLimit
- Product deals: `getActiveProductDeal()` checks all flash sale products for a given productId, returns the first active, in-stock match
- Cascade delete: removing a flash sale deletes all its products
- `discountPercent` is calculated as `round((original - sale) / original * 100)`
- `exactOptionalPropertyTypes` is on — build endpoint params objects explicitly, don't pass potentially-undefined optionals
- Admin `add-product` validates `salePrice < originalPrice`
- Admin `create` validates `endsAt > startsAt`
- Store `get-sale` checks both status AND date range before returning
