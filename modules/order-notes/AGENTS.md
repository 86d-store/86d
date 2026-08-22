# Order Notes Module

Notes and comments on orders from customers, admins, and system events. Supports internal (admin-only) notes, pinning, and per-author access control.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

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

## Patterns

- `isInternal` notes only visible when `includeInternal: true` (admin view)
- Customer endpoints always pass `includeInternal: false`
- Author enforcement: customers can only update/delete their own notes
- Admin can update/delete any note (`isAdmin: true` flag)
- Pinned notes sorted first in `listByOrder` results
- No `findById` — uses `findMany` with `where: { id }` (mock compat)
- Customer identity derived from session, never request body

## Events

`orderNote.created`, `orderNote.updated`, `orderNote.deleted`, `orderNote.pinned`

## Admin group

Sales
