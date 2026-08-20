

# @86d-app/tickets

📚 **Documentation:** [86d.app/docs/modules/tickets](https://86d.app/docs/modules/tickets)

Customer support ticket system for the 86d commerce platform. Provides threaded ticket conversations with categories, priority levels, status tracking, internal notes, and admin management.

## Installation

```ts
import tickets from "@86d-app/tickets";

export default createStore({
  modules: [
    tickets({
      allowCustomerReopen: false,
      autoCloseDays: 7,
    }),
  ],
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `allowCustomerReopen` | `boolean` | `false` | Allow customers to reopen closed tickets via the store |
| `autoCloseDays` | `number` | `7` | Auto-close resolved tickets after N days (0 = disabled) |

## Store Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/tickets/categories` | List active ticket categories |
| `POST` | `/tickets/submit` | Submit a new support ticket |
| `GET` | `/tickets/mine?email=` | List customer's own tickets |
| `GET` | `/tickets/:id?email=` | Get ticket details with messages |
| `POST` | `/tickets/:id/reply` | Customer reply to a ticket |

## Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/tickets` | List all tickets (filterable) |
| `GET` | `/admin/tickets/stats` | Get ticket statistics |
| `GET` | `/admin/tickets/:id` | Get ticket with all messages (including internal) |
| `PUT` | `/admin/tickets/:id/update` | Update ticket fields |
| `POST` | `/admin/tickets/:id/close` | Close a ticket |
| `POST` | `/admin/tickets/:id/reopen` | Reopen a closed/resolved ticket |
| `POST` | `/admin/tickets/:id/reply` | Admin reply (supports internal notes) |
| `GET` | `/admin/tickets/:id/messages` | List all messages (including internal) |
| `GET` | `/admin/tickets/categories` | List all categories |
| `POST` | `/admin/tickets/categories/create` | Create a category |
| `PUT` | `/admin/tickets/categories/:id` | Update a category |
| `DELETE` | `/admin/tickets/categories/:id/delete` | Delete a category |

## Data Models

### Ticket

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | UUID |
| `number` | `number` | Sequential ticket number (starts at 1001) |
| `categoryId` | `string?` | Reference to ticket category |
| `subject` | `string` | Ticket subject line |
| `description` | `string` | Initial ticket description |
| `status` | `TicketStatus` | open, pending, in-progress, resolved, closed |
| `priority` | `TicketPriority` | low, normal, high, urgent |
| `customerEmail` | `string` | Customer's email address |
| `customerName` | `string` | Customer's display name |
| `customerId` | `string?` | Reference to customer account |
| `orderId` | `string?` | Reference to related order |
| `assigneeId` | `string?` | Assigned admin user ID |
| `assigneeName` | `string?` | Assigned admin user name |
| `tags` | `string[]` | Ticket tags for filtering |
| `closedAt` | `Date?` | Timestamp when ticket was closed/resolved |
| `createdAt` | `Date` | Creation timestamp |
| `updatedAt` | `Date` | Last update timestamp |

### TicketMessage

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | UUID |
| `ticketId` | `string` | Parent ticket reference |
| `body` | `string` | Message content |
| `authorType` | `MessageAuthorType` | customer, admin, system |
| `authorId` | `string?` | Author user ID |
| `authorName` | `string` | Author display name |
| `authorEmail` | `string?` | Author email |
| `isInternal` | `boolean` | Internal notes hidden from customers |
| `createdAt` | `Date` | Message timestamp |

### TicketCategory

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | UUID |
| `name` | `string` | Category name |
| `slug` | `string` | URL-safe identifier (unique) |
| `description` | `string?` | Category description |
| `position` | `number` | Sort order |
| `isActive` | `boolean` | Whether category is shown to customers |

## Controller API

```ts
import type { TicketController } from "@86d-app/tickets";

// Categories
controller.createCategory({ name, slug, description?, position? })
controller.getCategory(id)
controller.listCategories({ activeOnly? })
controller.updateCategory(id, { name?, slug?, description?, position?, isActive? })
controller.deleteCategory(id)

// Tickets
controller.createTicket({ subject, description, customerEmail, customerName, categoryId?, priority?, customerId?, orderId?, tags? })
controller.getTicket(id)
controller.getTicketByNumber(number)
controller.listTickets({ status?, priority?, categoryId?, assigneeId?, customerEmail?, customerId? })
controller.updateTicket(id, { subject?, categoryId?, status?, priority?, assigneeId?, assigneeName?, tags? })
controller.closeTicket(id)
controller.reopenTicket(id)

// Messages
controller.addMessage({ ticketId, body, authorType, authorName, authorId?, authorEmail?, isInternal? })
controller.listMessages(ticketId, { includeInternal? })

// Stats
controller.getStats()
```

## Status Transitions

- **Customer submits ticket** → `open`
- **Admin replies to open ticket** → `in-progress`
- **Customer replies to non-open ticket** → `pending`
- **Admin resolves** → `resolved` (sets `closedAt`)
- **Admin closes** → `closed` (sets `closedAt`)
- **Reopen** → `open` (clears `closedAt`)

## Types

```ts
type TicketStatus = "open" | "pending" | "in-progress" | "resolved" | "closed";
type TicketPriority = "low" | "normal" | "high" | "urgent";
type MessageAuthorType = "customer" | "admin" | "system";
```

## Events

| Event | Description |
|-------|-------------|
| `ticket.created` | New ticket submitted |
| `ticket.updated` | Ticket fields changed |
| `ticket.closed` | Ticket closed |
| `ticket.reopened` | Closed ticket reopened |
| `ticket.message.added` | New message added to ticket |

## Admin Pages

| Path | Component | Group | Description |
|------|-----------|-------|-------------|
| `/admin/tickets` | TicketList | Support | Stats dashboard (total/open/pending/in-progress/resolved/closed), status and priority filter dropdowns, ticket list with badges linking to detail |
| `/admin/tickets/categories` | TicketCategories | Support | Category list with active/inactive badges, inline create form with auto-slug, edit and delete actions |
| `/admin/tickets/:id` | TicketDetail | — | Threaded message view with author type badges and internal note highlighting, admin reply form with internal note toggle, sidebar with live status/priority selects and customer info |
| `/admin/tickets/categories/:id` | TicketCategoryDetail | — | Edit form for name, slug, description, position, and active toggle with success/error feedback |

## Store Components

| Component | Description |
|-----------|-------------|
| `TicketForm` | Form for customers to submit a new support ticket with category selection |
| `MyTickets` | List of the current customer's tickets with status badges and filtering |
| `TicketDetail` | Threaded ticket view with messages and customer reply form |

### Usage

```tsx
import { TicketForm, MyTickets, TicketDetail } from "@86d-app/tickets/store/components";

<TicketForm />
<MyTickets customerEmail="customer@example.com" />
<TicketDetail ticketId="abc-123" customerEmail="customer@example.com" />
```

## Notes

- Ticket numbers are sequential starting at 1001 for a professional appearance
- Internal notes (`isInternal: true`) are only visible through admin endpoints
- Store endpoints verify customer email ownership before showing ticket data
- Categories use soft-delete via `isActive` flag, while `deleteCategory` is a hard delete
