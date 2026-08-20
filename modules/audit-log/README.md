<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/logo" height="96" alt="86d" />
  </a>
</p>

<p align="center">
  Dynamic Commerce
</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use. Please proceed with caution. Use at your own risk.

# Audit Log Module

📚 **Documentation:** [86d.app/docs/modules/audit-log](https://86d.app/docs/modules/audit-log)

Records admin actions, system events, and API key usage for security auditing, compliance, and accountability. Other modules can record audit entries through the exported controller interface.

## Installation

```sh
npm install @86d-app/audit-log
```

## Usage

```ts
import auditLog from "@86d-app/audit-log";

const module = auditLog({
  retentionDays: 90, // auto-purge entries older than 90 days
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `retentionDays` | `number` | `0` | Days to retain audit entries before auto-purge. `0` disables auto-purge. |

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/audit-log/entries` | List audit entries (filterable by action, resource, actor, date range) |
| `GET` | `/admin/audit-log/entries/:id` | Get a single audit entry |
| `GET` | `/admin/audit-log/resource/:resource/:resourceId` | Get audit history for a specific resource |
| `GET` | `/admin/audit-log/actor/:actorId` | Get audit history for a specific actor |
| `GET` | `/admin/audit-log/summary` | Get aggregate activity summary |
| `POST` | `/admin/audit-log/purge` | Purge entries older than a specified date |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/audit-log/my-activity` | Get the authenticated user's own audit history (paginated via `take`/`skip` query params). Requires an active session. |

## Controller API

The `AuditLogController` interface is exported for use by other modules to record audit entries.

```ts
interface AuditLogController {
  log(params: CreateAuditEntryParams): Promise<AuditEntry>;
  getById(id: string): Promise<AuditEntry | null>;
  list(params?: AuditListParams): Promise<{ entries: AuditEntry[]; total: number }>;
  listForResource(resource: string, resourceId: string, params?: { take?: number; skip?: number }): Promise<AuditEntry[]>;
  listForActor(actorId: string, params?: { take?: number; skip?: number }): Promise<AuditEntry[]>;
  getSummary(params?: { dateFrom?: Date; dateTo?: Date }): Promise<AuditSummary>;
  purge(olderThan: Date): Promise<number>;
}
```

## Types

```ts
type AuditAction =
  | "create" | "update" | "delete"
  | "bulk_create" | "bulk_update" | "bulk_delete"
  | "login" | "logout"
  | "export" | "import"
  | "settings_change" | "status_change" | "custom";

type ActorType = "admin" | "system" | "api_key";

interface AuditEntry {
  id: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  actorId?: string;
  actorEmail?: string;
  actorType: ActorType;
  description: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

interface AuditSummary {
  totalEntries: number;
  entriesByAction: Record<string, number>;
  entriesByResource: Record<string, number>;
  recentActors: Array<{ actorId: string; actorEmail?: string; count: number }>;
}
```

## Notes

- The `/audit-log/my-activity` store endpoint lets authenticated customers view their own audit trail.
- Other modules should use `AuditLogController.log()` to record audit entries through inter-module contracts.
- Date range filtering is performed in-memory since ModuleDataService does not support range queries.
- The summary endpoint returns counts grouped by action, resource, and the top 10 most active actors.
- Purging deletes entries one by one; use retention policies for automatic cleanup.
