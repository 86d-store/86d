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

# Amazon Module

📚 **Documentation:** [86d.app/docs/modules/amazon](https://86d.app/docs/modules/amazon)

Amazon Seller Central integration for managing product listings, order fulfillment, and inventory synchronization across FBA and FBM channels.

## Installation

```sh
npm install @86d-app/amazon
```

## Usage

```ts
import amazon from "@86d-app/amazon";

const module = amazon({
  sellerId: "A1B2C3D4E5F6G7",
  mwsAuthToken: "amzn.mws.xxx",
  marketplaceId: "ATVPDKIKX0DER",
  region: "NA",
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sellerId` | `string` | - | Amazon Seller ID |
| `mwsAuthToken` | `string` | - | MWS Auth Token |
| `marketplaceId` | `string` | - | Amazon Marketplace ID |
| `region` | `string` | `"NA"` | Amazon region |

## Store Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/amazon/webhooks` | Receive Amazon webhook notifications |

## Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/amazon/listings` | List all listings |
| POST | `/admin/amazon/listings/create` | Create a new listing |
| GET | `/admin/amazon/listings/:id` | Get listing by ID |
| POST | `/admin/amazon/listings/:id/update` | Update a listing |
| POST | `/admin/amazon/listings/:id/delete` | Delete a listing |
| GET | `/admin/amazon/orders` | List all orders |
| POST | `/admin/amazon/orders/:id/ship` | Ship an order |
| POST | `/admin/amazon/orders/:id/cancel` | Cancel an order |
| POST | `/admin/amazon/inventory/sync` | Trigger inventory sync |
| GET | `/admin/amazon/inventory/health` | Get inventory health report |
| GET | `/admin/amazon/stats` | Get channel statistics |

## Controller API

```ts
interface AmazonController extends ModuleController {
  createListing(params: { localProductId: string; asin?: string; sku: string; title: string; price: number; ... }): Promise<Listing>;
  updateListing(id: string, params: Partial<Listing>): Promise<Listing | null>;
  deleteListing(id: string): Promise<boolean>;
  getListing(id: string): Promise<Listing | null>;
  getListingByProduct(productId: string): Promise<Listing | null>;
  getListingByAsin(asin: string): Promise<Listing | null>;
  listListings(params?: { status?: ListingStatus; fulfillmentChannel?: FulfillmentChannel; take?: number; skip?: number }): Promise<Listing[]>;
  syncInventory(): Promise<InventorySync>;
  getLastInventorySync(): Promise<InventorySync | null>;
  receiveOrder(params: { amazonOrderId: string; items: unknown[]; orderTotal: number; ... }): Promise<AmazonOrder>;
  getOrder(id: string): Promise<AmazonOrder | null>;
  shipOrder(id: string, trackingNumber: string, carrier: string): Promise<AmazonOrder | null>;
  cancelOrder(id: string): Promise<AmazonOrder | null>;
  listOrders(params?: { status?: AmazonOrderStatus; fulfillmentChannel?: FulfillmentChannel; take?: number; skip?: number }): Promise<AmazonOrder[]>;
  getChannelStats(): Promise<ChannelStats>;
  getInventoryHealth(): Promise<InventoryHealth>;
}
```

## Types

```ts
type ListingStatus = "active" | "inactive" | "suppressed" | "incomplete";
type FulfillmentChannel = "FBA" | "FBM";
type ListingCondition = "new" | "used-like-new" | "used-very-good" | "used-good" | "used-acceptable" | "refurbished";
type AmazonOrderStatus = "pending" | "unshipped" | "shipped" | "cancelled" | "returned";
type InventorySyncStatus = "pending" | "syncing" | "synced" | "failed";
```

## Notes

- Supports both FBA (Fulfilled by Amazon) and FBM (Fulfilled by Merchant) channels.
- Inventory health tracks low stock (quantity 1-5) and out-of-stock items.
- The `syncInventory()` method creates a sync record; connect to Amazon SP-API for actual sync.
- Buy Box ownership is tracked per listing via the `buyBoxOwned` field.
- Net proceeds are calculated as orderTotal minus marketplaceFee.
