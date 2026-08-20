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
export type DropStatus = "scheduled" | "live" | "ended" | "cancelled";

export type Listing = {
	id: string;
	localProductId: string;
	externalProductId?: string | undefined;
	title: string;
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

export type ProductDrop = {
	id: string;
	name: string;
	description?: string | undefined;
	productIds: string[];
	launchDate: Date;
	endDate?: Date | undefined;
	status: DropStatus;
	tweetId?: string | undefined;
	impressions: number;
	clicks: number;
	conversions: number;
	createdAt: Date;
	updatedAt: Date;
};

export type DropStats = {
	impressions: number;
	clicks: number;
	conversions: number;
	conversionRate: number;
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

export type XShopController = ModuleController & {
	createListing(params: {
		localProductId: string;
		externalProductId?: string | undefined;
		title: string;
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

	createDrop(params: {
		name: string;
		description?: string | undefined;
		productIds: string[];
		launchDate: Date;
		endDate?: Date | undefined;
		tweetId?: string | undefined;
	}): Promise<ProductDrop>;

	getDrop(id: string): Promise<ProductDrop | null>;

	cancelDrop(id: string): Promise<ProductDrop | null>;

	listDrops(params?: {
		status?: DropStatus | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<ProductDrop[]>;

	getDropStats(id: string): Promise<DropStats | null>;

	getChannelStats(): Promise<ChannelStats>;
};
