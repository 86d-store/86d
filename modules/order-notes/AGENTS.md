# order-notes

Notes and comments on orders from customers, admins, and system events. Supports internal (admin-only) notes, pinning, and per-author access control.

## File structure

```
src/
  index.ts              Module factory + OrderNotesOptions
  schema.ts             ModuleSchema (orderNote entity)
  service.ts            Controller interface + types
  service-impl.ts       Controller implementation
  mdx.d.ts              MDX type declarations
  store/endpoints/      4 customer-facing endpoints
  store/components/     OrderNotes (customer note list + add form)
  admin/endpoints/      5 admin endpoints
  admin/components/     OrderNotesOverview (filterable notes list, stats, pin/delete)
  __tests__/            45 tests (service-impl, access-control)
```

## Data model

**orderNote**: id, orderId, authorId, authorName, authorType (customer|admin|system), content, isInternal, isPinned, createdAt, updatedAt

## Key patterns

- `isInternal` notes only visible when `includeInternal: true` (admin view)
- Customer endpoints always pass `includeInternal: false`
- Author enforcement: customers can only update/delete their own notes
- Admin can update/delete any note (`isAdmin: true` flag)
- Pinned notes sorted first in `listByOrder` results
- No `findById` — uses `findMany` with `where: { id }` (mock compat)
- Customer identity derived from session, never request body

## Events emitted

`orderNote.created`, `orderNote.updated`, `orderNote.deleted`, `orderNote.pinned`

## Admin group

Sales
