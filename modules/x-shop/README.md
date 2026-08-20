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

# X Shop Module

📚 **Documentation:** [86d.app/docs/modules/x-shop](https://86d.app/docs/modules/x-shop)

Integrates your 86d store with X (Twitter) Commerce for product listings, order management, and product drop campaigns. Supports scheduling product launches tied to tweets with engagement tracking (impressions, clicks, conversions).

## Installation

```sh
npm install @86d-app/x-shop
```

## Usage

```ts
import xShop from "@86d-app/x-shop";

const module = xShop({
  apiKey: "your-api-key",
  apiSecret: "your-api-secret",
  merchantId: "your-merchant-id",
});
```

## Configuration

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `apiKey` | `string` | - | X/Twitter API key |
| `apiSecret` | `string` | - | X/Twitter API secret |
| `merchantId` | `string` | - | X Commerce merchant ID |

## Store Endpoints

| Method | Path | Description |
| --- | --- | --- |
| POST | `/x-shop/webhooks` | Receive X Shop webhook events |

## Admin Endpoints

| Method | Path | Description |
| --- | --- | --- |
| POST | `/admin/x-shop/listings/create` | Create a product listing |
| GET | `/admin/x-shop/listings` | List all listings |
| GET | `/admin/x-shop/listings/:id` | Get a specific listing |
| POST | `/admin/x-shop/listings/:id/update` | Update a listing |
| POST | `/admin/x-shop/listings/:id/delete` | Delete a listing |
| GET | `/admin/x-shop/orders` | List orders |
| GET | `/admin/x-shop/orders/:id` | Get a specific order |
| POST | `/admin/x-shop/orders/:id/status` | Update order status |
| POST | `/admin/x-shop/drops/create` | Create a product drop |
| GET | `/admin/x-shop/drops` | List product drops |
| GET | `/admin/x-shop/drops/:id` | Get a specific drop |
| POST | `/admin/x-shop/drops/:id/cancel` | Cancel a product drop |
| GET | `/admin/x-shop/drops/:id/stats` | Get drop engagement stats |
| GET | `/admin/x-shop/stats` | Get channel statistics |

## Controller API

```ts
interface XShopController extends ModuleController {
  createListing(params: { localProductId: string; title: string; ... }): Promise<Listing>;
  updateListing(id: string, params: Partial<Listing>): Promise<Listing | null>;
  deleteListing(id: string): Promise<boolean>;
  getListing(id: string): Promise<Listing | null>;
  getListingByProduct(localProductId: string): Promise<Listing | null>;
  listListings(params?: { status?; syncStatus?; take?; skip? }): Promise<Listing[]>;
  receiveOrder(params: { externalOrderId: string; items: unknown[]; ... }): Promise<ChannelOrder>;
  getOrder(id: string): Promise<ChannelOrder | null>;
  updateOrderStatus(id: string, status: OrderStatus, trackingNumber?, trackingUrl?): Promise<ChannelOrder | null>;
  listOrders(params?: { status?; take?; skip? }): Promise<ChannelOrder[]>;
  createDrop(params: { name: string; productIds: string[]; launchDate: Date; ... }): Promise<ProductDrop>;
  getDrop(id: string): Promise<ProductDrop | null>;
  cancelDrop(id: string): Promise<ProductDrop | null>;
  listDrops(params?: { status?; take?; skip? }): Promise<ProductDrop[]>;
  getDropStats(id: string): Promise<DropStats | null>;
  getChannelStats(): Promise<ChannelStats>;
}
```

## Types

- **Listing** -- Product listing with sync status tracking, same structure as TikTok Shop listings
- **ChannelOrder** -- Order with fee breakdown (subtotal, shippingFee, platformFee, total) and tracking info
- **ProductDrop** -- Scheduled product launch campaign tied to a tweet, tracking impressions, clicks, and conversions
- **DropStats** -- Engagement statistics for a drop including computed conversion rate

## Notes

- Listing statuses: `draft`, `pending`, `active`, `rejected`, `suspended`
- Order statuses: `pending`, `confirmed`, `shipped`, `delivered`, `cancelled`, `refunded`
- Drop statuses: `scheduled`, `live`, `ended`, `cancelled`
- Product drops are unique to this module -- they associate product launches with tweets for social commerce
- Conversion rate is computed as conversions/impressions (0 if no impressions)
- Admin page appears under the **Sales** group with the **MessageSquare** icon
