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

# Google Shopping Module

📚 **Documentation:** [86d.app/docs/modules/google-shopping](https://86d.app/docs/modules/google-shopping)

Integrates your 86d store with Google Merchant Center for product feed management, feed submission tracking, order handling, and feed diagnostics. Supports Google Shopping product data specifications including GTIN, MPN, brand, condition, and availability.

## Installation

```sh
npm install @86d-app/google-shopping
```

## Usage

```ts
import googleShopping from "@86d-app/google-shopping";

const module = googleShopping({
  merchantId: "your-merchant-id",
  apiKey: "your-api-key",
  targetCountry: "US",
  contentLanguage: "en",
});
```

## Configuration

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `merchantId` | `string` | - | Google Merchant Center ID |
| `apiKey` | `string` | - | Google API key |
| `targetCountry` | `string` | `"US"` | Target country code |
| `contentLanguage` | `string` | `"en"` | Content language |

## Store Endpoints

| Method | Path | Description |
| --- | --- | --- |
| POST | `/google-shopping/webhooks` | Receive Google Shopping webhook events |

## Admin Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/admin/google-shopping/feed-items` | List all feed items |
| POST | `/admin/google-shopping/feed-items/create` | Create a feed item |
| GET | `/admin/google-shopping/feed-items/:id` | Get a specific feed item |
| POST | `/admin/google-shopping/feed-items/:id/update` | Update a feed item |
| POST | `/admin/google-shopping/feed-items/:id/delete` | Delete a feed item |
| POST | `/admin/google-shopping/submit` | Submit product feed |
| GET | `/admin/google-shopping/submissions` | List feed submissions |
| GET | `/admin/google-shopping/orders` | List orders |
| POST | `/admin/google-shopping/orders/:id/status` | Update order status |
| GET | `/admin/google-shopping/stats` | Get channel statistics |
| GET | `/admin/google-shopping/diagnostics` | Get feed diagnostics |

## Controller API

```ts
interface GoogleShoppingController extends ModuleController {
  createFeedItem(params: { localProductId: string; title: string; price: number; link: string; imageLink: string; ... }): Promise<ProductFeedItem>;
  updateFeedItem(id: string, params: Partial<ProductFeedItem>): Promise<ProductFeedItem | null>;
  deleteFeedItem(id: string): Promise<boolean>;
  getFeedItem(id: string): Promise<ProductFeedItem | null>;
  getFeedItemByProduct(localProductId: string): Promise<ProductFeedItem | null>;
  listFeedItems(params?: { status?; take?; skip? }): Promise<ProductFeedItem[]>;
  submitFeed(): Promise<FeedSubmission>;
  getLastSubmission(): Promise<FeedSubmission | null>;
  listSubmissions(params?: { take?; skip? }): Promise<FeedSubmission[]>;
  receiveOrder(params: { googleOrderId: string; items: unknown[]; ... }): Promise<ChannelOrder>;
  getOrder(id: string): Promise<ChannelOrder | null>;
  updateOrderStatus(id: string, status: OrderStatus, trackingNumber?, carrier?): Promise<ChannelOrder | null>;
  listOrders(params?: { status?; take?; skip? }): Promise<ChannelOrder[]>;
  getChannelStats(): Promise<ChannelStats>;
  getDiagnostics(): Promise<FeedDiagnostics>;
}
```

## Types

- **ProductFeedItem** -- Product feed entry with Google-specific fields (googleCategory, condition, availability, GTIN, MPN, brand) and disapproval tracking
- **ChannelOrder** -- Order from Google Shopping with cost breakdown (subtotal, shippingCost, tax, total) and carrier tracking
- **FeedSubmission** -- Feed submission record tracking approved/disapproved product counts
- **FeedDiagnostics** -- Aggregated status breakdown and disapproval reason frequency

## Notes

- Feed item statuses: `active`, `pending`, `disapproved`, `expiring`
- Feed item conditions: `new`, `refurbished`, `used`
- Availability values: `in-stock`, `out-of-stock`, `preorder`
- Order statuses include `returned` in addition to the standard set
- Admin page appears under the **Sales** group with the **Search** icon
