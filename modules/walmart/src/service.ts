import type { ModuleController } from "@86d-app/core/types/module";

export type ItemStatus =
	| "published"
	| "unpublished"
	| "retired"
	| "system-error";
export type LifecycleStatus = "active" | "archived";
export type FulfillmentType = "seller" | "wfs";
export type WalmartOrderStatus =
	| "created"
	| "acknowledged"
	| "shipped"
	| "delivered"
	| "cancelled"
	| "refunded";
export type FeedType = "item" | "inventory" | "price" | "order";
export type FeedStatus = "pending" | "processing" | "completed" | "error";

export type WalmartItem = {
	id: string;
	localProductId: string;
	walmartItemId?: string | undefined;
	sku: string;
	title: string;
	status: ItemStatus;
	lifecycleStatus: LifecycleStatus;
	price: number;
	quantity: number;
	upc?: string | undefined;
	gtin?: string | undefined;
	brand?: string | undefined;
	category?: string | undefined;
	fulfillmentType: FulfillmentType;
	publishStatus?: string | undefined;
	lastSyncedAt?: Date | undefined;
	error?: string | undefined;
	metadata: Record<string, unknown>;
	createdAt: Date;
	updatedAt: Date;
};

export type WalmartOrder = {
	id: string;
	purchaseOrderId: string;
	status: WalmartOrderStatus;
	items: unknown[];
	orderTotal: number;
	shippingTotal: number;
	walmartFee: number;
	tax: number;
	customerName?: string | undefined;
	shippingAddress: Record<string, unknown>;
	trackingNumber?: string | undefined;
	carrier?: string | undefined;
	shipDate?: Date | undefined;
	estimatedDelivery?: Date | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type FeedSubmission = {
	id: string;
	feedId?: string | undefined;
	feedType: FeedType;
	status: FeedStatus;
	totalItems: number;
	successItems: number;
	errorItems: number;
	error?: string | undefined;
	submittedAt: Date;
	completedAt?: Date | undefined;
	createdAt: Date;
};

export type ChannelStats = {
	totalItems: number;
	publishedItems: number;
	totalOrders: number;
	totalRevenue: number;
	pendingFeeds: number;
	errorItems: number;
};

export type ItemHealth = {
	total: number;
	published: number;
	unpublished: number;
	retired: number;
	systemError: number;
	sellerFulfilled: number;
	wfsFulfilled: number;
};

export type WalmartController = ModuleController & {
	createItem(params: {
		localProductId: string;
		sku: string;
		title: string;
		price: number;
		quantity?: number | undefined;
		upc?: string | undefined;
		gtin?: string | undefined;
		brand?: string | undefined;
		category?: string | undefined;
		fulfillmentType?: FulfillmentType | undefined;
		metadata?: Record<string, unknown> | undefined;
	}): Promise<WalmartItem>;

	updateItem(
		id: string,
		params: {
			title?: string | undefined;
			price?: number | undefined;
			quantity?: number | undefined;
			upc?: string | undefined;
			gtin?: string | undefined;
			brand?: string | undefined;
			category?: string | undefined;
			fulfillmentType?: FulfillmentType | undefined;
			walmartItemId?: string | undefined;
			status?: ItemStatus | undefined;
			publishStatus?: string | undefined;
			metadata?: Record<string, unknown> | undefined;
		},
	): Promise<WalmartItem | null>;

	retireItem(id: string): Promise<WalmartItem | null>;

	getItem(id: string): Promise<WalmartItem | null>;

	getItemByProduct(productId: string): Promise<WalmartItem | null>;

	listItems(params?: {
		status?: ItemStatus | undefined;
		fulfillmentType?: FulfillmentType | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<WalmartItem[]>;

	submitFeed(feedType: FeedType): Promise<FeedSubmission>;

	getLastFeed(feedType: FeedType): Promise<FeedSubmission | null>;

	listFeeds(params?: {
		feedType?: FeedType | undefined;
		status?: FeedStatus | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<FeedSubmission[]>;

	receiveOrder(params: {
		purchaseOrderId: string;
		items: unknown[];
		orderTotal: number;
		shippingTotal: number;
		walmartFee: number;
		tax: number;
		customerName?: string | undefined;
		shippingAddress?: Record<string, unknown> | undefined;
		estimatedDelivery?: Date | undefined;
	}): Promise<WalmartOrder>;

	acknowledgeOrder(id: string): Promise<WalmartOrder | null>;

	shipOrder(
		id: string,
		trackingNumber: string,
		carrier: string,
	): Promise<WalmartOrder | null>;

	cancelOrder(id: string): Promise<WalmartOrder | null>;

	listOrders(params?: {
		status?: WalmartOrderStatus | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<WalmartOrder[]>;

	getChannelStats(): Promise<ChannelStats>;

	getItemHealth(): Promise<ItemHealth>;

	syncOrders(): Promise<WalmartOrder[]>;
};
