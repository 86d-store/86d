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

# TikTok Shop Module

📚 **Documentation:** [86d.app/docs/modules/tiktok-shop](https://86d.app/docs/modules/tiktok-shop)

Integrates your 86d store with TikTok Shop for product listing synchronization, order management, and catalog syncing. Supports webhook ingestion for real-time updates from TikTok Shop.

## Installation

```sh
npm install @86d-app/tiktok-shop
```

## Usage

```ts
import tiktokShop from "@86d-app/tiktok-shop";

const module = tiktokShop({
  appKey: "your-app-key",
  appSecret: "your-app-secret",
  shopId: "your-shop-id",
  sandbox: "true",
});
```

## Configuration

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `appKey` | `string` | - | TikTok Shop app key |
| `appSecret` | `string` | - | TikTok Shop app secret |
| `shopId` | `string` | - | TikTok Shop ID |
| `sandbox` | `string` | `"true"` | Use sandbox environment |

## Store Endpoints

| Method | Path | Description |
| --- | --- | --- |
| POST | `/tiktok-shop/webhooks` | Receive TikTok Shop webhook events |

## Admin Endpoints

| Method | Path | Description |
| --- | --- | --- |
| POST | `/admin/tiktok-shop/listings/create` | Create a product listing |
| GET | `/admin/tiktok-shop/listings` | List all listings |
| GET | `/admin/tiktok-shop/listings/:id` | Get a specific listing |
| POST | `/admin/tiktok-shop/listings/:id/update` | Update a listing |
| POST | `/admin/tiktok-shop/listings/:id/delete` | Delete a listing |
| POST | `/admin/tiktok-shop/sync` | Trigger catalog sync |
| GET | `/admin/tiktok-shop/syncs` | List sync history |
| GET | `/admin/tiktok-shop/orders` | List TikTok orders |
| GET | `/admin/tiktok-shop/orders/:id` | Get a specific order |
| POST | `/admin/tiktok-shop/orders/:id/status` | Update order status |
| GET | `/admin/tiktok-shop/stats` | Get channel statistics |

## Controller API

```ts
interface TikTokShopController extends ModuleController {
  createListing(params: { localProductId: string; title: string; ... }): Promise<Listing>;
  updateListing(id: string, params: Partial<Listing>): Promise<Listing | null>;
  deleteListing(id: string): Promise<boolean>;
  getListing(id: string): Promise<Listing | null>;
  getListingByProduct(localProductId: string): Promise<Listing | null>;
  listListings(params?: { status?; syncStatus?; take?; skip? }): Promise<Listing[]>;
  syncCatalog(): Promise<CatalogSync>;
  getLastSync(): Promise<CatalogSync | null>;
  listSyncs(params?: { take?; skip? }): Promise<CatalogSync[]>;
  receiveOrder(params: { externalOrderId: string; items: unknown[]; ... }): Promise<ChannelOrder>;
  getOrder(id: string): Promise<ChannelOrder | null>;
  updateOrderStatus(id: string, status: OrderStatus, trackingNumber?, trackingUrl?): Promise<ChannelOrder | null>;
  listOrders(params?: { status?; take?; skip? }): Promise<ChannelOrder[]>;
  getChannelStats(): Promise<ChannelStats>;
}
```

## Types

- **Listing** -- Product listing with sync status tracking
- **ChannelOrder** -- Order received from TikTok Shop with fee breakdown (subtotal, shippingFee, platformFee, total)
- **CatalogSync** -- Catalog sync job record with progress tracking
- **ChannelStats** -- Aggregated listing and order statistics with revenue

## Notes

- Listing statuses: `draft`, `pending`, `active`, `rejected`, `suspended`
- Order statuses: `pending`, `confirmed`, `shipped`, `delivered`, `cancelled`, `refunded`
- Revenue calculation excludes cancelled and refunded orders
- Admin page appears under the **Sales** group with the **Video** icon
