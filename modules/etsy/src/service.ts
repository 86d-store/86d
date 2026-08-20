import type { ModuleController } from "@86d-app/core/types/module";

export type ListingStatus =
	| "active"
	| "draft"
	| "expired"
	| "inactive"
	| "sold-out";

export type ListingState = "draft" | "active" | "inactive";

export type WhoMadeIt = "i-did" | "collective" | "someone-else";

export type EtsyOrderStatus =
	| "open"
	| "paid"
	| "shipped"
	| "completed"
	| "cancelled";

export type EtsyListing = {
	id: string;
	localProductId: string;
	etsyListingId?: string | undefined;
	title: string;
	description?: string | undefined;
	status: ListingStatus;
	state: ListingState;
	price: number;
	quantity: number;
	renewalDate?: Date | undefined;
	whoMadeIt: WhoMadeIt;
	whenMadeIt: string;
	isSupply: boolean;
	materials: string[];
	tags: string[];
	taxonomyId?: string | undefined;
	shippingProfileId?: string | undefined;
	views: number;
	favorites: number;
	lastSyncedAt?: Date | undefined;
	error?: string | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type EtsyOrder = {
	id: string;
	etsyReceiptId: string;
	status: EtsyOrderStatus;
	items: unknown[];
	subtotal: number;
	shippingCost: number;
	etsyFee: number;
	processingFee: number;
	tax: number;
	total: number;
	buyerName?: string | undefined;
	buyerEmail?: string | undefined;
	shippingAddress: Record<string, unknown>;
	giftMessage?: string | undefined;
	trackingNumber?: string | undefined;
	carrier?: string | undefined;
	shipDate?: Date | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type EtsyReview = {
	id: string;
	etsyTransactionId: string;
	rating: number;
	review?: string | undefined;
	buyerName?: string | undefined;
	listingId?: string | undefined;
	createdAt: Date;
};

export type ChannelStats = {
	totalListings: number;
	active: number;
	draft: number;
	expired: number;
	inactive: number;
	soldOut: number;
	totalOrders: number;
	totalRevenue: number;
	totalViews: number;
	totalFavorites: number;
	averageRating: number;
	totalReviews: number;
};

export type EtsyController = ModuleController & {
	createListing(params: {
		localProductId: string;
		etsyListingId?: string | undefined;
		title: string;
		description?: string | undefined;
		status?: ListingStatus | undefined;
		state?: ListingState | undefined;
		price: number;
		quantity?: number | undefined;
		renewalDate?: Date | undefined;
		whoMadeIt?: WhoMadeIt | undefined;
		whenMadeIt?: string | undefined;
		isSupply?: boolean | undefined;
		materials?: string[] | undefined;
		tags?: string[] | undefined;
		taxonomyId?: string | undefined;
		shippingProfileId?: string | undefined;
	}): Promise<EtsyListing>;

	updateListing(
		id: string,
		params: {
			etsyListingId?: string | undefined;
			title?: string | undefined;
			description?: string | undefined;
			status?: ListingStatus | undefined;
			state?: ListingState | undefined;
			price?: number | undefined;
			quantity?: number | undefined;
			renewalDate?: Date | undefined;
			whoMadeIt?: WhoMadeIt | undefined;
			whenMadeIt?: string | undefined;
			isSupply?: boolean | undefined;
			materials?: string[] | undefined;
			tags?: string[] | undefined;
			taxonomyId?: string | undefined;
			shippingProfileId?: string | undefined;
			error?: string | undefined;
		},
	): Promise<EtsyListing | null>;

	deleteListing(id: string): Promise<boolean>;

	getListing(id: string): Promise<EtsyListing | null>;

	getListingByProduct(productId: string): Promise<EtsyListing | null>;

	listListings(params?: {
		status?: ListingStatus | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<EtsyListing[]>;

	renewListing(id: string): Promise<EtsyListing | null>;

	receiveOrder(params: {
		etsyReceiptId: string;
		status?: EtsyOrderStatus | undefined;
		items: unknown[];
		subtotal: number;
		shippingCost: number;
		etsyFee: number;
		processingFee: number;
		tax: number;
		total: number;
		buyerName?: string | undefined;
		buyerEmail?: string | undefined;
		shippingAddress: Record<string, unknown>;
		giftMessage?: string | undefined;
	}): Promise<EtsyOrder>;

	getOrder(id: string): Promise<EtsyOrder | null>;

	shipOrder(
		id: string,
		trackingNumber: string,
		carrier: string,
	): Promise<EtsyOrder | null>;

	listOrders(params?: {
		status?: EtsyOrderStatus | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<EtsyOrder[]>;

	receiveReview(params: {
		etsyTransactionId: string;
		rating: number;
		review?: string | undefined;
		buyerName?: string | undefined;
		listingId?: string | undefined;
	}): Promise<EtsyReview>;

	listReviews(params?: {
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<EtsyReview[]>;

	getAverageRating(): Promise<number>;

	getChannelStats(): Promise<ChannelStats>;

	getExpiringListings(daysAhead: number): Promise<EtsyListing[]>;

	/** Push a local listing to Etsy (create or update). Requires API credentials. */
	pushListing(id: string): Promise<EtsyListing | null>;

	/** Pull listings from Etsy and update local records. Requires API credentials. */
	syncListings(): Promise<{ synced: number }>;

	/** Pull orders from Etsy and store locally. Requires API credentials. */
	syncOrders(): Promise<{ synced: number }>;

	/** Pull reviews from Etsy and store locally. Requires API credentials. */
	syncReviews(): Promise<{ synced: number }>;
};
