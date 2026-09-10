# Toast Module

Toast POS integration with bidirectional sync for menus, orders, and inventory.

**Scope:** This guide owns Module-specific mechanics. In the 86d.store source checkout, read the repository root [`AGENTS.md`](../../AGENTS.md) for shared rules and gates. In another project, follow that project's instructions and the installed `@86d-store/core` contracts.

## Change protocol

1. **Route.** Read this guide and the Module's [`README.md`](./README.md). In the 86d.store source checkout, storage or cross-Module changes also follow the root [Module contracts](../../AGENTS.md#module-contracts) routes.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** In the 86d.store source checkout, run `bun run generate:modules` after a Module change, then `bun run generate:modules -- --frozen` and the parent gates. In another project, use that project's checks. Run the Module's focused tests when available.
   - Done when the current project's required checks pass; source-checkout work also requires a passing frozen registry check.

## Structure

```
src/
  index.ts          Factory: toast(options?) => Module + admin nav (Sales)
  schema.ts         Zod models: syncRecord, menuMapping
  service.ts        ToastController interface
  service-impl.ts   ToastController implementation
  store/endpoints/
    /toast/sync/menu     Sync menu item
    /toast/sync/order    Sync order
  store/components/  index.tsx
  admin/endpoints/
    /admin/toast/sync-records                 List sync records
    /admin/toast/menu-mappings                List menu mappings
    /admin/toast/menu-mappings/create         Create menu mapping
    /admin/toast/menu-mappings/:id/delete     Delete menu mapping
    /admin/toast/sync-stats                   Get sync stats
  admin/components/  toast-admin.tsx, toast-admin.mdx, index.tsx
  __tests__/         controllers.test.ts, endpoint-security.test.ts, events.test.ts
```

## Options

```ts
interface ToastOptions extends ModuleConfig {
  apiKey?: string;          // Toast API key
  restaurantGuid?: string;  // Toast restaurant GUID
  sandbox?: string;         // Use sandbox mode (default: "true")
}
```

## Data models

- **SyncRecord** — id, entityType (menu-item|order|inventory), entityId, externalId, direction (inbound|outbound), status (pending|synced|failed), error, syncedAt
- **MenuMapping** — id, localProductId, externalMenuItemId, isActive, lastSyncedAt
- **SyncStats** — total, pending, synced, failed, byEntityType (Record<string, number>)

## Patterns

- Three sync methods (syncMenu, syncOrder, syncInventory) share a common `createSyncRecord` helper
- Default sync direction is `outbound`
- Menu mappings link local product IDs to Toast external menu item IDs
- `getLastSyncTime` filters by status=synced and optionally by entityType
- Stats aggregated in-memory with byEntityType breakdown
- Events emitted: `toast.order.synced`, `toast.menu.synced`, `toast.inventory.updated`, `toast.webhook.received`
- Exports read values: `syncRecordStatus`, `menuMappingId`
