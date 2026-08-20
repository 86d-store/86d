# Invoices Module

Invoice lifecycle management with payment terms, partial payments, credit notes, and configurable numbering.

## File structure

```
src/
  index.ts              Module factory, options, type re-exports
  schema.ts             Data models: invoice, invoiceLineItem, invoicePayment, creditNote, creditNoteLineItem
  service.ts            Types + InvoiceController interface (31 methods)
  service-impl.ts       Business logic implementation
  mdx.d.ts              MDX type declaration
  admin/
    endpoints/
      index.ts                Endpoint map (18 endpoints)
      list-invoices.ts        GET    /admin/invoices
      get-invoice.ts          GET    /admin/invoices/:id
      create-invoice.ts       POST   /admin/invoices/create
      update-invoice.ts       PUT    /admin/invoices/:id/update
      delete-invoice.ts       DELETE /admin/invoices/:id/delete
      send-invoice.ts         POST   /admin/invoices/:id/send
      void-invoice.ts         POST   /admin/invoices/:id/void
      record-payment.ts       POST   /admin/invoices/:id/payments/record
      list-payments.ts        GET    /admin/invoices/:id/payments
      delete-payment.ts       DELETE /admin/invoices/payments/:id/delete
      create-credit-note.ts   POST   /admin/invoices/:id/credit-notes/create
      list-credit-notes.ts    GET    /admin/invoices/:id/credit-notes
      get-credit-note.ts      GET    /admin/credit-notes/:id
      issue-credit-note.ts    POST   /admin/credit-notes/:id/issue
      apply-credit-note.ts    POST   /admin/credit-notes/:id/apply
      void-credit-note.ts     POST   /admin/credit-notes/:id/void
      bulk-action.ts          POST   /admin/invoices/bulk
      find-overdue.ts         GET    /admin/invoices/overdue
    components/
      index.tsx               Re-exports
      invoice-list.tsx + .mdx   Invoice list with search, filters, pagination
      invoice-detail.tsx + .mdx Detail view with line items, payments, credit notes
      overdue-list.tsx + .mdx   Overdue invoice list
  store/
    endpoints/
      index.ts               Endpoint map (4 endpoints)
      list-my-invoices.ts    GET  /invoices/me
      get-my-invoice.ts      GET  /invoices/me/:id
      track-invoice.ts       POST /invoices/track
      store-search.ts        GET  /invoices/store-search
    components/
      index.tsx              MDXComponents export
      invoice-history.tsx + .mdx   Customer invoice list
      invoice-tracker.tsx + .mdx   Guest invoice lookup
  __tests__/
    service-impl.test.ts   79 tests
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `currency` | `string` | `"USD"` | Default currency code |
| `defaultPaymentTerms` | `string` | `"due_on_receipt"` | Default payment terms for new invoices |

## Data models

- **invoice** — Core invoice with status lifecycle, payment terms, amounts (all in cents), billing address, customer/order references.
- **invoiceLineItem** — Individual line items with description, quantity, unit price, amount.
- **invoicePayment** — Payment records against an invoice. Supports partial payments.
- **creditNote** — Credit adjustments linked to invoices. When applied, records as store_credit payment.
- **creditNoteLineItem** — Line items on credit notes.

## Key patterns

- All monetary amounts are in **cents** (integer) to avoid floating-point issues
- Invoice lifecycle: `draft` → `sent` → `viewed` → `paid` (or `partially_paid`, `overdue`, `void`)
- Only draft invoices can be edited (update, add/remove line items)
- `send()` sets `issuedAt` and calculates `dueDate` from payment terms
- Viewing a sent invoice auto-transitions to `viewed` status
- Payments auto-recalculate `amountPaid`, `amountDue`, and status
- Credit note lifecycle: `draft` → `issued` → `applied` (or `void`)
- `applyCreditNote()` records a `store_credit` payment on the linked invoice
- Invoice numbers: `INV-YYYYMMDD-NNNN`, credit notes: `CN-YYYYMMDD-NNNN`
- Guest tracking uses POST (not GET) with invoice number + email for security
- Store endpoints check `ctx.context.session?.user.id` for auth, return 404 (not 403) for non-owned resources
- `exactOptionalPropertyTypes` is on — use `| undefined` for optional interface properties
- Use `DataRecord` type alias in service-impl.ts instead of inline `Record<string, any>` casts

## Gotchas

- Deleting an invoice cascades to line items, payments, and credit notes (manual cascade in service-impl)
- Cannot record payments on draft or void invoices
- Cannot add line items to non-draft invoices
- Applied credit notes cannot be voided
- `findOverdue()` scans all invoices — only returns sent/viewed/partially_paid with past due dates
- Due date for `due_on_receipt` is the issue date itself
