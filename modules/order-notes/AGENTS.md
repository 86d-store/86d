# Order Notes Module

Notes and comments on orders from customers, admins, and system events. Supports internal (admin-only) notes, pinning, and per-author access control.

**Scope:** This guide owns Module-specific mechanics. In the 86d.store source checkout, read the repository root [`AGENTS.md`](../../AGENTS.md) for shared rules and gates. In another project, follow that project's instructions and the installed `@86d-store/core` contracts.

## Change protocol

1. **Route.** Read this guide and the Module's [`README.md`](./README.md). In the 86d.store source checkout, storage or cross-Module changes also follow the root [Module contracts](../../AGENTS.md#module-contracts) routes.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** In the 86d.store source checkout, run `bun run generate:modules` after a Module change, then `bun run generate:modules -- --frozen` and the parent gates. In another project, use that project's checks. Run the Module's focused tests when available.
   - Done when the current project's required checks pass; source-checkout work also requires a passing frozen registry check.

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
