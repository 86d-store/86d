import type { ModuleController } from "@86d-app/core/types/module";

export type SyncEntityType = "menu-item" | "order" | "inventory";
export type SyncDirection = "inbound" | "outbound";
export type SyncStatus = "pending" | "synced" | "failed";

export type SyncRecord = {
	id: string;
	entityType: SyncEntityType;
	entityId: string;
	externalId: string;
	direction: SyncDirection;
	status: SyncStatus;
	error?: string | undefined;
	syncedAt?: Date | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type MenuMapping = {
	id: string;
	localProductId: string;
	externalMenuItemId: string;
	isActive: boolean;
	lastSyncedAt?: Date | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type SyncStats = {
	total: number;
	pending: number;
	synced: number;
	failed: number;
	byEntityType: Record<string, number>;
};

export type ToastController = ModuleController & {
	syncMenu(params: {
		entityId: string;
		externalId: string;
		direction?: SyncDirection | undefined;
	}): Promise<SyncRecord>;

	syncOrder(params: {
		entityId: string;
		externalId: string;
		direction?: SyncDirection | undefined;
	}): Promise<SyncRecord>;

	syncInventory(params: {
		entityId: string;
		externalId: string;
		direction?: SyncDirection | undefined;
	}): Promise<SyncRecord>;

	getSyncRecord(id: string): Promise<SyncRecord | null>;

	listSyncRecords(params?: {
		entityType?: SyncEntityType | undefined;
		status?: SyncStatus | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<SyncRecord[]>;

	createMenuMapping(params: {
		localProductId: string;
		externalMenuItemId: string;
	}): Promise<MenuMapping>;

	getMenuMapping(id: string): Promise<MenuMapping | null>;

	listMenuMappings(params?: {
		isActive?: boolean | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<MenuMapping[]>;

	deleteMenuMapping(id: string): Promise<boolean>;

	getLastSyncTime(
		entityType?: SyncEntityType | undefined,
	): Promise<Date | null>;

	getSyncStats(): Promise<SyncStats>;
};
