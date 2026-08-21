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

📚 **Documentation:** [86d.app/docs/modules/orders](https://86d.app/docs/modules/orders)

# Orders Module

Order ownership for the accepted commercial agreement, plus migration-era read projections. Fulfillment, Returns, Payment outcomes, destructive bulk operations, and guest proof authorization are delegated to their owning boundaries or contained.

## Installation

```sh
npm install @86d-app/orders
```

## Usage

```ts
import orders from "@86d-app/orders";

const module = orders({
  currency: "USD",
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `currency` | `string` | `"USD"` | Default currency code for new orders |

## Store Endpoints

Authenticated history, detail, invoice, reorder, and cancellation endpoints are
contained until Orders can audit and migrate legacy rows that used raw
authentication subjects as `order.customerId`. The Customer capability already
resolves a distinct Store Customer, but activating it without that Orders-owned
attribution step would hide historical Orders. Guest proof lookups and legacy
Order-owned Fulfillment/Return projections remain contained too.

| Method | Path | Description |
|---|---|---|
| `GET` | `/orders/me` | Contained pending audited legacy attribution |
| `GET` | `/orders/me/:id` | Contained pending audited legacy attribution |
| `POST` | `/orders/me/:id/cancel` | Contained pending audited attribution and durable cancellation |
| `GET` | `/orders/me/:id/fulfillments` | Contained pending Store Customer resolution |
| `GET` | `/orders/me/:id/invoice` | Contained pending audited legacy attribution |
| `GET` | `/orders/me/:id/returns` | Contained pending Store Customer resolution |
| `POST` | `/orders/me/:id/returns/create` | Contained; standalone Returns owns creation |
| `GET` | `/orders/me/returns` | Contained pending Store Customer resolution |
| `POST` | `/orders/me/:id/reorder` | Contained pending audited legacy attribution |
| `POST` | `/orders/track` | Contained until scoped guest-proof authorization is wired |
| `GET` | `/orders/store-search` | Store search integration |

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/orders` | List orders (filterable by status, payment, search) |
| `GET` | `/admin/orders/:id` | Get full order with items and addresses |
| `PUT` | `/admin/orders/:id` | Update status, payment, notes, metadata |
| `DELETE` | `/admin/orders/:id` | Rejected; accepted commerce history is immutable |
| `GET` | `/admin/orders/export` | Export orders with details (date range support) |
| `POST` | `/admin/orders/bulk` | Contained; bypasses owning workflows |
| `GET` | `/admin/orders/:id/fulfillments` | List fulfillments for an order |
| `POST` | `/admin/orders/:id/fulfillments/create` | Contained; standalone Fulfillment owns creation |
| `PUT` | `/admin/fulfillments/:id/update` | Contained; standalone Fulfillment owns updates |
| `DELETE` | `/admin/fulfillments/:id/delete` | Contained; standalone Fulfillment owns deletion |
| `GET` | `/admin/orders/:id/notes` | List notes for an order |
| `POST` | `/admin/orders/:id/notes/add` | Add a note to an order |
| `POST` | `/admin/orders/notes/:id/delete` | Delete a note |
| `GET` | `/admin/returns` | List all returns (filterable by status) |
| `GET` | `/admin/returns/:id` | Get return with items and order context |
| `PUT` | `/admin/returns/:id/update` | Contained; standalone Returns owns updates |
| `DELETE` | `/admin/returns/:id/delete` | Contained; standalone Returns owns deletion |
| `GET` | `/admin/orders/:id/returns` | List returns for a specific order |

## Status Flows

```
Order status:
  pending → processing → on_hold → completed
                                 ↘ cancelled
                                 ↘ refunded

Payment status:
  unpaid → paid → partially_paid → refunded
                ↘ voided

Return status:
  requested → approved → shipped_back → received → refunded → completed
            → rejected

Fulfillment status:
  unfulfilled | partially_fulfilled | fulfilled
```

The controller retains legacy cancellation transitions for migration reads, but
the HTTP cancellation mutation fails closed until Payment, Inventory, tax,
loyalty, and Shipping effects are coordinated durably.

## Events

| Event | Trigger |
|---|---|
| `order.placed` | Order created |
| `order.updated` | Order metadata changed |
| `order.fulfilled` | Order completed |
| `order.cancelled` | Order cancelled |
| `order.shipped` | Fulfillment shipped with tracking |
| `return.requested` | Return created |
| `return.approved` | Return approved |
| `return.rejected` | Return rejected |
| `return.refunded` | Return refunded |
| `return.completed` | Return completed |

Parcel delivery is evidence owned by Shipping/Fulfillment. It does not close an
Order. Direct Store Admin status edits also cannot assert commercial closure or
Payment outcomes, and HTTP cancellation is contained; those require their owning
operations and durable coordination.

New Order storage includes explicit accepted Checkout, Catalog, tax, Shipping,
Inventory reservation, and Payment Connection/operation references plus
`closedAt`, closure reason, and closure-policy version. Order creation rejects
floating or unsafe money, invalid quantities/currency, and totals that do not
reconcile to their immutable line and component snapshots.

## Controller API

```ts
interface OrderController {
  // Order CRUD
  create(params: CreateOrderParams): Promise<Order>;
  getById(id: string): Promise<OrderWithDetails | null>;
  getByOrderNumber(orderNumber: string): Promise<OrderWithDetails | null>;
  listForCustomer(customerId: string, params?): Promise<{ orders; total }>;
  list(params): Promise<{ orders; total }>;
  listForExport(params): Promise<{ orders: OrderWithDetails[]; total }>;
  updateStatus(id: string, status: OrderStatus): Promise<Order | null>;
  updatePaymentStatus(id, paymentStatus): Promise<Order | null>;
  update(id, { notes?, metadata? }): Promise<Order | null>;
  cancel(id: string): Promise<Order | null>;
  delete(id: string): Promise<void>;
  getItems(orderId: string): Promise<OrderItem[]>;
  getAddresses(orderId: string): Promise<OrderAddress[]>;

  // Fulfillments
  createFulfillment(params): Promise<Fulfillment>;
  getFulfillment(id: string): Promise<FulfillmentWithItems | null>;
  listFulfillments(orderId: string): Promise<FulfillmentWithItems[]>;
  updateFulfillment(id, params): Promise<Fulfillment | null>;
  deleteFulfillment(id: string): Promise<void>;
  getOrderFulfillmentStatus(orderId): Promise<OrderFulfillmentStatus>;

  // Returns
  createReturn(params): Promise<ReturnRequest>;
  getReturn(id: string): Promise<ReturnRequestWithItems | null>;
  listReturns(orderId: string): Promise<ReturnRequestWithItems[]>;
  listAllReturns(params): Promise<{ returns; total }>;
  updateReturn(id, params): Promise<ReturnRequest | null>;
  deleteReturn(id: string): Promise<void>;
  listReturnsForCustomer(customerId, params?): Promise<{ returns; total }>;

  // Bulk Operations
  bulkUpdateStatus(ids, status): Promise<{ updated: number }>;
  bulkUpdatePaymentStatus(ids, paymentStatus): Promise<{ updated: number }>;
  bulkDelete(ids): Promise<{ deleted: number }>;

  // Notes
  addNote(params): Promise<OrderNote>;
  listNotes(orderId: string): Promise<OrderNote[]>;
  deleteNote(id: string): Promise<void>;

  // Invoice, Tracking, Reorder
  getInvoiceData(orderId, storeName): Promise<InvoiceData | null>;
  getByTracking(orderNumber, email): Promise<OrderWithDetails | null>;
  getReorderItems(orderId): Promise<ReorderItem[] | null>;
}
```

## Types

```ts
type OrderStatus = "pending" | "processing" | "on_hold" | "completed" | "cancelled" | "refunded";
type PaymentStatus = "unpaid" | "paid" | "partially_paid" | "refunded" | "voided";
type ReturnStatus = "requested" | "approved" | "rejected" | "shipped_back" | "received" | "refunded" | "completed";
type ReturnType = "refund" | "exchange" | "store_credit";
type OrderFulfillmentStatus = "unfulfilled" | "partially_fulfilled" | "fulfilled";
```

## Store Components

### OrderHistory

Paginated list of a customer's orders. Requires authentication.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onSelectOrder` | `(id: string) => void` | — | Callback when an order is clicked |
| `pageSize` | `number` | `10` | Orders per page |

### OrderDetail

Full order view with items, totals, fulfillment, addresses, and cancel button.

| Prop | Type | Description |
|------|------|-------------|
| `orderId` | `string` | Order ID to display |
| `onBack` | `() => void` | Back navigation callback |

### OrderReturns

Return requests section. Shows existing returns and form to submit new ones.

| Prop | Type | Description |
|------|------|-------------|
| `orderId` | `string` | Order ID |
| `items` | `OrderItem[]` | Order items for return selection |
| `orderStatus` | `string` | Current status (returns allowed for completed/processing) |

### OrderTracker

The legacy public form is retained as migration UI, but its endpoint fails closed. Order number plus email is not authorization; activation requires the scoped guest proof created during Checkout.

## Notes

- Order numbers auto-generated as `ORD-{base36timestamp}-{random}`.
- Item `name` and `price` are snapshotted at creation and don't update with catalog changes.
- Customer endpoints resolve Better Auth identity through `customers.identity.resolve` and compare `order.customerId` to the returned Store Customer ID (returning 404 for non-owners).
- Tracking URLs auto-generated for UPS, USPS, FedEx, DHL carriers.
- Legacy controller delete/bulk methods remain migration code but are not reachable through active mutating HTTP behavior.
- Invoice numbers: `INV-{YYYYMMDD}-{orderSuffix}`.
