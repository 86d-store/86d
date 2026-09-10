# Audit Log Module

Records admin actions, system events, and API key usage for security auditing, compliance, and accountability.

**Scope:** This guide owns Module-specific mechanics. In the 86d.store source checkout, read the repository root [`AGENTS.md`](../../AGENTS.md) for shared rules and gates. In another project, follow that project's instructions and the installed `@86d-store/core` contracts.

## Change protocol

1. **Route.** Read this guide and the Module's [`README.md`](./README.md). In the 86d.store source checkout, storage or cross-Module changes also follow the root [Module contracts](../../AGENTS.md#module-contracts) routes.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** In the 86d.store source checkout, run `bun run generate:modules` after a Module change, then `bun run generate:modules -- --frozen` and the parent gates. In another project, use that project's checks. Run the Module's focused tests when available.
   - Done when the current project's required checks pass; source-checkout work also requires a passing frozen registry check.

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
