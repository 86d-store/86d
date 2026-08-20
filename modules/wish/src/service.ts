import type { ModuleController } from "@86d-app/core/types/module";

export type WishProductStatus =
	| "active"
	| "disabled"
	| "pending-review"
	| "rejected";
export type WishOrderStatus =
	| "pending"
	| "approved"
	| "shipped"
	| "delivered"
	| "refunded"
	| "cancelled";

export type WishProduct = {
	id: string;
	localProductId: string;
	wishProductId?: string | undefined;
	title: string;
	status: WishProductStatus;
	price: number;
	shippingPrice: number;
	quantity: number;
	parentSku?: string | undefined;
	tags: string[];
	lastSyncedAt?: Date | undefined;
	reviewStatus?: string | undefined;
	error?: string | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type WishOrder = {
	id: string;
	wishOrderId: string;
	status: WishOrderStatus;
	items: unknown[];
	orderTotal: number;
	shippingTotal: number;
	wishFee: number;
	customerName?: string | undefined;
	shippingAddress: Record<string, unknown>;
	trackingNumber?: string | undefined;
	carrier?: string | undefined;
	shipByDate?: Date | undefined;
	deliverByDate?: Date | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type ChannelStats = {
	totalProducts: number;
	activeProducts: number;
	totalOrders: number;
	totalRevenue: number;
	pendingShipments: number;
	disabledProducts: number;
};

export type WishController = ModuleController & {
	createProduct(params: {
		localProductId: string;
		title: string;
		price: number;
		shippingPrice: number;
		quantity?: number | undefined;
		parentSku?: string | undefined;
		tags?: string[] | undefined;
	}): Promise<WishProduct>;

	updateProduct(
		id: string,
		params: {
			title?: string | undefined;
			price?: number | undefined;
			shippingPrice?: number | undefined;
			quantity?: number | undefined;
			parentSku?: string | undefined;
			tags?: string[] | undefined;
			wishProductId?: string | undefined;
			status?: WishProductStatus | undefined;
			reviewStatus?: string | undefined;
		},
	): Promise<WishProduct | null>;

	disableProduct(id: string): Promise<WishProduct | null>;

	getProduct(id: string): Promise<WishProduct | null>;

	getProductByLocalId(productId: string): Promise<WishProduct | null>;

	listProducts(params?: {
		status?: WishProductStatus | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<WishProduct[]>;

	receiveOrder(params: {
		wishOrderId: string;
		items: unknown[];
		orderTotal: number;
		shippingTotal: number;
		wishFee: number;
		customerName?: string | undefined;
		shippingAddress?: Record<string, unknown> | undefined;
		shipByDate?: Date | undefined;
		deliverByDate?: Date | undefined;
	}): Promise<WishOrder>;

	getOrder(id: string): Promise<WishOrder | null>;

	shipOrder(
		id: string,
		trackingNumber: string,
		carrier: string,
	): Promise<WishOrder | null>;

	listOrders(params?: {
		status?: WishOrderStatus | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<WishOrder[]>;

	getChannelStats(): Promise<ChannelStats>;

	getPendingShipments(): Promise<WishOrder[]>;
};
