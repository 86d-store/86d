# Audit Log Module

Records admin actions, system events, and API key usage for security auditing, compliance, and accountability.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

```
src/
  index.ts          Factory: auditLog(options?) => Module
  schema.ts         Zod models: auditEntry
  service.ts        AuditLogController interface + types
  service-impl.ts   AuditLogController implementation
  store/
    endpoints/
      index.ts              Store endpoint registry
      my-activity.ts        GET /audit-log/my-activity
  admin/
    components/
      audit-log-list.*      List view MDX + TSX
      audit-log-detail.*    Detail view MDX + TSX
    endpoints/
      list-entries.ts              GET    /admin/audit-log/entries
      get-entry.ts                 GET    /admin/audit-log/entries/:id
      resource-history.ts          GET    /admin/audit-log/resource/:resource/:resourceId
      actor-history.ts             GET    /admin/audit-log/actor/:actorId
      summary.ts                   GET    /admin/audit-log/summary
      purge.ts                     POST   /admin/audit-log/purge
```

## Options

```ts
AuditLogOptions {
  retentionDays?: number  // default 0 (disabled)
}
```

## Data models

- **auditEntry**: id, action (create|update|delete|bulk_create|bulk_update|bulk_delete|login|logout|export|import|settings_change|status_change|custom), resource, resourceId?, actorId?, actorEmail?, actorType (admin|system|api_key), description, changes (JSON), metadata (JSON), ipAddress?, userAgent?, createdAt

## Patterns

- One store endpoint: `/audit-log/my-activity` returns the authenticated user's own audit trail (requires session)
- Other modules record entries via `AuditLogController.log()` through inter-module contracts
- Date filtering done in-memory (ModuleDataService lacks range queries)
- `purge(olderThan)` deletes all entries before a given date
- `getSummary()` returns aggregate counts by action, resource, and top 10 actors
- Events emitted: audit-log.entry.created, audit-log.purged
- Two admin pages: list view at `/admin/audit-log` and detail at `/admin/audit-log/:id`
