import type { ModuleController } from "@86d-app/core/types/module";

export type UberOrderStatus =
	| "pending"
	| "accepted"
	| "preparing"
	| "ready"
	| "picked-up"
	| "delivered"
	| "cancelled";

export type MenuSyncStatus = "pending" | "syncing" | "synced" | "failed";

export type UberOrder = {
	id: string;
	externalOrderId: string;
	status: UberOrderStatus;
	items: Array<Record<string, unknown>>;
	subtotal: number;
	deliveryFee: number;
	tax: number;
	total: number;
	customerName?: string | undefined;
	customerPhone?: string | undefined;
	estimatedReadyTime?: Date | undefined;
	specialInstructions?: string | undefined;
	orderType?: string | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type MenuSync = {
	id: string;
	status: MenuSyncStatus;
	itemCount: number;
	error?: string | undefined;
	startedAt: Date;
	completedAt?: Date | undefined;
	createdAt: Date;
};

export type OrderStats = {
	total: number;
	pending: number;
	accepted: number;
	preparing: number;
	ready: number;
	delivered: number;
	cancelled: number;
	totalRevenue: number;
};

export type UberEatsController = ModuleController & {
	receiveOrder(params: {
		externalOrderId: string;
		items: Array<Record<string, unknown>>;
		subtotal: number;
		deliveryFee: number;
		tax: number;
		total: number;
		customerName?: string | undefined;
		customerPhone?: string | undefined;
		specialInstructions?: string | undefined;
		orderType?: string | undefined;
	}): Promise<UberOrder>;

	acceptOrder(id: string): Promise<UberOrder | null>;

	markReady(id: string): Promise<UberOrder | null>;

	cancelOrder(id: string, reason?: string): Promise<UberOrder | null>;

	getOrder(id: string): Promise<UberOrder | null>;

	listOrders(params?: {
		status?: UberOrderStatus | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<UberOrder[]>;

	syncMenu(itemCount: number): Promise<MenuSync>;

	getLastMenuSync(): Promise<MenuSync | null>;

	listMenuSyncs(params?: {
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<MenuSync[]>;

	getOrderStats(): Promise<OrderStats>;
};

/** Entity map for this Module's data service — keys are schema entity names. */
export type UberEatsEntities = {
	uberOrder: UberOrder;
	menuSync: MenuSync;
};
