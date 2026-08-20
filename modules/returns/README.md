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

# Returns Module

📚 **Documentation:** [86d.app/docs/modules/returns](https://86d.app/docs/modules/returns)

Contains the legacy return workflow and exposes an additive authoritative request foundation. The foundation snapshots line quantities and reasons, validates cumulative quantities against Orders, replays operations deterministically, and commits `return.requested@1` atomically.

**Target flow:** requested -> approved -> received -> completed. Customer reads/writes and all lifecycle mutations remain contained until Store Customer/guest-proof authorization and the authoritative cross-owner workflows are durable.

## Installation

```sh
npm install @86d-app/returns
```

## Usage

```ts
import returns from "@86d-app/returns";

const module = returns({
  returnWindowDays: 30,
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `returnWindowDays` | `number` | `30` | Maximum days after order placement to allow a return request |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/returns` | Contained: verified Store Customer or guest proof required |
| `GET` | `/returns/:id` | Contained: verified Store Customer or guest proof required |

No shopper write transport is registered yet. Legacy submit accepted browser-owned product and monetary snapshots, while legacy cancellation equated a raw authentication ID with a Store Customer. Both remain unregistered until a trusted Command adapter can authorize a resolved Store Customer or admin and supply explicit actor/authority evidence.

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/returns` | List all return requests (paginated) |
| `GET` | `/admin/returns/summary` | Get return statistics summary |
| `GET` | `/admin/returns/:id` | Get return request with items |
| `POST` | `/admin/returns/:id/approve` | Contained: durable lifecycle workflow required |
| `POST` | `/admin/returns/:id/reject` | Contained: durable lifecycle workflow required |
| `POST` | `/admin/returns/:id/received` | Contained: returns `503` until durable disposition/restock coordination exists |
| `POST` | `/admin/returns/:id/complete` | Contained: returns `503` until durable refund and reversal coordination exists |
| `POST` | `/admin/returns/:id/cancel` | Contained: durable reversal workflow required |
| `PUT` | `/admin/returns/:id/tracking` | Contained: Shipping-owned return tracking required |

## Controller API

The legacy `ReturnController` remains exported for migration compatibility. Other Modules must not use it to issue refunds, restock, or claim authoritative Return outcomes.

```ts
interface ReturnController {
  create(params: CreateReturnParams): Promise<ReturnRequestWithItems>;
  getById(id: string): Promise<ReturnRequestWithItems | null>;
  getByOrderId(orderId: string): Promise<ReturnRequest[]>;
  getByCustomerId(customerId: string, params?: { status?: ReturnStatus; take?: number; skip?: number }): Promise<ReturnRequest[]>;

  approve(id: string, adminNotes?: string): Promise<ReturnRequest | null>;
  reject(id: string, adminNotes?: string): Promise<ReturnRequest | null>;
  markReceived(id: string): Promise<ReturnRequest | null>;
  complete(id: string, refundAmount: number): Promise<ReturnRequest | null>;
  cancel(id: string): Promise<ReturnRequest | null>;

  updateTracking(id: string, trackingNumber: string, carrier?: string): Promise<ReturnRequest | null>;

  list(params?: { status?: ReturnStatus; take?: number; skip?: number }): Promise<ReturnRequest[]>;
  getSummary(): Promise<ReturnSummary>;
}
```

## Types

```ts
type ReturnStatus = "requested" | "approved" | "rejected" | "received" | "completed" | "cancelled";
type RefundMethod = "original_payment" | "store_credit" | "exchange";
type ItemReturnReason = "damaged" | "defective" | "wrong_item" | "not_as_described" | "changed_mind" | "too_small" | "too_large" | "other";
type ItemCondition = "unopened" | "opened" | "used" | "damaged";

interface ReturnRequest {
  id: string;
  orderId: string;
  customerId: string;
  status: ReturnStatus;
  refundMethod: RefundMethod;
  refundAmount: number;
  currency: string;
  reason: string;
  customerNotes?: string;
  adminNotes?: string;
  trackingNumber?: string;
  trackingCarrier?: string;
  requestedAt: Date;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface ReturnItem {
  id: string;
  returnRequestId: string;
  orderItemId: string;
  productName: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  reason: ItemReturnReason;
  condition: ItemCondition;
  notes?: string;
  createdAt: Date;
}

interface ReturnRequestWithItems extends ReturnRequest {
  items: ReturnItem[];
}

interface ReturnSummary {
  totalRequests: number;
  requested: number;
  approved: number;
  completed: number;
  rejected: number;
  totalRefundAmount: number;
}
```

## Store Components

### ReturnStatus

Displays the current status of a return request including items, refund amount, refund method, and tracking information. Fetches return details by ID from the module client.

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | Yes | The ID of the return request to display status for. |

#### Usage in MDX

```mdx
<ReturnStatus id={returnId} />
```

Best used on a return detail page or order history section to show customers the progress of their return request.

## Notes

- `requestAuthoritativeReturn` is an unregistered owner-local foundation. It requires row-locking transactions and the typed Orders line-quantity capability.
- One operation ID maps to one normalized input digest and one deterministic request. Same-input retries replay; changed input conflicts.
- Cumulative request quantities cannot exceed an immutable Order line. Authoritative snapshots currently consume capacity permanently; a future durable lifecycle state will release rejected/cancelled capacity without rewriting history.
- Cumulative admission currently covers authoritative snapshots only. Legacy requests need a reviewed backfill before activation.
- Request state, replay receipt, and `return.requested@1` commit in one owner transaction. The fact includes explicit actor and authority evidence but no provider credentials or monetary outcome.
- The foundation does not issue refunds, restock Inventory, change Fulfillment or Payment state, adjust tax or loyalty, or send communications.
- Return-window, paid/terminal Order eligibility, resolved Customer ownership, and Store-bound authority checks remain prerequisites for a registered Command transport.
- Legacy reads and remaining status endpoints are migration surfaces, not proof that the complete Return workflow is Stable.
