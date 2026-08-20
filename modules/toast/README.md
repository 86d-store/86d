<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/logo" height="96" alt="86d" />
  </a>
</p>

<p align="center">Dynamic Commerce</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use.

# Toast Module

📚 **Documentation:** [86d.app/docs/modules/toast](https://86d.app/docs/modules/toast)

Toast POS integration for 86d. Bidirectional sync for menus, orders, and inventory between your store and Toast POS.

## Installation

```sh
npm install @86d-app/toast
```

## Usage

```ts
import toast from "@86d-app/toast";

const module = toast({
  apiKey: "your-toast-api-key",
  restaurantGuid: "your-restaurant-guid",
  sandbox: "true",
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | — | Toast API key |
| `restaurantGuid` | `string` | — | Toast restaurant GUID |
| `sandbox` | `string` | `"true"` | Use sandbox mode |

## Store Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/toast/sync/menu` | Sync a menu item |
| POST | `/toast/sync/order` | Sync an order |

## Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/toast/sync-records` | List all sync records |
| GET | `/admin/toast/menu-mappings` | List menu mappings |
| POST | `/admin/toast/menu-mappings/create` | Create a menu mapping |
| POST | `/admin/toast/menu-mappings/:id/delete` | Delete a menu mapping |
| GET | `/admin/toast/sync-stats` | Get sync statistics |

## Controller API

```ts
interface ToastController extends ModuleController {
  syncMenu(params: { entityId: string; externalId: string; direction?: SyncDirection }): Promise<SyncRecord>;
  syncOrder(params: { entityId: string; externalId: string; direction?: SyncDirection }): Promise<SyncRecord>;
  syncInventory(params: { entityId: string; externalId: string; direction?: SyncDirection }): Promise<SyncRecord>;

  getSyncRecord(id: string): Promise<SyncRecord | null>;
  listSyncRecords(params?: { entityType?: SyncEntityType; status?: SyncStatus; take?: number; skip?: number }): Promise<SyncRecord[]>;

  createMenuMapping(params: { localProductId: string; externalMenuItemId: string }): Promise<MenuMapping>;
  getMenuMapping(id: string): Promise<MenuMapping | null>;
  listMenuMappings(params?: { isActive?: boolean; take?: number; skip?: number }): Promise<MenuMapping[]>;
  deleteMenuMapping(id: string): Promise<boolean>;

  getLastSyncTime(entityType?: SyncEntityType): Promise<Date | null>;
  getSyncStats(): Promise<SyncStats>;
}
```

## Types

```ts
type SyncEntityType = "menu-item" | "order" | "inventory";
type SyncDirection = "inbound" | "outbound";
type SyncStatus = "pending" | "synced" | "failed";

interface SyncRecord {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  externalId: string;
  direction: SyncDirection;
  status: SyncStatus;
  error?: string;
  syncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface MenuMapping {
  id: string;
  localProductId: string;
  externalMenuItemId: string;
  isActive: boolean;
  lastSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface SyncStats {
  total: number;
  pending: number;
  synced: number;
  failed: number;
  byEntityType: Record<string, number>;
}
```

## Notes

- Supports bidirectional sync via `inbound` and `outbound` directions; defaults to `outbound`.
- Menu mappings link local product IDs to Toast external menu item IDs for ongoing synchronization.
- Sync records track every individual sync operation with status and optional error messages.
- `getLastSyncTime` returns the most recent successful sync timestamp, optionally filtered by entity type.
- Events emitted: `toast.order.synced`, `toast.menu.synced`, `toast.inventory.updated`, `toast.webhook.received`.
