# Preorders Module

Manages preorder campaigns for upcoming or limited-edition products. Supports full payment and deposit-based preorders with quantity limits, estimated ship dates, and customer notifications.

## Structure

```
src/
  index.ts          Factory: preorders(options?) => Module + admin nav
  schema.ts         Data models: preorderCampaign, preorderItem
  service.ts        PreordersController interface + types
  service-impl.ts   PreordersController implementation
  store/endpoints/
    list-campaigns.ts       GET  /preorders/campaigns
    get-campaign.ts         GET  /preorders/campaigns/:id
    check-availability.ts   GET  /preorders/check/:productId
    place-preorder.ts       POST /preorders/place
    my-preorders.ts         GET  /preorders/mine
    cancel-preorder.ts      POST /preorders/:id/cancel
  store/components/         Customer-facing components
    _hooks.ts               API hooks (usePreordersApi)
    _utils.ts               Shared utilities
    index.tsx               Component exports
    *.tsx                   Component logic
    *.mdx                   Component templates
  admin/components/
    index.tsx               Admin UI (CampaignList, CampaignDetail) — "use client"
  admin/endpoints/
    list-campaigns.ts       GET  /admin/preorders/campaigns
    create-campaign.ts      POST /admin/preorders/campaigns/create
    get-campaign.ts         GET  /admin/preorders/campaigns/:id
    update-campaign.ts      PATCH /admin/preorders/campaigns/:id/update
    activate-campaign.ts    POST /admin/preorders/campaigns/:id/activate
    pause-campaign.ts       POST /admin/preorders/campaigns/:id/pause
    complete-campaign.ts    POST /admin/preorders/campaigns/:id/complete
    cancel-campaign.ts      POST /admin/preorders/campaigns/:id/cancel
    notify-customers.ts     POST /admin/preorders/campaigns/:id/notify
    list-items.ts           GET  /admin/preorders/items
    fulfill-item.ts         POST /admin/preorders/items/:id/fulfill
    mark-ready.ts           POST /admin/preorders/items/:id/ready
    cancel-item.ts          POST /admin/preorders/items/:id/cancel
    preorder-summary.ts     GET  /admin/preorders/summary
  __tests__/
    service-impl.test.ts    82 tests
```

## Options

```ts
PreordersOptions {
  defaultMessage?: string  // Default message shown on preorder campaign pages
}
```

## Data models

- **preorderCampaign**: id, productId, productName, variantId?, variantLabel?, status, paymentType, depositAmount?, depositPercent?, price, maxQuantity?, currentQuantity, startDate, endDate?, estimatedShipDate?, message?, createdAt, updatedAt
- **preorderItem**: id, campaignId, customerId, customerEmail, quantity, status, depositPaid, totalPrice, orderId?, notifiedAt?, cancelledAt?, cancelReason?, fulfilledAt?, createdAt, updatedAt

## Campaign status lifecycle

`draft` → `active` → `paused` → `active` → `completed`

Any non-terminal status can transition to `cancelled`. Cancelling a campaign cancels all pending/confirmed items.

## Item status lifecycle

`pending` → `confirmed` → `ready` → `fulfilled`

Pending and confirmed items can be `cancelled`. Fulfilled items can be `refunded`.

## Key patterns

- Campaigns auto-activate if startDate is in the past at creation; otherwise created as `draft`
- `paymentType: "full"` charges full price; `paymentType: "deposit"` charges depositAmount per unit or depositPercent of total
- `maxQuantity` limits total preorders per campaign; `currentQuantity` tracks current reservations
- Cancelling a preorder item decrements campaign `currentQuantity`
- `notifyCustomers` marks confirmed/ready items as notified (only once per item)
- Store endpoints only expose active campaigns; admin endpoints show all statuses
- `getActiveCampaignForProduct` finds an active, non-expired campaign for a product+variant

## Requires

- `products` — preorders are tied to product catalog entries

## Events

Emits: `preorder.campaign.created`, `preorder.campaign.activated`, `preorder.campaign.paused`, `preorder.campaign.completed`, `preorder.campaign.cancelled`, `preorder.placed`, `preorder.confirmed`, `preorder.ready`, `preorder.fulfilled`, `preorder.cancelled`, `preorder.customers.notified`
