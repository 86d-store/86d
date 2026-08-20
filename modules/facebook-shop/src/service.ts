import type { ModuleController } from "@86d-app/core/types/module";

export type ListingStatus =
	| "draft"
	| "pending"
	| "active"
	| "rejected"
	| "suspended";
export type SyncStatus = "pending" | "synced" | "failed" | "outdated";
export type OrderStatus =
	| "pending"
	| "confirmed"
	| "shipped"
	| "delivered"
	| "cancelled"
	| "refunded";
export type CatalogSyncStatus = "pending" | "syncing" | "synced" | "failed";
export type CollectionStatus = "active" | "inactive";

export type Listing = {
	id: string;
	localProductId: string;
	externalProductId?: string | undefined;
	title: string;
	description?: string | undefined;
	price?: number | undefined;
	imageUrl?: string | undefined;
	status: ListingStatus;
	syncStatus: SyncStatus;
	lastSyncedAt?: Date | undefined;
	error?: string | undefined;
	metadata: Record<string, unknown>;
	createdAt: Date;
	updatedAt: Date;
};

export type ChannelOrder = {
	id: string;
	externalOrderId: string;
	status: OrderStatus;
	items: unknown[];
	subtotal: number;
	shippingFee: number;
	platformFee: number;
	total: number;
	customerName?: string | undefined;
	shippingAddress: Record<string, unknown>;
	trackingNumber?: string | undefined;
	trackingUrl?: string | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type CatalogSync = {
	id: string;
	status: CatalogSyncStatus;
	totalProducts: number;
	syncedProducts: number;
	failedProducts: number;
	error?: string | undefined;
	startedAt: Date;
	completedAt?: Date | undefined;
	createdAt: Date;
};

export type Collection = {
	id: string;
	name: string;
	externalId?: string | undefined;
	productIds: string[];
	status: CollectionStatus;
	createdAt: Date;
	updatedAt: Date;
};

export type ChannelStats = {
	totalListings: number;
	activeListings: number;
	pendingListings: number;
	failedListings: number;
	totalOrders: number;
	pendingOrders: number;
	shippedOrders: number;
	deliveredOrders: number;
	cancelledOrders: number;
	totalRevenue: number;
};

export type FacebookShopController = ModuleController & {
	createListing(params: {
		localProductId: string;
		externalProductId?: string | undefined;
		title: string;
		description?: string | undefined;
		price?: number | undefined;
		imageUrl?: string | undefined;
		status?: ListingStatus | undefined;
		syncStatus?: SyncStatus | undefined;
		metadata?: Record<string, unknown> | undefined;
	}): Promise<Listing>;

	updateListing(
		id: string,
		params: {
			localProductId?: string | undefined;
			externalProductId?: string | undefined;
			title?: string | undefined;
			description?: string | undefined;
			price?: number | undefined;
			imageUrl?: string | undefined;
			status?: ListingStatus | undefined;
			syncStatus?: SyncStatus | undefined;
			lastSyncedAt?: Date | undefined;
			error?: string | undefined;
			metadata?: Record<string, unknown> | undefined;
		},
	): Promise<Listing | null>;

	deleteListing(id: string): Promise<boolean>;

	getListing(id: string): Promise<Listing | null>;

	getListingByProduct(localProductId: string): Promise<Listing | null>;

	listListings(params?: {
		status?: ListingStatus | undefined;
		syncStatus?: SyncStatus | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<Listing[]>;

	syncCatalog(): Promise<CatalogSync>;

	getLastSync(): Promise<CatalogSync | null>;

	listSyncs(params?: {
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<CatalogSync[]>;

	receiveOrder(params: {
		externalOrderId: string;
		status?: OrderStatus | undefined;
		items: unknown[];
		subtotal: number;
		shippingFee: number;
		platformFee: number;
		total: number;
		customerName?: string | undefined;
		shippingAddress: Record<string, unknown>;
	}): Promise<ChannelOrder>;

	getOrder(id: string): Promise<ChannelOrder | null>;

	updateOrderStatus(
		id: string,
		status: OrderStatus,
		trackingNumber?: string,
		trackingUrl?: string,
	): Promise<ChannelOrder | null>;

	listOrders(params?: {
		status?: OrderStatus | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<ChannelOrder[]>;

	createCollection(name: string, productIds: string[]): Promise<Collection>;

	deleteCollection(id: string): Promise<boolean>;

	listCollections(): Promise<Collection[]>;

	getChannelStats(): Promise<ChannelStats>;

	/** Push a local listing to the Facebook catalog. Returns null if not found or provider not configured. */
	pushProduct(id: string): Promise<Listing | null>;

	/** Pull products from the Facebook catalog and sync locally. */
	syncProducts(): Promise<{ synced: number }>;

	/** Pull orders from Meta Commerce and sync locally. */
	syncOrders(): Promise<{ synced: number }>;
};
