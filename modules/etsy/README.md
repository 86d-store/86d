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

# Etsy Module

📚 **Documentation:** [86d.app/docs/modules/etsy](https://86d.app/docs/modules/etsy)

Etsy marketplace integration for managing handmade and vintage product listings, orders, reviews, and shop analytics.

## Installation

```sh
npm install @86d-app/etsy
```

## Usage

```ts
import etsy from "@86d-app/etsy";

const module = etsy({
  apiKey: "your-api-key",
  shopId: "your-shop-id",
  accessToken: "your-access-token",
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | - | Etsy API key |
| `shopId` | `string` | - | Etsy Shop ID |
| `accessToken` | `string` | - | Etsy access token |

## Store Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/etsy/webhooks` | Receive Etsy webhook notifications |

## Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/etsy/listings` | List all listings |
| POST | `/admin/etsy/listings/create` | Create a new listing |
| GET | `/admin/etsy/listings/expiring` | Get listings expiring soon |
| GET | `/admin/etsy/listings/:id` | Get listing by ID |
| POST | `/admin/etsy/listings/:id/update` | Update a listing |
| POST | `/admin/etsy/listings/:id/delete` | Delete a listing |
| POST | `/admin/etsy/listings/:id/renew` | Renew an expired listing |
| GET | `/admin/etsy/orders` | List all orders |
| POST | `/admin/etsy/orders/:id/ship` | Ship an order |
| GET | `/admin/etsy/reviews` | List all reviews |
| GET | `/admin/etsy/reviews/average` | Get average review rating |
| GET | `/admin/etsy/stats` | Get channel statistics |

## Controller API

```ts
interface EtsyController extends ModuleController {
  createListing(params: { localProductId: string; title: string; price: number; description?: string; whoMadeIt?: WhoMadeIt; whenMadeIt?: string; isSupply?: boolean; materials?: string[]; tags?: string[]; ... }): Promise<EtsyListing>;
  updateListing(id: string, params: Partial<EtsyListing>): Promise<EtsyListing | null>;
  deleteListing(id: string): Promise<boolean>;
  getListing(id: string): Promise<EtsyListing | null>;
  getListingByProduct(productId: string): Promise<EtsyListing | null>;
  listListings(params?: { status?: ListingStatus; take?: number; skip?: number }): Promise<EtsyListing[]>;
  renewListing(id: string): Promise<EtsyListing | null>;
  receiveOrder(params: { etsyReceiptId: string; items: unknown[]; subtotal: number; shippingCost: number; etsyFee: number; processingFee: number; tax: number; total: number; ... }): Promise<EtsyOrder>;
  getOrder(id: string): Promise<EtsyOrder | null>;
  shipOrder(id: string, trackingNumber: string, carrier: string): Promise<EtsyOrder | null>;
  listOrders(params?: { status?: EtsyOrderStatus; take?: number; skip?: number }): Promise<EtsyOrder[]>;
  receiveReview(params: { etsyTransactionId: string; rating: number; review?: string; buyerName?: string; listingId?: string }): Promise<EtsyReview>;
  listReviews(params?: { take?: number; skip?: number }): Promise<EtsyReview[]>;
  getAverageRating(): Promise<number>;
  getChannelStats(): Promise<ChannelStats>;
  getExpiringListings(daysAhead: number): Promise<EtsyListing[]>;
}
```

## Types

```ts
type ListingStatus = "active" | "draft" | "expired" | "inactive" | "sold-out";
type ListingState = "draft" | "active" | "inactive";
type WhoMadeIt = "i-did" | "collective" | "someone-else";
type EtsyOrderStatus = "open" | "paid" | "shipped" | "completed" | "cancelled";
```

## Notes

- Etsy-specific listing fields include `whoMadeIt`, `whenMadeIt`, `isSupply`, `materials`, and `tags` (required by Etsy's API).
- Listing renewal adds 120 days to the renewal date and sets status to active.
- `getExpiringListings(daysAhead)` returns active listings that will expire within the specified number of days.
- Review tracking includes average rating calculation (rounded to 2 decimal places).
- Channel stats aggregate views, favorites, and reviews alongside standard listing/order metrics.
- Orders track Etsy fees, processing fees, and tax separately.
