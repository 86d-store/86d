<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/icon" height="96" alt="86d" />
  </a>
</p>

<p align="center">
  The Modern Foundation for Commerce
</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use. Please proceed with caution. Use at your own risk. 

📚 **Documentation:** [86d.app/docs/modules/giftcards](https://86d.app/docs/modules/giftcards)

# Gift Cards Module

Read-only gift card records, balance and status lookup, owned-card delivery metadata, and analytics for 86d commerce. Issuance, purchase, top-up, credit, redemption, status mutation, and deletion are unavailable until complete Workflows own those operations with durable evidence.

## Installation

```sh
npm install @86d-app/giftcards
```

## Usage

```ts
import giftCards from "@86d-app/giftcards";

const module = giftCards();
```

## Configuration

The contained projection has no Module-specific configuration.

## Store Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/gift-cards/check?code=...` | No | Check balance and status by code |
| `POST` | `/gift-cards/send` | Yes | Record intended email-delivery metadata for an owned card without confirming delivery |
| `GET` | `/gift-cards/my-cards` | Yes | List authenticated customer's gift cards |

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/gift-cards` | List gift cards with server-wide search, status filtering, sorting, and pagination |
| `GET` | `/admin/gift-cards/stats` | Get gift card analytics and statistics |
| `GET` | `/admin/gift-cards/:id` | Get a gift card by ID |
| `GET` | `/admin/gift-cards/:id/transactions` | List transactions for a card |

The store admin overview is read-only. Its searchable, sortable record table
persists status, sort, search, and column-visibility preferences in the browser,
and opens card balances and transaction history without exposing mutation
controls.

## Controller API

```ts
interface GiftCardController {
  get(id: string): Promise<GiftCard | null>;
  getByCode(code: string): Promise<GiftCard | null>;
  list(params?: { status?; customerId?; take?; skip? }): Promise<GiftCard[]>;
  listAdminPage(params?: {
    status?: string;
    customerId?: string;
    search?: string;
    sort?: "code" | "balance" | "status" | "recipient" | "createdAt";
    direction?: "asc" | "desc";
    take?: number;
    skip?: number;
  }): Promise<{ cards: GiftCard[]; total: number }>;
  countAll(): Promise<number>;

  checkBalance(code: string): Promise<{ balance; currency; status } | null>;
  listTransactions(giftCardId: string, params?: { take?; skip? }): Promise<GiftCardTransaction[]>;

  sendGiftCard(params: SendGiftCardParams): Promise<GiftCard | null>;
  listByCustomer(customerId: string, params?: { take?; skip? }): Promise<GiftCard[]>;
  getStats(): Promise<GiftCardStats>;
}
```

The controller intentionally has no money or destructive mutation primitive. Store and admin transports expose only the non-money operations listed above, and the Checkout capability returns an unavailable decision for both application and redemption until a complete Checkout Workflow can coordinate the discount, debit, Payment, and Order with durable evidence, idempotency, and closed repair behavior. Legacy card and transaction fields remain readable so existing records can be inspected.

## Types

```ts
interface GiftCard {
  id: string;
  code: string;                    // common legacy format: GIFT-XXXX-XXXX-XXXX
  initialBalance: number;
  currentBalance: number;
  currency: string;
  status: string;                  // common: active, disabled, expired, depleted
  expiresAt?: string;
  recipientEmail?: string;
  recipientName?: string;
  customerId?: string;             // owner
  purchasedByCustomerId?: string;  // buyer (may differ from owner)
  senderName?: string;
  senderEmail?: string;
  message?: string;                // personal message
  deliveryMethod?: string;         // common: email, physical, digital
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
  type: string;                    // common: debit, credit, purchase, topup
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

## Notes

- Legacy records commonly use uppercase `GIFT-XXXX-XXXX-XXXX` codes; this contained projection accepts arbitrary stored strings and does not generate codes
- Balance check (`/gift-cards/check`) is public — no authentication required
- Gift card money and destructive mutations are not exposed through Store, admin, or controller surfaces
- Authenticated store endpoints derive customer identity from the session
- `sendGiftCard()` records intended delivery metadata but does not itself deliver a message or set `delivered`/`deliveredAt`; the endpoint returns `deliveryMetadataRecorded: true` and `delivered: false`, and it fails closed without owner-local row locking
- Expired cards and cards with any existing delivery marker cannot be recorded again, which prevents forwarding and partial-state overwrite through this surface
- Legacy money fields and transaction types are retained only for read compatibility
