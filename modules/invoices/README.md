

# @86d-app/invoices

📚 **Documentation:** [86d.app/docs/modules/invoices](https://86d.app/docs/modules/invoices)

Invoices module for the 86d commerce platform. Provides full invoice lifecycle management including payment terms for B2B (net-30, net-60, etc.), partial payments, credit notes, overdue detection, and guest invoice tracking.

## Installation

Add to your store's module configuration:

```ts
import invoices from "@86d-app/invoices";

export const modules = [
  invoices({
    currency: "USD",              // optional — default currency
    defaultPaymentTerms: "net_30" // optional — default terms
  }),
];
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `currency` | `string` | `"USD"` | Default currency code for new invoices |
| `defaultPaymentTerms` | `string` | `"due_on_receipt"` | Default payment terms |

### Payment terms

| Value | Due date |
|-------|----------|
| `due_on_receipt` | Same day as issued |
| `net_7` | 7 days after issued |
| `net_15` | 15 days after issued |
| `net_30` | 30 days after issued |
| `net_45` | 45 days after issued |
| `net_60` | 60 days after issued |
| `net_90` | 90 days after issued |

## Store endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/invoices/me` | List authenticated customer's invoices (paginated) |
| `GET` | `/invoices/me/:id` | Get invoice detail (auto-marks as viewed) |
| `POST` | `/invoices/track` | Guest invoice lookup by number + email |
| `GET` | `/invoices/store-search` | Search customer's invoices |

## Admin endpoints

### Invoices

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/invoices` | List invoices (filter by status, search) |
| `GET` | `/admin/invoices/overdue` | List overdue invoices |
| `POST` | `/admin/invoices/create` | Create a new invoice |
| `GET` | `/admin/invoices/:id` | Get invoice with line items, payments, credit notes |
| `PUT` | `/admin/invoices/:id/update` | Update draft invoice |
| `DELETE` | `/admin/invoices/:id/delete` | Delete an invoice |
| `POST` | `/admin/invoices/:id/send` | Send invoice (sets issued date + due date) |
| `POST` | `/admin/invoices/:id/void` | Void an invoice |
| `POST` | `/admin/invoices/bulk` | Bulk update status or delete |

### Payments

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/invoices/:id/payments` | List payments for an invoice |
| `POST` | `/admin/invoices/:id/payments/record` | Record a payment |
| `DELETE` | `/admin/invoices/payments/:id/delete` | Delete a payment |

### Credit notes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/invoices/:id/credit-notes` | List credit notes for an invoice |
| `POST` | `/admin/invoices/:id/credit-notes/create` | Create a credit note |
| `GET` | `/admin/credit-notes/:id` | Get credit note with line items |
| `POST` | `/admin/credit-notes/:id/issue` | Issue a draft credit note |
| `POST` | `/admin/credit-notes/:id/apply` | Apply credit to invoice (records payment) |
| `POST` | `/admin/credit-notes/:id/void` | Void a credit note |

## Controller API

```ts
interface InvoiceController {
  // Invoice CRUD
  create(params: CreateInvoiceParams): Promise<Invoice>;
  getById(id: string): Promise<InvoiceWithDetails | null>;
  getByNumber(invoiceNumber: string): Promise<InvoiceWithDetails | null>;
  list(params?: ListInvoiceParams): Promise<{ invoices: Invoice[]; total: number }>;
  listForCustomer(customerId: string, params?): Promise<{ invoices: Invoice[]; total: number }>;
  update(id: string, params: UpdateInvoiceParams): Promise<Invoice | null>;
  delete(id: string): Promise<void>;

  // Lifecycle
  send(id: string): Promise<Invoice | null>;
  markViewed(id: string): Promise<Invoice | null>;
  markOverdue(id: string): Promise<Invoice | null>;
  voidInvoice(id: string): Promise<Invoice | null>;

  // Line items
  getLineItems(invoiceId: string): Promise<InvoiceLineItem[]>;
  addLineItem(invoiceId: string, item: CreateLineItemParams): Promise<InvoiceLineItem>;
  removeLineItem(lineItemId: string): Promise<void>;

  // Payments
  recordPayment(params: RecordPaymentParams): Promise<InvoicePayment>;
  listPayments(invoiceId: string): Promise<InvoicePayment[]>;
  deletePayment(paymentId: string): Promise<void>;

  // Credit notes
  createCreditNote(params: CreateCreditNoteParams): Promise<CreditNote>;
  getCreditNote(id: string): Promise<CreditNoteWithItems | null>;
  listCreditNotes(invoiceId: string): Promise<CreditNoteWithItems[]>;
  issueCreditNote(id: string): Promise<CreditNote | null>;
  applyCreditNote(id: string): Promise<CreditNote | null>;
  voidCreditNote(id: string): Promise<CreditNote | null>;

  // Bulk operations
  bulkUpdateStatus(ids: string[], status: InvoiceStatus): Promise<{ updated: number }>;
  bulkDelete(ids: string[]): Promise<{ deleted: number }>;

  // Lookups
  getByOrder(orderId: string): Promise<InvoiceWithDetails | null>;
  getByTracking(invoiceNumber: string, email: string): Promise<InvoiceWithDetails | null>;
  findOverdue(): Promise<Invoice[]>;
}
```

## Types

### Invoice

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique ID |
| `invoiceNumber` | `string` | Auto-generated number (INV-YYYYMMDD-NNNN) |
| `orderId` | `string?` | Linked order ID |
| `customerId` | `string?` | Registered customer ID |
| `guestEmail` | `string?` | Guest email |
| `customerName` | `string?` | Display name |
| `status` | `InvoiceStatus` | draft, sent, viewed, paid, partially_paid, overdue, void |
| `paymentTerms` | `PaymentTerms` | due_on_receipt, net_7, net_15, net_30, net_45, net_60, net_90 |
| `issuedAt` | `string?` | Issue date (set on send) |
| `dueDate` | `string?` | Calculated due date |
| `subtotal` | `number` | Line item total (cents) |
| `taxAmount` | `number` | Tax (cents) |
| `shippingAmount` | `number` | Shipping (cents) |
| `discountAmount` | `number` | Discount (cents) |
| `total` | `number` | Grand total (cents) |
| `amountPaid` | `number` | Amount paid so far (cents) |
| `amountDue` | `number` | Outstanding balance (cents) |
| `currency` | `string` | Currency code |
| `billingAddress` | `BillingAddress?` | Address snapshot |
| `notes` | `string?` | Customer-facing notes |
| `internalNotes` | `string?` | Admin-only notes |

### InvoiceLineItem

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique ID |
| `invoiceId` | `string` | Parent invoice |
| `description` | `string` | Line item description |
| `quantity` | `number` | Quantity |
| `unitPrice` | `number` | Unit price (cents) |
| `amount` | `number` | Line total (cents) |
| `sku` | `string?` | Optional SKU |
| `productId` | `string?` | Optional product reference |

### InvoicePayment

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique ID |
| `invoiceId` | `string` | Parent invoice |
| `amount` | `number` | Payment amount (cents) |
| `method` | `PaymentMethod` | card, bank_transfer, cash, check, store_credit, other |
| `reference` | `string?` | Transaction ID or check number |
| `notes` | `string?` | Payment notes |
| `paidAt` | `string` | When payment was received |

### CreditNote

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique ID |
| `invoiceId` | `string` | Linked invoice |
| `creditNoteNumber` | `string` | Auto-generated number (CN-YYYYMMDD-NNNN) |
| `status` | `CreditNoteStatus` | draft, issued, applied, void |
| `amount` | `number` | Total credit amount (cents) |
| `reason` | `string?` | Credit reason |

## Notes

- All monetary amounts are in cents to avoid floating-point issues
- Invoices can be standalone (no orderId) for ad-hoc billing
- Only draft invoices can be edited — send first, then record payments
- Payment recording auto-calculates status (partially_paid vs paid)
- Credit notes, when applied, create a `store_credit` payment on the invoice
- Guest tracking uses POST for security — prevents URL-based enumeration
- Overdue detection is pull-based — call `findOverdue()` from a scheduled task
