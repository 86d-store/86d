# Returns Module

The standalone authority for Return state, with a multi-step approval workflow (requested -> approved -> received -> completed) and line-item tracking. Orders-owned Return rows are compatibility reads only; their HTTP writers must remain contained.

## Structure

```
src/
  index.ts          Factory: returns(options?) => Module
  schema.ts         Zod models: returnRequest, returnItem
  service.ts        ReturnController interface + types
  service-impl.ts   ReturnController implementation
  admin/
    components/
      index.tsx           Admin component exports
      returns-list.tsx    Returns list table (.tsx logic)
      returns-list.mdx    Admin template
      return-detail.tsx   Return detail view (.tsx logic)
      return-detail.mdx   Admin template
    endpoints/
      index.ts            Endpoint map
      list-returns.ts     GET  /admin/returns
      get-return.ts       GET  /admin/returns/:id
      return-summary.ts   GET  /admin/returns/summary
      approve-return.ts   POST /admin/returns/:id/approve
      reject-return.ts    POST /admin/returns/:id/reject
      mark-received.ts    POST /admin/returns/:id/received
      complete-return.ts  POST /admin/returns/:id/complete
      cancel-return.ts    POST /admin/returns/:id/cancel
      update-tracking.ts  PUT  /admin/returns/:id/tracking
  store/
    components/
      index.tsx           Store component exports
      return-status.tsx   Return status tracker (.tsx logic)
      return-status.mdx   Store template
    endpoints/
      index.ts            Endpoint map
      list-returns.ts     GET  /returns
      submit-return.ts    Legacy submission handler (unregistered)
      get-return.ts       GET  /returns/:id
      cancel-return.ts    Legacy cancellation handler (unregistered)
```

## Options

```ts
ReturnsOptions {
  returnWindowDays?: number  // days after order to allow returns, default 30
}
```

## Data models

- **returnRequest**: id, orderId (FK cascade to order), customerId, status (requested|approved|rejected|received|completed|cancelled), refundMethod (original_payment|store_credit|exchange), refundAmount, currency, reason, customerNotes?, adminNotes?, trackingNumber?, trackingCarrier?, requestedAt, resolvedAt?, createdAt, updatedAt
- **returnItem**: id, returnRequestId (FK cascade), orderItemId, productName, sku?, quantity, unitPrice, reason (damaged|defective|wrong_item|not_as_described|changed_mind|too_small|too_large|other), condition (unopened|opened|used|damaged), notes?, createdAt
- **returnAuthorityRequest**: immutable v1 request snapshot with deterministic operation ID/digest, Order/Customer references, explicit actor/authority, requested resolution, overall reason, and bounded line quantity/reason/condition snapshots
- **returnAuthorityReceipt**: durable replay receipt mapping one operation ID and digest to one authoritative request
- **returnAuthorityOperationLock / returnAuthorityOrderLock**: owner-local rows that serialize idempotent replay and cumulative Order-line admission

## Patterns

- Legacy flow: requested -> approved -> received -> completed; shopper reads/writes and all Admin lifecycle mutations are currently contained
- Legacy controller requests store line items together, but that controller is not a cross-Module authority boundary
- `ReturnRequestWithItems` bundles the request with its items for detail views
- `refundAmount` is set at completion time by admin, not at request time
- Events emitted at each status transition for integration with notifications, store-credits, orders
- Summary endpoint returns counts by status + total refund amount

## Security

- Store endpoint text inputs (`reason`, `customerNotes`, `productName`, `notes`) are sanitized via `sanitizeText` transform
- Return item `productName` is length-bounded to 500 chars; `notes` to 500 chars
- Always import `sanitizeText` from `@86d-app/core` when adding new text fields

## Authority boundary

- Do not restore Orders-owned Return writers. New Return mutations belong here.
- `requestAuthoritativeReturn` validates immutable Order quantities through `orders.line-quantities.validate@1.0.0`, holds operation and Order row locks, caps cumulative requests per line, and atomically commits its snapshot, replay receipt, and `return.requested@1` outbox fact.
- Retries with the same operation ID and normalized input return the original request. Different input under that operation ID fails with `RETURN_OPERATION_CONFLICT`.
- The foundation records explicit actor and authority snapshots but does not prove that they authorize a Customer or admin action. No write transport is registered until a trusted Command adapter supplies that proof.
- Legacy shopper submit and cancel handlers remain in source but are unregistered because they accept browser-owned snapshots or equate raw authentication IDs with Store Customers.
- The obsolete ReturnForm presentation is not exported while shopper submission
  remains unregistered. ReturnStatus remains the read-only Storefront surface.
- Store reads fail closed until verified Store Customer or scoped guest-proof authorization is wired. Admin approval, rejection, cancellation, tracking, receipt, and completion also fail closed; they cannot claim Shipping, restock, refund, or reversal outcomes. The foundation never mutates refunds, Inventory, Fulfillment, Payments, tax, loyalty, or communication state.
- Authoritative request snapshots are immutable and conservatively consume their line quantities. A future durable lifecycle aggregate must release capacity for rejected/cancelled requests without rewriting the snapshot.
- Cumulative caps currently cover only authoritative request snapshots. Legacy rows require a reviewed backfill before any transport can activate.
- `returnWindowDays`, paid/terminal Order eligibility, Customer ownership, and Store-bound authority still require typed decisions at the future Command adapter; line validation alone is intentionally insufficient for activation.
