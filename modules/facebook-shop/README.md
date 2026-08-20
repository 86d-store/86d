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

# Facebook Shop Module

📚 **Documentation:** [86d.app/docs/modules/facebook-shop](https://86d.app/docs/modules/facebook-shop)

Facebook/Meta Commerce integration for catalog synchronization, product listings, order management, and shop collections.

## Installation

```sh
npm install @86d-app/facebook-shop
```

## Usage

```ts
import facebookShop from "@86d-app/facebook-shop";

const module = facebookShop({
  accessToken: "your-access-token",
  pageId: "your-page-id",
  catalogId: "your-catalog-id",
  commerceAccountId: "your-commerce-account-id",
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `accessToken` | `string` | - | Facebook API access token |
| `pageId` | `string` | - | Facebook Page ID |
| `catalogId` | `string` | - | Facebook catalog ID |
| `commerceAccountId` | `string` | - | Meta Commerce Manager account ID |

## Store Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/facebook-shop/webhooks` | Receive Facebook webhook notifications |

## Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/admin/facebook-shop/listings/create` | Create a new listing |
| GET | `/admin/facebook-shop/listings` | List all listings |
| GET | `/admin/facebook-shop/listings/:id` | Get listing by ID |
| POST | `/admin/facebook-shop/listings/:id/update` | Update a listing |
| POST | `/admin/facebook-shop/listings/:id/delete` | Delete a listing |
| POST | `/admin/facebook-shop/sync` | Trigger catalog sync |
| GET | `/admin/facebook-shop/syncs` | List catalog sync history |
| GET | `/admin/facebook-shop/orders` | List all orders |
| GET | `/admin/facebook-shop/orders/:id` | Get order by ID |
| POST | `/admin/facebook-shop/orders/:id/status` | Update order status |
| POST | `/admin/facebook-shop/collections/create` | Create a collection |
| GET | `/admin/facebook-shop/collections` | List all collections |
| POST | `/admin/facebook-shop/collections/:id/delete` | Delete a collection |
| GET | `/admin/facebook-shop/stats` | Get channel statistics |

## Controller API

```ts
interface FacebookShopController extends ModuleController {
  createListing(params: { localProductId: string; title: string; externalProductId?: string; status?: ListingStatus; syncStatus?: SyncStatus; metadata?: Record<string, unknown> }): Promise<Listing>;
  updateListing(id: string, params: Partial<Listing>): Promise<Listing | null>;
  deleteListing(id: string): Promise<boolean>;
  getListing(id: string): Promise<Listing | null>;
  getListingByProduct(localProductId: string): Promise<Listing | null>;
  listListings(params?: { status?: ListingStatus; syncStatus?: SyncStatus; take?: number; skip?: number }): Promise<Listing[]>;
  syncCatalog(): Promise<CatalogSync>;
  getLastSync(): Promise<CatalogSync | null>;
  listSyncs(params?: { take?: number; skip?: number }): Promise<CatalogSync[]>;
  receiveOrder(params: { externalOrderId: string; items: unknown[]; subtotal: number; shippingFee: number; platformFee: number; total: number; ... }): Promise<ChannelOrder>;
  getOrder(id: string): Promise<ChannelOrder | null>;
  updateOrderStatus(id: string, status: OrderStatus, trackingNumber?: string, trackingUrl?: string): Promise<ChannelOrder | null>;
  listOrders(params?: { status?: OrderStatus; take?: number; skip?: number }): Promise<ChannelOrder[]>;
  createCollection(name: string, productIds: string[]): Promise<Collection>;
  deleteCollection(id: string): Promise<boolean>;
  listCollections(): Promise<Collection[]>;
  getChannelStats(): Promise<ChannelStats>;
}
```

## Types

```ts
type ListingStatus = "draft" | "pending" | "active" | "rejected" | "suspended";
type SyncStatus = "pending" | "synced" | "failed" | "outdated";
type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "cancelled" | "refunded";
type CatalogSyncStatus = "pending" | "syncing" | "synced" | "failed";
type CollectionStatus = "active" | "inactive";
```

## Notes

- Listings have two status dimensions: `status` (platform review state) and `syncStatus` (data sync state).
- Catalog sync creates a record for tracking progress; connect to Meta Commerce API for actual synchronization.
- Collections allow grouping products for Facebook Shop organization.
- Revenue calculations in stats exclude cancelled and refunded orders.
- Order status updates support optional tracking number and tracking URL.
