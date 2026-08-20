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

# eBay Module

📚 **Documentation:** [86d.app/docs/modules/ebay](https://86d.app/docs/modules/ebay)

eBay marketplace integration supporting fixed-price and auction listings, order management, and channel analytics.

## Installation

```sh
npm install @86d-app/ebay
```

## Usage

```ts
import ebay from "@86d-app/ebay";

const module = ebay({
  clientId: "your-client-id",
  clientSecret: "your-client-secret",
  refreshToken: "your-refresh-token",
  siteId: "EBAY_US",
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `clientId` | `string` | - | eBay API client ID |
| `clientSecret` | `string` | - | eBay API client secret |
| `refreshToken` | `string` | - | eBay API refresh token |
| `siteId` | `string` | `"EBAY_US"` | eBay site ID |

## Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/ebay/listings` | List listings with optional status, listing type, page, and limit filters |
| POST | `/admin/ebay/listings/create` | Create a new listing (fixed-price or auction) |
| GET | `/admin/ebay/listings/:id` | Get a single listing by ID |
| PUT | `/admin/ebay/listings/:id/update` | Update listing fields (title, price, quantity, condition, etc.) |
| PUT | `/admin/ebay/listings/:id/end` | End a listing |
| GET | `/admin/ebay/orders` | List orders with optional status, page, and limit filters |
| PUT | `/admin/ebay/orders/:id/ship` | Ship an order with tracking number and carrier |
| GET | `/admin/ebay/stats` | Get channel statistics |
| GET | `/admin/ebay/auctions` | Get active auction listings |

## Store Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/ebay/webhooks` | Receive eBay webhook events (e.g. `order.created` triggers order ingestion) |

## Controller API

```ts
interface EbayController extends ModuleController {
  createListing(params: { localProductId: string; title: string; price: number; listingType?: ListingType; auctionStartPrice?: number; quantity?: number; condition?: ListingCondition; categoryId?: string; duration?: string; metadata?: Record<string, unknown> }): Promise<EbayListing>;
  updateListing(id: string, params: Partial<EbayListing>): Promise<EbayListing | null>;
  endListing(id: string): Promise<EbayListing | null>;
  getListing(id: string): Promise<EbayListing | null>;
  getListingByProduct(productId: string): Promise<EbayListing | null>;
  listListings(params?: { status?: ListingStatus; listingType?: ListingType; take?: number; skip?: number }): Promise<EbayListing[]>;
  receiveOrder(params: { ebayOrderId: string; items: unknown[]; subtotal: number; shippingCost: number; ebayFee: number; paymentProcessingFee: number; total: number; ... }): Promise<EbayOrder>;
  getOrder(id: string): Promise<EbayOrder | null>;
  shipOrder(id: string, trackingNumber: string, carrier: string): Promise<EbayOrder | null>;
  listOrders(params?: { status?: EbayOrderStatus; take?: number; skip?: number }): Promise<EbayOrder[]>;
  getChannelStats(): Promise<ChannelStats>;
  getActiveAuctions(): Promise<EbayListing[]>;
}
```

## Types

```ts
type ListingStatus = "active" | "ended" | "sold" | "draft" | "error";
type ListingType = "fixed-price" | "auction";
type ListingCondition = "new" | "like-new" | "very-good" | "good" | "acceptable" | "for-parts";
type EbayOrderStatus = "pending" | "paid" | "shipped" | "delivered" | "cancelled" | "returned";
```

## Notes

- Supports both fixed-price and auction listing types with bid tracking.
- Auction listings track `currentBid`, `bidCount`, `startTime`, and `endTime`.
- `endListing()` marks the listing as ended and records the end timestamp.
- Fee tracking includes both eBay fees and payment processing fees per order.
- Channel stats calculate average price across active listings.
- Admin and store endpoints are fully wired via `createAdminEndpoint` and `createStoreEndpoint`.
