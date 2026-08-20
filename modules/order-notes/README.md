

# @86d-app/order-notes

📚 **Documentation:** [86d.app/docs/modules/order-notes](https://86d.app/docs/modules/order-notes)

Order notes and comments module for 86d. Allows customers, admins, and system events to add notes to orders with visibility controls.

## Installation

```bash
86d module add order-notes
```

## Features

- Customer notes visible to both customers and admins
- Internal notes visible only to admins
- Pin important notes to the top
- Author-based access control (customers edit/delete only their own)
- System notes for automated events (status changes, etc.)

## Store endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/orders/:orderId/notes` | List notes (excludes internal) |
| POST | `/orders/:orderId/notes/add` | Add a customer note |
| POST | `/orders/notes/:noteId/update` | Update own note |
| POST | `/orders/notes/:noteId/delete` | Delete own note |

## Admin endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/order-notes` | List all notes (with filters) |
| POST | `/admin/order-notes/add` | Add admin/internal note |
| GET | `/admin/order-notes/summary` | Note statistics |
| POST | `/admin/order-notes/:id/delete` | Delete any note |
| POST | `/admin/order-notes/:id/toggle-pin` | Pin/unpin a note |

## Controller API

```typescript
interface OrderNotesController {
  addNote(params): Promise<OrderNote>;
  updateNote(noteId, authorId, content, isAdmin?): Promise<OrderNote | null>;
  deleteNote(noteId, authorId, isAdmin?): Promise<boolean>;
  togglePin(noteId): Promise<OrderNote | null>;
  listByOrder(orderId, params?): Promise<OrderNote[]>;
  countByOrder(orderId, includeInternal?): Promise<number>;
  getNote(noteId): Promise<OrderNote | null>;
  listAll(params?): Promise<{ items: OrderNote[]; total: number }>;
  getSummary(): Promise<OrderNoteSummary>;
}
```

## Types

```typescript
type AuthorType = "customer" | "admin" | "system";

interface OrderNote {
  id: string;
  orderId: string;
  authorId: string;
  authorName: string;
  authorType: AuthorType;
  content: string;
  isInternal: boolean;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

## Components

### Store

- **OrderNotes** — Customer-facing note list for an order. Shows non-internal notes, add note form, edit/delete own notes. Requires `orderId` and optional `customerId` props.

### Admin

- **OrderNotesOverview** — Admin notes dashboard with summary stats (total, by author type, internal count), filterable list (orderId, authorType, internal toggle), pin/unpin, delete with confirmation, and pagination.

## Notes

- Internal notes (`isInternal: true`) are never exposed through store endpoints
- Pinned notes always appear first in list results
- Customers can only modify their own notes; admins can modify any note
- Customer identity is derived from session, never from request body
