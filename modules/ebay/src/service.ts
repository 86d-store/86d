import type { ModuleController } from "@86d-app/core/types/module";

export type ListingStatus = "active" | "ended" | "sold" | "draft" | "error";
export type ListingType = "fixed-price" | "auction";
export type ListingCondition =
	| "new"
	| "like-new"
	| "very-good"
	| "good"
	| "acceptable"
	| "for-parts";
export type EbayOrderStatus =
	| "pending"
	| "paid"
	| "shipped"
	| "delivered"
	| "cancelled"
	| "returned";

export type EbayListing = {
	id: string;
	localProductId: string;
	ebayItemId?: string | undefined;
	title: string;
	status: ListingStatus;
	listingType: ListingType;
	price: number;
	auctionStartPrice?: number | undefined;
	currentBid?: number | undefined;
	bidCount: number;
	quantity: number;
	condition: ListingCondition;
	categoryId?: string | undefined;
	duration?: string | undefined;
	startTime?: Date | undefined;
	endTime?: Date | undefined;
	watchers: number;
	views: number;
	lastSyncedAt?: Date | undefined;
	error?: string | undefined;
	metadata: Record<string, unknown>;
	createdAt: Date;
	updatedAt: Date;
};

export type EbayOrder = {
	id: string;
	ebayOrderId: string;
	status: EbayOrderStatus;
	items: unknown[];
	subtotal: number;
	shippingCost: number;
	ebayFee: number;
	paymentProcessingFee: number;
	total: number;
	buyerUsername?: string | undefined;
	buyerName?: string | undefined;
	shippingAddress: Record<string, unknown>;
	trackingNumber?: string | undefined;
	carrier?: string | undefined;
	shipDate?: Date | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type ChannelStats = {
	totalListings: number;
	activeListings: number;
	totalOrders: number;
	totalRevenue: number;
	activeAuctions: number;
	averagePrice: number;
};

export type EbayController = ModuleController & {
	createListing(params: {
		localProductId: string;
		title: string;
		price: number;
		listingType?: ListingType | undefined;
		auctionStartPrice?: number | undefined;
		quantity?: number | undefined;
		condition?: ListingCondition | undefined;
		categoryId?: string | undefined;
		duration?: string | undefined;
		metadata?: Record<string, unknown> | undefined;
	}): Promise<EbayListing>;

	updateListing(
		id: string,
		params: {
			title?: string | undefined;
			price?: number | undefined;
			quantity?: number | undefined;
			condition?: ListingCondition | undefined;
			categoryId?: string | undefined;
			duration?: string | undefined;
			ebayItemId?: string | undefined;
			status?: ListingStatus | undefined;
			metadata?: Record<string, unknown> | undefined;
		},
	): Promise<EbayListing | null>;

	endListing(id: string): Promise<EbayListing | null>;

	getListing(id: string): Promise<EbayListing | null>;

	getListingByProduct(productId: string): Promise<EbayListing | null>;

	listListings(params?: {
		status?: ListingStatus | undefined;
		listingType?: ListingType | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<EbayListing[]>;

	receiveOrder(params: {
		ebayOrderId: string;
		items: unknown[];
		subtotal: number;
		shippingCost: number;
		ebayFee: number;
		paymentProcessingFee: number;
		total: number;
		buyerUsername?: string | undefined;
		buyerName?: string | undefined;
		shippingAddress?: Record<string, unknown> | undefined;
	}): Promise<EbayOrder>;

	getOrder(id: string): Promise<EbayOrder | null>;

	shipOrder(
		id: string,
		trackingNumber: string,
		carrier: string,
	): Promise<EbayOrder | null>;

	listOrders(params?: {
		status?: EbayOrderStatus | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<EbayOrder[]>;

	syncOrders(): Promise<EbayOrder[]>;

	getChannelStats(): Promise<ChannelStats>;

	getActiveAuctions(): Promise<EbayListing[]>;
};
