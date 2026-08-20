

# @86d-app/quotes

📚 **Documentation:** [86d.app/docs/modules/quotes](https://86d.app/docs/modules/quotes)

B2B request-for-quote (RFQ) module for price negotiation. Customers create quotes with product line items, submit them for admin review, and negotiate pricing through counter-offers before converting accepted quotes into orders.

## Installation

```ts
import quotes from "@86d-app/quotes";

export default defineStore({
  modules: [
    quotes({
      defaultExpirationDays: 14,
    }),
  ],
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultExpirationDays` | `number` | `30` | Days until a counter-offer expires |

## Store endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/quotes/create` | Create a new draft quote |
| GET | `/quotes/my` | List customer's own quotes (filter by status, paginate) |
| GET | `/quotes/:id` | Get quote with items and comments |
| POST | `/quotes/:id/items/add` | Add a line item to a draft quote |
| POST | `/quotes/:id/items/update` | Update item quantity/price in a draft quote |
| POST | `/quotes/:id/items/remove` | Remove an item from a draft quote |
| POST | `/quotes/:id/submit` | Submit draft for admin review |
| POST | `/quotes/:id/accept` | Accept a counter-offer |
| POST | `/quotes/:id/decline` | Decline a counter-offer (with optional reason) |
| POST | `/quotes/:id/comments/add` | Add a customer comment |

## Admin endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/quotes` | List all quotes (filter by status/customer, paginate) |
| GET | `/admin/quotes/stats` | Aggregate stats (counts, values, conversion rate) |
| GET | `/admin/quotes/:id` | Get quote with items, comments, and history |
| POST | `/admin/quotes/:id/review` | Mark quote as under review |
| POST | `/admin/quotes/:id/counter` | Send counter-offer with adjusted item prices |
| POST | `/admin/quotes/:id/approve` | Approve quote at customer's requested prices |
| POST | `/admin/quotes/:id/reject` | Reject a quote (with optional reason) |
| POST | `/admin/quotes/:id/convert` | Convert accepted quote to an order |
| POST | `/admin/quotes/:id/expire` | Manually expire a counter-offer |
| POST | `/admin/quotes/:id/comments/add` | Add an admin comment |

## Controller API

```ts
interface QuoteController {
  // Customer lifecycle
  createQuote(params: { customerId, customerEmail, customerName, companyName?, notes? }): Promise<Quote>
  getQuote(id: string): Promise<Quote | null>
  getMyQuotes(params: { customerId, status?, skip?, take? }): Promise<Quote[]>
  submitQuote(id: string): Promise<Quote | null>
  acceptQuote(id: string): Promise<Quote | null>
  declineQuote(id: string, reason?: string): Promise<Quote | null>

  // Items
  addItem(params: { quoteId, productId, productName, sku?, quantity, unitPrice, notes? }): Promise<QuoteItem | null>
  updateItem(quoteId, itemId, params: { quantity?, unitPrice?, notes? }): Promise<QuoteItem | null>
  removeItem(quoteId: string, itemId: string): Promise<boolean>
  getItems(quoteId: string): Promise<QuoteItem[]>

  // Comments
  addComment(params: { quoteId, authorType, authorId, authorName, message }): Promise<QuoteComment>
  getComments(quoteId: string): Promise<QuoteComment[]>

  // Admin operations
  listQuotes(params?: { status?, customerId?, skip?, take? }): Promise<Quote[]>
  reviewQuote(id: string): Promise<Quote | null>
  counterQuote(id, params: { items: [{ itemId, offeredPrice }], expiresAt?, adminNotes? }): Promise<Quote | null>
  approveAsIs(id, params?: { expiresAt?, adminNotes? }): Promise<Quote | null>
  rejectQuote(id: string, reason?: string): Promise<Quote | null>
  convertToOrder(id: string, orderId: string): Promise<Quote | null>
  expireQuote(id: string): Promise<Quote | null>

  // History & Stats
  getHistory(quoteId: string): Promise<QuoteHistory[]>
  getStats(): Promise<QuoteStats>
}
```

## Types

```ts
type QuoteStatus = "draft" | "submitted" | "under_review" | "countered" | "accepted" | "rejected" | "expired" | "converted"
type AuthorType = "customer" | "admin"
```

## How it works

1. **Customer creates a quote** — starts in `draft` status with customer details
2. **Customer adds line items** — products with quantities and requested unit prices
3. **Customer submits** — transitions to `submitted`, requires at least one item
4. **Admin reviews** — optionally marks as `under_review`
5. **Admin responds** — either counter-offers with adjusted prices, approves as-is, or rejects
6. **Customer responds** — accepts the counter-offer or declines with a reason
7. **Admin converts** — links the accepted quote to an order via `convertToOrder`
8. **Expiration** — counter-offers expire after `defaultExpirationDays`; expired quotes cannot be accepted

## Store Components

| Component | Description |
|-----------|-------------|
| `QuoteRequest` | Form for customers to create a new quote with product line items |
| `MyQuotes` | List of the current customer's quotes with status badges and filtering |
| `QuoteDetail` | Full quote view with line items, comments, and accept/decline actions |

### Usage

```tsx
import { QuoteRequest, MyQuotes, QuoteDetail } from "@86d-app/quotes/store/components";

<QuoteRequest customerId="customer-456" />
<MyQuotes customerId="customer-456" />
<QuoteDetail quoteId="quote-789" />
```

## Notes

- Quote totals are automatically recalculated when items are added, updated, or removed
- When a counter-offer sets `offeredPrice` on items, totals use the offered price
- All status transitions are recorded in `quoteHistory` with timestamps and reasons
- Comments support threaded discussion between customer and admin throughout the quote lifecycle
- The `getStats` method provides aggregate metrics including conversion rate (accepted+converted / decided quotes)
