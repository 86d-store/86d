import type { ModuleController } from "@86d-app/core/types/module";

export type FeedItemStatus = "active" | "pending" | "disapproved" | "expiring";

export type FeedItemCondition = "new" | "refurbished" | "used";

export type FeedItemAvailability = "in-stock" | "out-of-stock" | "preorder";

export type OrderStatus =
	| "pending"
	| "confirmed"
	| "shipped"
	| "delivered"
	| "cancelled"
	| "returned";

export type SubmissionStatus =
	| "pending"
	| "processing"
	| "completed"
	| "failed";

export type ProductFeedItem = {
	id: string;
	localProductId: string;
	googleProductId?: string | undefined;
	title: string;
	description?: string | undefined;
	status: FeedItemStatus;
	disapprovalReasons: string[];
	googleCategory?: string | undefined;
	condition: FeedItemCondition;
	availability: FeedItemAvailability;
	price: number;
	salePrice?: number | undefined;
	link: string;
	imageLink: string;
	gtin?: string | undefined;
	mpn?: string | undefined;
	brand?: string | undefined;
	lastSyncedAt?: Date | undefined;
	expiresAt?: Date | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type ChannelOrder = {
	id: string;
	googleOrderId: string;
	status: OrderStatus;
	items: unknown[];
	subtotal: number;
	shippingCost: number;
	tax: number;
	total: number;
	shippingAddress: Record<string, unknown>;
	trackingNumber?: string | undefined;
	carrier?: string | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type FeedSubmission = {
	id: string;
	status: SubmissionStatus;
	totalProducts: number;
	approvedProducts: number;
	disapprovedProducts: number;
	error?: string | undefined;
	submittedAt: Date;
	completedAt?: Date | undefined;
	createdAt: Date;
};

export type ChannelStats = {
	totalFeedItems: number;
	active: number;
	pending: number;
	disapproved: number;
	expiring: number;
	totalOrders: number;
	totalRevenue: number;
};

export type FeedDiagnostics = {
	statusBreakdown: Array<{ status: string; count: number }>;
	disapprovalReasons: Array<{ reason: string; count: number }>;
};

export type GoogleShoppingController = ModuleController & {
	createFeedItem(params: {
		localProductId: string;
		googleProductId?: string | undefined;
		title: string;
		description?: string | undefined;
		status?: FeedItemStatus | undefined;
		disapprovalReasons?: string[] | undefined;
		googleCategory?: string | undefined;
		condition?: FeedItemCondition | undefined;
		availability?: FeedItemAvailability | undefined;
		price: number;
		salePrice?: number | undefined;
		link: string;
		imageLink: string;
		gtin?: string | undefined;
		mpn?: string | undefined;
		brand?: string | undefined;
		expiresAt?: Date | undefined;
	}): Promise<ProductFeedItem>;

	updateFeedItem(
		id: string,
		params: {
			googleProductId?: string | undefined;
			title?: string | undefined;
			description?: string | undefined;
			status?: FeedItemStatus | undefined;
			disapprovalReasons?: string[] | undefined;
			googleCategory?: string | undefined;
			condition?: FeedItemCondition | undefined;
			availability?: FeedItemAvailability | undefined;
			price?: number | undefined;
			salePrice?: number | undefined;
			link?: string | undefined;
			imageLink?: string | undefined;
			gtin?: string | undefined;
			mpn?: string | undefined;
			brand?: string | undefined;
			expiresAt?: Date | undefined;
		},
	): Promise<ProductFeedItem | null>;

	deleteFeedItem(id: string): Promise<boolean>;

	getFeedItem(id: string): Promise<ProductFeedItem | null>;

	getFeedItemByProduct(localProductId: string): Promise<ProductFeedItem | null>;

	listFeedItems(params?: {
		status?: FeedItemStatus | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<ProductFeedItem[]>;

	submitFeed(): Promise<FeedSubmission>;

	getLastSubmission(): Promise<FeedSubmission | null>;

	listSubmissions(params?: {
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<FeedSubmission[]>;

	receiveOrder(params: {
		googleOrderId: string;
		status?: OrderStatus | undefined;
		items: unknown[];
		subtotal: number;
		shippingCost: number;
		tax: number;
		total: number;
		shippingAddress: Record<string, unknown>;
	}): Promise<ChannelOrder>;

	getOrder(id: string): Promise<ChannelOrder | null>;

	updateOrderStatus(
		id: string,
		status: OrderStatus,
		trackingNumber?: string | undefined,
		carrier?: string | undefined,
	): Promise<ChannelOrder | null>;

	listOrders(params?: {
		status?: OrderStatus | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<ChannelOrder[]>;

	getChannelStats(): Promise<ChannelStats>;

	getDiagnostics(): Promise<FeedDiagnostics>;

	/** Push a local feed item to Google Merchant Center. Requires API credentials. */
	pushProduct(id: string): Promise<ProductFeedItem | null>;

	/** Pull products and statuses from Google Merchant Center. Requires API credentials. */
	syncProducts(): Promise<{ synced: number }>;
};
