# Walmart Module

Integrates with Walmart Marketplace for item management, feed submissions, order fulfillment, and inventory tracking.

## Structure

```
src/
  index.ts          Factory: walmart(options?) => Module + admin nav (Sales > Walmart)
  schema.ts         Zod models: item, walmartOrder, feedSubmission
  service.ts        WalmartController interface
  service-impl.ts   WalmartController implementation via ModuleDataService
  store/endpoints/  webhooks.ts
  admin/endpoints/  create-item, get-item, list-items, update-item, retire-item, item-health, list-orders, acknowledge-order, ship-order, cancel-order, list-feeds, submit-feed, stats
  admin/components/ index.tsx, walmart-admin.tsx, walmart-admin.mdx
  __tests__/        service-impl.test.ts
```

## Options

```ts
interface WalmartOptions extends ModuleConfig {
  clientId?: string;      // Walmart API client ID
  clientSecret?: string;  // Walmart API client secret
  partnerId?: string;     // Walmart partner ID
}
```

## Data Models

- **WalmartItem** -- id, localProductId, walmartItemId, sku, title, status (published|unpublished|retired|system-error), lifecycleStatus (active|archived), price, quantity, upc, gtin, brand, category, fulfillmentType (seller|wfs), publishStatus, lastSyncedAt, error, metadata
- **WalmartOrder** -- id, purchaseOrderId, status (created|acknowledged|shipped|delivered|cancelled|refunded), items, orderTotal, shippingTotal, walmartFee, tax, customerName, shippingAddress, trackingNumber, carrier, shipDate, estimatedDelivery
- **FeedSubmission** -- id, feedId, feedType (item|inventory|price|order), status (pending|processing|completed|error), totalItems, successItems, errorItems, error, submittedAt, completedAt
- **ChannelStats** -- totalItems, publishedItems, totalOrders, totalRevenue, pendingFeeds, errorItems
- **ItemHealth** -- total, published, unpublished, retired, systemError, sellerFulfilled, wfsFulfilled

## Patterns

- Controller key: `walmart`
- Events emitted: `walmart.item.synced`, `walmart.item.retired`, `walmart.order.received`, `walmart.order.shipped`, `walmart.feed.submitted`, `walmart.inventory.updated`
- Exports read fields: `itemTitle`, `itemStatus`, `itemPrice`, `walmartItemId`
- `retireItem()` sets status to `retired` and lifecycleStatus to `archived`
- `acknowledgeOrder()` transitions order from `created` to `acknowledged`
- Feed types: `item`, `inventory`, `price`, `order`
### Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/walmart/items` | List items with optional status/fulfillment type filters |
| POST | `/admin/walmart/items/create` | Create a new item |
| GET | `/admin/walmart/items/health` | Get item health breakdown |
| GET | `/admin/walmart/items/:id` | Get a single item by ID |
| PUT | `/admin/walmart/items/:id/update` | Update item fields |
| PUT | `/admin/walmart/items/:id/retire` | Retire an item |
| GET | `/admin/walmart/orders` | List orders with optional status filter |
| PUT | `/admin/walmart/orders/:id/acknowledge` | Acknowledge an order |
| PUT | `/admin/walmart/orders/:id/ship` | Ship an order (trackingNumber, carrier) |
| PUT | `/admin/walmart/orders/:id/cancel` | Cancel an order |
| GET | `/admin/walmart/feeds` | List feed submissions |
| POST | `/admin/walmart/feeds/submit` | Submit a feed (item/inventory/price/order) |
| GET | `/admin/walmart/stats` | Get channel stats |

### Store Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/walmart/webhooks` | Receive Walmart webhook events |
