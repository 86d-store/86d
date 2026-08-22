# Tickets Module

Customer support ticket system with threaded messages, categories, priority levels, and status tracking.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

```
modules/tickets/src/
  index.ts              Factory: tickets(options?) → Module
  schema.ts             Data models: ticketCategory, ticket, ticketMessage
  service.ts            Type definitions + controller interface
  service-impl.ts       Controller implementation (createTicketControllers)
  store/endpoints/      Customer-facing endpoints
    index.ts            Endpoint map
    submit-ticket.ts    POST /tickets/submit
    get-ticket.ts       GET /tickets/:id
    customer-reply.ts   POST /tickets/:id/reply
    customer-tickets.ts GET /tickets/mine
    list-categories.ts  GET /tickets/categories
  store/components/     Customer-facing components
    _hooks.ts           API hooks (useTicketsApi)
    _utils.ts           Shared utilities
    index.tsx           Component exports
    *.tsx               Component logic
    *.mdx               Component templates
  admin/endpoints/      Admin-only endpoints
    index.ts            Endpoint map
    list-tickets.ts     GET /admin/tickets
    get-ticket.ts       GET /admin/tickets/:id
    update-ticket.ts    PUT /admin/tickets/:id/update
    close-ticket.ts     POST /admin/tickets/:id/close
    reopen-ticket.ts    POST /admin/tickets/:id/reopen
    admin-reply.ts      POST /admin/tickets/:id/reply
    list-messages.ts    GET /admin/tickets/:id/messages
    create-category.ts  POST /admin/tickets/categories/create
    list-categories.ts  GET /admin/tickets/categories
    update-category.ts  PUT /admin/tickets/categories/:id
    delete-category.ts  DELETE /admin/tickets/categories/:id/delete
    stats.ts            GET /admin/tickets/stats
  admin/components/
    index.tsx           TicketList, TicketDetail, TicketCategories, TicketCategoryDetail
  __tests__/
    service-impl.test.ts  45 tests covering all controller methods
```

## Data models

### ticketCategory
Categories for organizing tickets (e.g., "Billing", "Shipping").

| Field | Type | Notes |
|-------|------|-------|
| id | string | UUID |
| name | string | required |
| slug | string | unique |
| description | string | optional |
| position | number | sort order |
| isActive | boolean | visibility toggle |

### ticket
Support ticket with status tracking and customer info.

| Field | Type | Notes |
|-------|------|-------|
| id | string | UUID |
| number | number | sequential, starts at 1001, unique |
| categoryId | string | optional, ref → ticketCategory |
| subject | string | required |
| description | string | required |
| status | string | open, pending, in-progress, resolved, closed |
| priority | string | low, normal, high, urgent |
| customerEmail | string | required |
| customerName | string | required |
| customerId | string | optional |
| orderId | string | optional, link to order |
| assigneeId | string | optional admin user |
| assigneeName | string | optional |
| tags | json | string[] |
| closedAt | date | set when closed/resolved |

### ticketMessage
Threaded messages within a ticket.

| Field | Type | Notes |
|-------|------|-------|
| id | string | UUID |
| ticketId | string | ref → ticket (cascade delete) |
| body | string | message content |
| authorType | string | customer, admin, system |
| authorId | string | optional |
| authorName | string | required |
| authorEmail | string | optional |
| isInternal | boolean | admin-only notes, hidden from customer |

## Options

```ts
interface TicketsOptions {
  allowCustomerReopen?: boolean;  // default: false
  autoCloseDays?: number;         // default: 7 (0 = disabled)
}
```

## Patterns

- **Ticket numbering**: Sequential starting at 1001, auto-incremented
- **Status transitions**: Customer reply on non-open ticket → `pending`. Admin reply on open ticket → `in-progress`. Close/resolve sets `closedAt`.
- **Internal notes**: Messages with `isInternal: true` are hidden from store endpoints
- **Customer access**: Store endpoints verify `customerEmail` matches ticket owner
- **Controller key**: `ctx.context.controllers.tickets as TicketController`
- `onDelete: "set null"` (with space) not `"set-null"` in schema references
- Type `data.upsert()` call sites at the boundary; do not widen with `any` or suppress diagnostics
- Store `GET /tickets/:id` requires `?email=` query for customer verification
- Apply `.transform(sanitizeText)` from `@86d-app/core/sanitize` on every new store text field

## Admin components

| Component | Path | Description |
|---|---|---|
| `TicketList` | `/admin/tickets` | Stats dashboard (total/open/pending/in-progress/resolved/closed), status + priority filters, ticket list with status/priority badges |
| `TicketDetail` | `/admin/tickets/:id` | Threaded message view, admin reply form with internal note toggle, sidebar with status/priority selects and customer info |
| `TicketCategories` | `/admin/tickets/categories` | Category list with active/inactive badges, inline create form, edit/delete actions |
| `TicketCategoryDetail` | `/admin/tickets/categories/:id` | Edit form for name, slug, description, position, active toggle |

## Events

`ticket.created`, `ticket.updated`, `ticket.closed`, `ticket.reopened`, `ticket.message.added`

## Security

- All text inputs in store endpoints (`subject`, `description`, `customerName`, `body`) use `.transform(sanitizeText)`
- `customerName` is length-bounded to 200 chars

