<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/logo" height="96" alt="86d" />
  </a>
</p>

<p align="center">Dynamic Commerce</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use.

# Walmart Module

📚 **Documentation:** [86d.app/docs/modules/walmart](https://86d.app/docs/modules/walmart)

Integrates your 86d store with Walmart Marketplace for item management, feed submissions, order fulfillment, and inventory tracking. Supports both seller-fulfilled and Walmart Fulfillment Services (WFS) items.

## Installation

```sh
npm install @86d-app/walmart
```

## Usage

```ts
import walmart from "@86d-app/walmart";

const module = walmart({
  clientId: "your-client-id",
  clientSecret: "your-client-secret",
  partnerId: "your-partner-id",
});
```

## Configuration

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `clientId` | `string` | - | Walmart API client ID |
| `clientSecret` | `string` | - | Walmart API client secret |
| `partnerId` | `string` | - | Walmart partner ID |

## Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/walmart/items` | List items with optional status, fulfillment type, page, and limit filters |
| POST | `/admin/walmart/items/create` | Create a new marketplace item |
| GET | `/admin/walmart/items/health` | Get item health breakdown by status and fulfillment type |
| GET | `/admin/walmart/items/:id` | Get a single item by ID |
| PUT | `/admin/walmart/items/:id/update` | Update item fields |
| PUT | `/admin/walmart/items/:id/retire` | Retire an item (sets status to retired, lifecycle to archived) |
| GET | `/admin/walmart/orders` | List orders with optional status, page, and limit filters |
| PUT | `/admin/walmart/orders/:id/acknowledge` | Acknowledge an order |
| PUT | `/admin/walmart/orders/:id/ship` | Ship an order with tracking number and carrier |
| PUT | `/admin/walmart/orders/:id/cancel` | Cancel an order |
| GET | `/admin/walmart/feeds` | List feed submissions with optional type and status filters |
| POST | `/admin/walmart/feeds/submit` | Submit a feed (item, inventory, price, or order) |
| GET | `/admin/walmart/stats` | Get channel statistics |

## Store Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/walmart/webhooks` | Receive Walmart webhook events |

## Controller API

```ts
interface WalmartController extends ModuleController {
  createItem(params: { localProductId: string; sku: string; title: string; price: number; ... }): Promise<WalmartItem>;
  updateItem(id: string, params: Partial<WalmartItem>): Promise<WalmartItem | null>;
  retireItem(id: string): Promise<WalmartItem | null>;
  getItem(id: string): Promise<WalmartItem | null>;
  getItemByProduct(productId: string): Promise<WalmartItem | null>;
  listItems(params?: { status?; fulfillmentType?; take?; skip? }): Promise<WalmartItem[]>;
  submitFeed(feedType: FeedType): Promise<FeedSubmission>;
  getLastFeed(feedType: FeedType): Promise<FeedSubmission | null>;
  listFeeds(params?: { feedType?; status?; take?; skip? }): Promise<FeedSubmission[]>;
  receiveOrder(params: { purchaseOrderId: string; items: unknown[]; ... }): Promise<WalmartOrder>;
  acknowledgeOrder(id: string): Promise<WalmartOrder | null>;
  shipOrder(id: string, trackingNumber: string, carrier: string): Promise<WalmartOrder | null>;
  cancelOrder(id: string): Promise<WalmartOrder | null>;
  listOrders(params?: { status?; take?; skip? }): Promise<WalmartOrder[]>;
  getChannelStats(): Promise<ChannelStats>;
  getItemHealth(): Promise<ItemHealth>;
}
```

## Types

- **WalmartItem** -- Marketplace item with SKU, UPC/GTIN identifiers, pricing, inventory quantity, and fulfillment type (seller vs WFS)
- **WalmartOrder** -- Purchase order with Walmart-specific fee breakdown (orderTotal, shippingTotal, walmartFee, tax) and shipping tracking
- **FeedSubmission** -- Feed job record for item/inventory/price/order feed types with success/error item counts
- **ItemHealth** -- Health breakdown by status (published, unpublished, retired, system-error) and fulfillment type

## Notes

- Item statuses: `published`, `unpublished`, `retired`, `system-error`
- Lifecycle statuses: `active`, `archived`
- Fulfillment types: `seller` (merchant-fulfilled), `wfs` (Walmart Fulfillment Services)
- Order flow: `created` -> `acknowledged` -> `shipped` -> `delivered`
- Feed types: `item`, `inventory`, `price`, `order`
- `retireItem()` archives the item (sets status to `retired`, lifecycle to `archived`)
- Admin page appears under the **Sales** group with the **Store** icon
- Admin and store endpoints are fully wired via `createAdminEndpoint` and `createStoreEndpoint`
