# Orders Module

Order ownership and compatibility reads for the accepted commercial agreement. Competing Fulfillment/Return writers, destructive bulk operations, and identifier-plus-email guest lookup are contained.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

```
src/
  index.ts          Factory: orders(options?) => Module
  schema.ts         Zod models: order, orderItem, orderAddress, fulfillment, fulfillmentItem, returnRequest, returnItem, orderNote
  service.ts        OrderController interface + all types
  service-impl.ts   OrderController implementation (35 methods)
  store/
    endpoints/      Customer-facing (requires session)
      list-orders.ts              GET  /orders/me (contained pending legacy attribution)
      get-order.ts                GET  /orders/me/:id (contained pending legacy attribution)
      cancel-order.ts             POST /orders/me/:id/cancel (contained)
      get-fulfillments.ts         GET  /orders/me/:id/fulfillments
      get-invoice.ts              GET  /orders/me/:id/invoice (contained pending legacy attribution)
      get-returns.ts              GET  /orders/me/:id/returns
      create-return.ts            POST /orders/me/:id/returns/create (contained; Returns owns writes)
      list-my-returns.ts          GET  /orders/me/returns
      reorder.ts                  POST /orders/me/:id/reorder (contained pending legacy attribution)
      track-order.ts              POST /orders/track (contained; scoped guest proof required)
      store-search.ts             GET  /orders/store-search
    components/     Store UI (OrderHistory, OrderDetail, OrderReturns, OrderTracker)
  admin/
    endpoints/      Protected (admin only)
      list-orders.ts              GET    /admin/orders
      get-order.ts                GET    /admin/orders/:id
      update-order.ts             PUT    /admin/orders/:id
      delete-order.ts             DELETE /admin/orders/:id
      export-orders.ts            GET    /admin/orders/export
      bulk-action.ts              POST   /admin/orders/bulk
      list-fulfillments.ts        GET    /admin/orders/:id/fulfillments
      create-fulfillment.ts       POST   /admin/orders/:id/fulfillments/create
      update-fulfillment.ts       PUT    /admin/fulfillments/:id/update
      delete-fulfillment.ts       DELETE /admin/fulfillments/:id/delete
      list-notes.ts               GET    /admin/orders/:id/notes
      add-note.ts                 POST   /admin/orders/:id/notes/add
      delete-note.ts              POST   /admin/orders/notes/:id/delete
      list-returns.ts             GET    /admin/returns
      get-return.ts               GET    /admin/returns/:id
      update-return.ts            PUT    /admin/returns/:id/update
      delete-return.ts            DELETE /admin/returns/:id/delete
      list-order-returns.ts       GET    /admin/orders/:id/returns
    components/     Admin UI (OrderList, OrderDetail, OrderActivity, OrderInvoice, ReturnList)
  __tests__/
    service-impl.test.ts          132 tests (core controller logic)
    controllers.test.ts           58 tests (edge cases, data integrity)
    endpoint-security.test.ts     22 tests (customer isolation, tracking security)
```

## Options

```ts
OrdersOptions {
  currency?: string  // default "USD"
}
```

## Data models

- **order**: immutable integer monetary snapshot and currency, accepted Checkout/Catalog/tax/Shipping/Inventory/Payment references, explicit closedAt/reason/policy version, attribution, notes, metadata, timestamps
- **orderItem**: id, orderId (FK), productId, variantId?, name (snapshot), sku?, price (snapshot), quantity, subtotal, metadata
- **orderAddress**: id, orderId (FK), type (billing|shipping), firstName, lastName, company?, line1, line2?, city, state, postalCode, country, phone?
- **fulfillment**: id, orderId (FK), status, trackingNumber?, trackingUrl?, carrier?, notes?, shippedAt?, deliveredAt?, createdAt, updatedAt
- **fulfillmentItem**: id, fulfillmentId (FK), orderItemId, quantity
- **returnRequest**: id, orderId (FK), status, type (refund|exchange|store_credit), reason, customerNotes?, adminNotes?, refundAmount?, trackingNumber?, trackingUrl?, carrier?, createdAt, updatedAt
- **returnItem**: id, returnRequestId (FK), orderItemId, quantity, reason?
- **orderNote**: id, orderId (FK), type (note|system), content, authorId?, authorName?, metadata, createdAt

## Status flows

```
Order:   pending → processing → on_hold → completed | cancelled | refunded
Payment: unpaid → paid → partially_paid | refunded | voided
Return:  requested → approved → shipped_back → received → refunded → completed
                   → rejected
Fulfillment: unfulfilled | partially_fulfilled | fulfilled
```

Cancellable: `pending`, `processing`, `on_hold`. Non-cancellable: `completed`, `cancelled`, `refunded`.

## Events

`order.placed`, `order.updated`, `order.fulfilled`, `order.cancelled`, `order.shipped`, `return.requested`, `return.approved`, `return.rejected`, `return.refunded`, `return.completed`

Shipping/Fulfillment delivery evidence never closes an Order by itself. Store
Admin status edits cannot assert Order closure or Payment outcomes. HTTP
cancellation fails closed until its cross-owner workflow is durable.

Order creation rejects floats, unsafe integers, mismatched line subtotals,
mismatched component totals, and non-uppercase ISO currency codes.
Invoice projections resolve the Store name through the typed Settings-owned
presentation capability; callers cannot supply branding.

## Patterns

- Authenticated history/detail/invoice/reorder/cancellation routes remain
  contained until Orders performs an audited attribution migration for legacy
  rows keyed by raw authentication subjects; switching directly to the new
  Customer identity would hide existing history
- Legacy Order-owned Fulfillment/Return projections remain contained with
  `STORE_CUSTOMER_CONTINUITY_REQUIRED` until standalone-owner read adapters and
  guest proof are available
- Email, Order ID, tracking number, or Order number never authorizes guest access; legacy guest confirmation and tracking handlers fail closed until scoped Checkout-to-Order proof verification is wired
- Accepted Order deletion and bulk status/Payment/deletion mutations fail closed
- Order-owned Fulfillment and Return rows are compatibility reads only; their HTTP writers fail closed in favor of the standalone owner modules
- Tracking URLs auto-generated for UPS, USPS, FedEx, DHL carriers
- Invoice numbers: `INV-{YYYYMMDD}-{orderSuffix}`
- `findMany` uses `take`/`skip` for pagination
- `exactOptionalPropertyTypes` compatible: all optional params use `T | undefined`

## Exports

`Order`, `OrderItem`, `OrderAddress`, `OrderWithDetails`, `OrderController`, `CreateOrderParams`, `OrderStatus`, `PaymentStatus`
