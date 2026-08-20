<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/logo" height="96" alt="86d" />
  </a>
</p>

<p align="center">
  Dynamic Commerce
</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use. Please proceed with caution. Use at your own risk.

# Preorders Module

📚 **Documentation:** [86d.app/docs/modules/preorders](https://86d.app/docs/modules/preorders)

Preorder campaign management for upcoming, limited-edition, or out-of-stock products. Create time-bound campaigns with full payment or deposit options, track customer preorders through the fulfillment lifecycle, and notify customers when products are ready to ship.

## Installation

```sh
npm install @86d-app/preorders
```

## Usage

```ts
import preorders from "@86d-app/preorders";

const module = preorders({
  defaultMessage: "Expected to ship Q2 2027",
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `defaultMessage` | `string` | — | Default message shown on preorder campaign pages |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/preorders/campaigns` | List active preorder campaigns (filterable by productId) |
| `GET` | `/preorders/campaigns/:id` | Get an active campaign's details |
| `GET` | `/preorders/check/:productId` | Check if a product has an active preorder campaign |
| `POST` | `/preorders/place` | Place a preorder for a campaign |
| `GET` | `/preorders/mine` | List the current customer's preorders |
| `POST` | `/preorders/:id/cancel` | Cancel a preorder |

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/preorders/campaigns` | List all campaigns (filterable by status, productId) |
| `POST` | `/admin/preorders/campaigns/create` | Create a new preorder campaign |
| `GET` | `/admin/preorders/campaigns/:id` | Get campaign details with preorder items |
| `PATCH` | `/admin/preorders/campaigns/:id/update` | Update campaign fields |
| `POST` | `/admin/preorders/campaigns/:id/activate` | Activate a draft or paused campaign |
| `POST` | `/admin/preorders/campaigns/:id/pause` | Pause an active campaign |
| `POST` | `/admin/preorders/campaigns/:id/complete` | Mark campaign as completed |
| `POST` | `/admin/preorders/campaigns/:id/cancel` | Cancel campaign and all pending items |
| `POST` | `/admin/preorders/campaigns/:id/notify` | Notify confirmed/ready customers |
| `GET` | `/admin/preorders/items` | List all preorder items (filterable) |
| `POST` | `/admin/preorders/items/:id/fulfill` | Fulfill a preorder item |
| `POST` | `/admin/preorders/items/:id/ready` | Mark a preorder item as ready to ship |
| `POST` | `/admin/preorders/items/:id/cancel` | Cancel a preorder item |
| `GET` | `/admin/preorders/summary` | Dashboard summary with campaign and revenue stats |

## Admin UI

The module includes admin UI components in `src/admin/components/index.tsx` (client components using `useModuleClient`):

| Page | Component | Description |
|------|-----------|-------------|
| `/admin/preorders` | `CampaignList` | Campaign list with status filters, create forms, and lifecycle actions |
| `/admin/preorders/campaigns/:id` | `CampaignDetail` | Campaign detail with preorder items, fulfillment, and customer notifications |

## Controller API

```ts
interface PreordersController {
  createCampaign(params: {
    productId: string;
    productName: string;
    variantId?: string;
    variantLabel?: string;
    paymentType: "full" | "deposit";
    depositAmount?: number;
    depositPercent?: number;
    price: number;
    maxQuantity?: number;
    startDate: Date;
    endDate?: Date;
    estimatedShipDate?: Date;
    message?: string;
  }): Promise<PreorderCampaign>;

  getCampaign(id: string): Promise<PreorderCampaign | null>;
  listCampaigns(params?: { status?; productId?; take?; skip? }): Promise<PreorderCampaign[]>;
  updateCampaign(id: string, updates: { productName?; paymentType?; depositAmount?; depositPercent?; price?; maxQuantity?; endDate?; estimatedShipDate?; message? }): Promise<PreorderCampaign | null>;
  activateCampaign(id: string): Promise<PreorderCampaign | null>;
  pauseCampaign(id: string): Promise<PreorderCampaign | null>;
  completeCampaign(id: string): Promise<PreorderCampaign | null>;
  cancelCampaign(id: string, reason?: string): Promise<PreorderCampaign | null>;

  placePreorder(params: { campaignId; customerId; customerEmail; quantity }): Promise<PreorderItem | null>;
  getPreorderItem(id: string): Promise<PreorderItem | null>;
  listPreorderItems(params?: { campaignId?; customerId?; status?; take?; skip? }): Promise<PreorderItem[]>;
  getCustomerPreorders(customerId: string, params?: { take?; skip? }): Promise<PreorderItem[]>;
  cancelPreorderItem(id: string, reason?: string): Promise<PreorderItem | null>;
  fulfillPreorderItem(id: string, orderId?: string): Promise<PreorderItem | null>;
  markReady(id: string): Promise<PreorderItem | null>;
  notifyCustomers(campaignId: string): Promise<{ notified: number; itemIds: string[] }>;
  getSummary(): Promise<PreorderSummary>;
  getActiveCampaignForProduct(productId: string, variantId?: string): Promise<PreorderCampaign | null>;
}
```

## Types

```ts
type CampaignStatus = "draft" | "active" | "paused" | "completed" | "cancelled";
type PreorderItemStatus = "pending" | "confirmed" | "ready" | "fulfilled" | "cancelled" | "refunded";
type PaymentType = "full" | "deposit";

interface PreorderCampaign {
  id: string;
  productId: string;
  productName: string;
  variantId?: string;
  variantLabel?: string;
  status: CampaignStatus;
  paymentType: PaymentType;
  depositAmount?: number;
  depositPercent?: number;
  price: number;
  maxQuantity?: number;
  currentQuantity: number;
  startDate: Date;
  endDate?: Date;
  estimatedShipDate?: Date;
  message?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface PreorderItem {
  id: string;
  campaignId: string;
  customerId: string;
  customerEmail: string;
  quantity: number;
  status: PreorderItemStatus;
  depositPaid: number;
  totalPrice: number;
  orderId?: string;
  notifiedAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;
  fulfilledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface PreorderSummary {
  totalCampaigns: number;
  activeCampaigns: number;
  totalItems: number;
  pendingItems: number;
  confirmedItems: number;
  fulfilledItems: number;
  cancelledItems: number;
  totalRevenue: number;
  totalDeposits: number;
}
```

## Campaign Lifecycle

```
draft → active ⇄ paused → completed
   ↘       ↘        ↘
              cancelled
```

- **draft**: Campaign created with a future start date, not yet accepting preorders
- **active**: Campaign is live and accepting preorders
- **paused**: Temporarily stopped accepting new preorders
- **completed**: All preorders fulfilled, campaign finished
- **cancelled**: Campaign terminated, all pending/confirmed items auto-cancelled

## Item Lifecycle

```
pending → confirmed → ready → fulfilled
   ↘         ↘
       cancelled / refunded
```

- **pending**: Customer placed preorder, awaiting confirmation
- **confirmed**: Payment verified, preorder confirmed
- **ready**: Product is available and ready to ship
- **fulfilled**: Order shipped to customer
- **cancelled**: Preorder was cancelled before fulfillment
- **refunded**: Payment was refunded after cancellation

## Store Components

| Component | Description |
|-----------|-------------|
| `PreorderButton` | Button to place a preorder for a product with an active campaign |
| `MyPreorders` | List of the current customer's preorders with status tracking |

### Usage

```tsx
import { PreorderButton, MyPreorders } from "@86d-app/preorders/store/components";

<PreorderButton productId="abc-123" />
<MyPreorders customerId="customer-456" />
```

## Notes

- Campaigns auto-activate when `startDate` is in the past at creation time.
- For deposit-based campaigns, `depositAmount` takes precedence over `depositPercent`. If neither is set, full price is charged.
- Cancelling a campaign automatically cancels all pending and confirmed preorder items with the reason "Campaign cancelled".
- `currentQuantity` is automatically incremented on preorder placement and decremented on cancellation.
- The `notifyCustomers` endpoint marks confirmed/ready items as notified (idempotent — skips already-notified items).
- The module requires the `products` module.
