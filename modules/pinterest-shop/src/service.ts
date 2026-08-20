import type { ModuleController } from "@86d-app/core/types/module";

export type CatalogItemStatus = "active" | "inactive" | "disapproved";
export type Availability = "in-stock" | "out-of-stock" | "preorder";
export type SyncStatus = "pending" | "syncing" | "synced" | "failed";

export type CatalogItem = {
	id: string;
	localProductId: string;
	pinterestItemId?: string | undefined;
	title: string;
	description?: string | undefined;
	status: CatalogItemStatus;
	link: string;
	imageUrl: string;
	price: number;
	salePrice?: number | undefined;
	availability: Availability;
	googleCategory?: string | undefined;
	lastSyncedAt?: Date | undefined;
	error?: string | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type ShoppingPin = {
	id: string;
	catalogItemId: string;
	pinId?: string | undefined;
	boardId?: string | undefined;
	title: string;
	description?: string | undefined;
	link: string;
	imageUrl: string;
	impressions: number;
	saves: number;
	clicks: number;
	createdAt: Date;
	updatedAt: Date;
};

export type CatalogSync = {
	id: string;
	status: SyncStatus;
	totalItems: number;
	syncedItems: number;
	failedItems: number;
	error?: string | undefined;
	startedAt: Date;
	completedAt?: Date | undefined;
	createdAt: Date;
};

export type PinAnalytics = {
	impressions: number;
	saves: number;
	clicks: number;
	clickRate: number;
	saveRate: number;
};

export type ChannelStats = {
	totalCatalogItems: number;
	activeCatalogItems: number;
	totalPins: number;
	totalImpressions: number;
	totalClicks: number;
	totalSaves: number;
};

export type PinterestShopController = ModuleController & {
	createCatalogItem(params: {
		localProductId: string;
		title: string;
		link: string;
		imageUrl: string;
		price: number;
		description?: string | undefined;
		salePrice?: number | undefined;
		availability?: Availability | undefined;
		googleCategory?: string | undefined;
	}): Promise<CatalogItem>;

	updateCatalogItem(
		id: string,
		params: {
			title?: string | undefined;
			description?: string | undefined;
			link?: string | undefined;
			imageUrl?: string | undefined;
			price?: number | undefined;
			salePrice?: number | undefined;
			availability?: Availability | undefined;
			googleCategory?: string | undefined;
			status?: CatalogItemStatus | undefined;
			pinterestItemId?: string | undefined;
		},
	): Promise<CatalogItem | null>;

	deleteCatalogItem(id: string): Promise<boolean>;

	getCatalogItem(id: string): Promise<CatalogItem | null>;

	getCatalogItemByProduct(productId: string): Promise<CatalogItem | null>;

	listCatalogItems(params?: {
		status?: CatalogItemStatus | undefined;
		availability?: Availability | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<CatalogItem[]>;

	syncCatalog(): Promise<CatalogSync>;

	getLastSync(): Promise<CatalogSync | null>;

	listSyncs(params?: {
		status?: SyncStatus | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<CatalogSync[]>;

	createPin(params: {
		catalogItemId: string;
		title: string;
		link: string;
		imageUrl: string;
		description?: string | undefined;
		boardId?: string | undefined;
	}): Promise<ShoppingPin>;

	getPin(id: string): Promise<ShoppingPin | null>;

	listPins(params?: {
		catalogItemId?: string | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<ShoppingPin[]>;

	getPinAnalytics(id: string): Promise<PinAnalytics | null>;

	getChannelStats(): Promise<ChannelStats>;
};
