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

# Gift Cards Module

📚 **Documentation:** [86d.app/docs/modules/giftcards](https://86d.app/docs/modules/giftcards)

Full-featured gift card system for 86d commerce: purchasing, gifting, redemption, top-ups, balance management, bulk issuance, and analytics.

## Installation

```sh
npm install @86d-app/giftcards
```

## Usage

```ts
import giftCards from "@86d-app/giftcards";

const module = giftCards({
  defaultCurrency: "USD",
  maxBalance: 50000,
  denominations: "1000,2500,5000,10000",
  maxBulkCount: 100,
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `defaultCurrency` | `string` | `"USD"` | Default currency for new gift cards |
| `maxBalance` | `number` | — | Maximum allowed balance per card |
| `denominations` | `string` | — | Comma-separated allowed amounts (e.g. `"1000,2500,5000"`) |
| `maxBulkCount` | `number` | `100` | Maximum cards per bulk creation |

## Store Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/gift-cards/check?code=...` | No | Check balance and status by code |
| `POST` | `/gift-cards/redeem` | Yes | Redeem a gift card for an amount |
| `POST` | `/gift-cards/purchase` | Yes | Purchase a new gift card (for self or as gift) |
| `POST` | `/gift-cards/send` | Yes | Send an owned gift card to a recipient via email |
| `GET` | `/gift-cards/my-cards` | Yes | List authenticated customer's gift cards |
| `POST` | `/gift-cards/top-up` | Yes | Add balance to an owned gift card |

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/gift-cards` | List all gift cards (filterable by status, customerId) |
| `POST` | `/admin/gift-cards/create` | Issue a new gift card |
| `POST` | `/admin/gift-cards/bulk-create` | Create multiple gift cards at once |
| `GET` | `/admin/gift-cards/stats` | Get gift card analytics and statistics |
| `POST` | `/admin/gift-cards/disable-expired` | Batch disable all expired cards |
| `GET` | `/admin/gift-cards/:id` | Get a gift card by ID |
| `POST` | `/admin/gift-cards/:id/update` | Update gift card details |
| `POST` | `/admin/gift-cards/:id/delete` | Delete a gift card and its transactions |
| `POST` | `/admin/gift-cards/:id/credit` | Add balance to a card (refund/bonus) |
| `GET` | `/admin/gift-cards/:id/transactions` | List transactions for a card |

## Controller API

```ts
interface GiftCardController {
  // Core CRUD
  create(params: CreateGiftCardParams): Promise<GiftCard>;
  get(id: string): Promise<GiftCard | null>;
  getByCode(code: string): Promise<GiftCard | null>;
  list(params?: { status?; customerId?; take?; skip? }): Promise<GiftCard[]>;
  update(id: string, data: Partial<Pick<GiftCard, "status" | "expiresAt" | "note" | "recipientEmail" | "recipientName" | "delivered" | "deliveredAt">>): Promise<GiftCard | null>;
  delete(id: string): Promise<boolean>;
  countAll(): Promise<number>;

  // Balance operations
  checkBalance(code: string): Promise<{ balance; currency; status } | null>;
  redeem(code: string, amount: number, orderId?: string): Promise<RedeemResult | null>;
  credit(id: string, amount: number, note?: string, orderId?: string): Promise<RedeemResult | null>;
  listTransactions(giftCardId: string, params?: { take?; skip? }): Promise<GiftCardTransaction[]>;

  // Customer-facing
  purchase(params: PurchaseGiftCardParams): Promise<GiftCard>;
  topUp(params: TopUpParams): Promise<RedeemResult | null>;
  sendGiftCard(params: SendGiftCardParams): Promise<GiftCard | null>;
  listByCustomer(customerId: string, params?: { take?; skip? }): Promise<GiftCard[]>;

  // Admin operations
  bulkCreate(params: BulkCreateParams): Promise<GiftCard[]>;
  getStats(): Promise<GiftCardStats>;
  disableExpired(): Promise<number>;
}
```

## Types

```ts
type GiftCardStatus = "active" | "disabled" | "expired" | "depleted";
type TransactionType = "debit" | "credit" | "purchase" | "topup";
type DeliveryMethod = "email" | "physical" | "digital";

interface GiftCard {
  id: string;
  code: string;                    // GIFT-XXXX-XXXX-XXXX
  initialBalance: number;
  currentBalance: number;
  currency: string;
  status: GiftCardStatus;
  expiresAt?: string;
  recipientEmail?: string;
  recipientName?: string;
  customerId?: string;             // owner
  purchasedByCustomerId?: string;  // buyer (may differ from owner)
  senderName?: string;
  senderEmail?: string;
  message?: string;                // personal message
  deliveryMethod?: DeliveryMethod;
  delivered?: boolean;
  deliveredAt?: Date;
  scheduledDeliveryAt?: string;
  purchaseOrderId?: string;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface GiftCardTransaction {
  id: string;
  giftCardId: string;
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  orderId?: string;
  customerId?: string;
  note?: string;
  createdAt: Date;
}

interface GiftCardStats {
  totalIssued: number;
  totalActive: number;
  totalDepleted: number;
  totalDisabled: number;
  totalExpired: number;
  totalIssuedValue: number;
  totalRedeemedValue: number;
  totalOutstandingBalance: number;
}
```

## Store Components

### GiftCardBalance

Balance checker — customer enters code to check balance.

#### Usage in MDX

```mdx
<GiftCardBalance />
```

### GiftCardRedeem

Redeem form — apply gift card to an order at checkout.

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `orderId` | `string` | Optional order ID |
| `orderTotal` | `number` | Order total in cents |
| `onApplied` | `(amountApplied, remainingBalance) => void` | Callback when applied |

#### Usage in MDX

```mdx
<GiftCardRedeem orderTotal={cartTotal} onApplied={handleApplied} />
```

## Notes

- Gift card codes use uppercase alphanumeric characters, excluding ambiguous chars (0/O/1/I/L)
- Balance check (`/gift-cards/check`) is public — no authentication required
- All other store endpoints require authentication and derive customer identity from the session
- Purchasing a gift card for someone else does not assign `customerId` — only `purchasedByCustomerId` is set
- Cards that have already been delivered cannot be re-sent to prevent forwarding abuse
- The `disableExpired` admin endpoint is idempotent — only active cards with past expiration are affected
