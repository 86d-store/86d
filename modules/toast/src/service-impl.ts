import type { ScopedEventEmitter } from "@86d-app/core/events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import type { ToastPosProvider } from "./provider";
import type {
	MenuMapping,
	SyncDirection,
	SyncEntityType,
	SyncRecord,
	SyncStats,
	ToastController,
} from "./service";

async function createSyncRecord(options: {
	data: ModuleDataService;
	events: ScopedEventEmitter | undefined;
	provider: ToastPosProvider | undefined;
	entityType: SyncEntityType;
	eventName: string;
	params: {
		entityId: string;
		externalId: string;
		direction?: SyncDirection | undefined;
	};
}): Promise<SyncRecord> {
	const { data, events, provider, entityType, eventName, params } = options;
	const now = new Date();
	const id = crypto.randomUUID();
	const direction = params.direction ?? "outbound";
	let status: SyncRecord["status"] = "synced";
	let error: string | undefined;

	// Actually call Toast API when provider is available
	if (provider) {
		try {
			if (entityType === "menu-item" && direction === "inbound") {
				await provider.getMenuItem(params.externalId);
			} else if (entityType === "order" && direction === "inbound") {
				await provider.getOrder(params.externalId);
			} else if (entityType === "inventory") {
				await provider.getInventory();
			}
		} catch (err) {
			status = "failed";
			error = err instanceof Error ? err.message : "Toast API call failed";
		}
	}

	const record: SyncRecord = {
		id,
		entityType,
		entityId: params.entityId,
		externalId: params.externalId,
		direction,
		status,
		...(error ? { error } : {}),
		...(status === "synced" ? { syncedAt: now } : {}),
		createdAt: now,
		updatedAt: now,
	};
	await data.upsert("syncRecord", id, record as Record<string, unknown>);
	void events?.emit(eventName, {
		syncRecordId: record.id,
		entityType,
		entityId: record.entityId,
		externalId: record.externalId,
	});
	return record;
}

export function createToastController(
	data: ModuleDataService,
	events?: ScopedEventEmitter | undefined,
	provider?: ToastPosProvider | undefined,
): ToastController {
	return {
		async syncMenu(params) {
			return createSyncRecord({
				data,
				events,
				provider,
				entityType: "menu-item",
				eventName: "toast.menu.synced",
				params,
			});
		},

		async syncOrder(params) {
			return createSyncRecord({
				data,
				events,
				provider,
				entityType: "order",
				eventName: "toast.order.synced",
				params,
			});
		},

		async syncInventory(params) {
			return createSyncRecord({
				data,
				events,
				provider,
				entityType: "inventory",
				eventName: "toast.inventory.updated",
				params,
			});
		},

		async getSyncRecord(id) {
			const raw = await data.get("syncRecord", id);
			if (!raw) return null;
			return raw as unknown as SyncRecord;
		},

		async listSyncRecords(params) {
			const where: Record<string, unknown> = {};
			if (params?.entityType) where.entityType = params.entityType;
			if (params?.status) where.status = params.status;

			const all = await data.findMany("syncRecord", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as SyncRecord[];
		},

		async createMenuMapping(params) {
			const now = new Date();
			const id = crypto.randomUUID();
			const mapping: MenuMapping = {
				id,
				localProductId: params.localProductId,
				externalMenuItemId: params.externalMenuItemId,
				isActive: true,
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert("menuMapping", id, mapping as Record<string, unknown>);
			return mapping;
		},

		async getMenuMapping(id) {
			const raw = await data.get("menuMapping", id);
			if (!raw) return null;
			return raw as unknown as MenuMapping;
		},

		async listMenuMappings(params) {
			const where: Record<string, unknown> = {};
			if (params?.isActive !== undefined) where.isActive = params.isActive;

			const all = await data.findMany("menuMapping", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as MenuMapping[];
		},

		async deleteMenuMapping(id) {
			const existing = await data.get("menuMapping", id);
			if (!existing) return false;
			await data.delete("menuMapping", id);
			return true;
		},

		async getLastSyncTime(entityType) {
			const where: Record<string, unknown> = { status: "synced" };
			if (entityType) where.entityType = entityType;

			const records = await data.findMany("syncRecord", { where });
			const synced = records as unknown as SyncRecord[];

			if (synced.length === 0) return null;

			let latest: Date | null = null;
			for (const r of synced) {
				if (r.syncedAt && (!latest || r.syncedAt > latest)) {
					latest = r.syncedAt;
				}
			}
			return latest;
		},

		async getSyncStats() {
			const all = await data.findMany("syncRecord", {});
			const records = all as unknown as SyncRecord[];

			const stats: SyncStats = {
				total: records.length,
				pending: 0,
				synced: 0,
				failed: 0,
				byEntityType: {},
			};

			for (const r of records) {
				if (r.status === "pending") stats.pending++;
				else if (r.status === "synced") stats.synced++;
				else if (r.status === "failed") stats.failed++;

				stats.byEntityType[r.entityType] =
					(stats.byEntityType[r.entityType] ?? 0) + 1;
			}

			return stats;
		},
	};
}
