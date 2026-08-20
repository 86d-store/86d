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

# Instagram Shop Module

📚 **Documentation:** [86d.app/docs/modules/instagram-shop](https://86d.app/docs/modules/instagram-shop)

Instagram Shopping integration for product listings, Instagram media product tagging, catalog synchronization, and order management.

## Installation

```sh
npm install @86d-app/instagram-shop
```

## Usage

```ts
import instagramShop from "@86d-app/instagram-shop";

const module = instagramShop({
  accessToken: "your-access-token",
  businessId: "your-business-id",
  catalogId: "your-catalog-id",
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `accessToken` | `string` | - | Instagram API access token |
| `businessId` | `string` | - | Instagram Business account ID |
| `catalogId` | `string` | - | Instagram catalog ID |

## Store Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/instagram-shop/webhooks` | Receive Instagram webhook notifications |

## Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/admin/instagram-shop/listings/create` | Create a new listing |
| GET | `/admin/instagram-shop/listings` | List all listings |
| GET | `/admin/instagram-shop/listings/:id` | Get listing by ID |
| POST | `/admin/instagram-shop/listings/:id/update` | Update a listing |
| POST | `/admin/instagram-shop/listings/:id/delete` | Delete a listing |
| POST | `/admin/instagram-shop/listings/:id/tag` | Tag a product in an Instagram post |
| POST | `/admin/instagram-shop/listings/:id/untag` | Remove a product tag from a post |
| POST | `/admin/instagram-shop/sync` | Trigger catalog sync |
| GET | `/admin/instagram-shop/syncs` | List catalog sync history |
| GET | `/admin/instagram-shop/orders` | List all orders |
| GET | `/admin/instagram-shop/orders/:id` | Get order by ID |
| POST | `/admin/instagram-shop/orders/:id/status` | Update order status |
| GET | `/admin/instagram-shop/stats` | Get channel statistics |

## Controller API

```ts
interface InstagramShopController extends ModuleController {
  createListing(params: { localProductId: string; title: string; externalProductId?: string; status?: ListingStatus; syncStatus?: SyncStatus; metadata?: Record<string, unknown> }): Promise<Listing>;
  updateListing(id: string, params: Partial<Listing>): Promise<Listing | null>;
  deleteListing(id: string): Promise<boolean>;
  getListing(id: string): Promise<Listing | null>;
  getListingByProduct(localProductId: string): Promise<Listing | null>;
  listListings(params?: { status?: ListingStatus; syncStatus?: SyncStatus; take?: number; skip?: number }): Promise<Listing[]>;
  tagProduct(listingId: string, mediaId: string): Promise<Listing | null>;
  untagProduct(listingId: string, mediaId: string): Promise<Listing | null>;
  getProductTags(listingId: string): Promise<string[]>;
  syncCatalog(): Promise<CatalogSync>;
  getLastSync(): Promise<CatalogSync | null>;
  listSyncs(params?: { take?: number; skip?: number }): Promise<CatalogSync[]>;
  receiveOrder(params: { externalOrderId: string; instagramOrderId: string; igUsername?: string; items: unknown[]; subtotal: number; shippingFee: number; platformFee: number; total: number; ... }): Promise<ChannelOrder>;
  getOrder(id: string): Promise<ChannelOrder | null>;
  updateOrderStatus(id: string, status: OrderStatus, trackingNumber?: string, trackingUrl?: string): Promise<ChannelOrder | null>;
  listOrders(params?: { status?: OrderStatus; take?: number; skip?: number }): Promise<ChannelOrder[]>;
  getChannelStats(): Promise<ChannelStats>;
}
```

## Types

```ts
type ListingStatus = "draft" | "pending" | "active" | "rejected" | "suspended";
type SyncStatus = "pending" | "synced" | "failed" | "outdated";
type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "cancelled" | "refunded";
type CatalogSyncStatus = "pending" | "syncing" | "synced" | "failed";
```

## Notes

- Product tagging (`tagProduct`/`untagProduct`) links products to Instagram media posts and stories via media IDs.
- Each listing tracks an `instagramMediaIds` array of tagged media.
- Orders include Instagram-specific fields: `instagramOrderId` and `igUsername`.
- Similar architecture to the facebook-shop module, with added media tagging capabilities.
- Revenue calculations in stats exclude cancelled and refunded orders.
- Catalog sync creates a tracking record; connect to Instagram Graph API for actual synchronization.
