import type { ModuleController } from "@86d-app/core/types/module";

// --- Enums ---

export type AuctionType = "english" | "dutch" | "sealed";

export type AuctionStatus =
	| "draft"
	| "scheduled"
	| "active"
	| "ended"
	| "sold"
	| "cancelled";

// --- Entities ---

export type Auction = {
	id: string;
	title: string;
	description?: string | undefined;
	productId: string;
	productName: string;
	imageUrl?: string | undefined;
	type: AuctionType;
	status: AuctionStatus;
	/** Starting bid amount in cents */
	startingPrice: number;
	/** Minimum price for item to sell (0 = no reserve) */
	reservePrice: number;
	/** Optional buy-it-now price in cents (0 = disabled) */
	buyNowPrice: number;
	/** Minimum bid increment in cents */
	bidIncrement: number;
	/** Current highest bid in cents */
	currentBid: number;
	/** Total number of bids placed */
	bidCount: number;
	/** ID of the current highest bidder */
	highestBidderId?: string | undefined;
	/** Winner customer ID (set after auction ends) */
	winnerId?: string | undefined;
	/** Final sale price in cents */
	finalPrice?: number | undefined;
	/** For dutch auctions: price decreases by this amount each interval */
	priceDropAmount?: number | undefined;
	/** For dutch auctions: interval in minutes between price drops */
	priceDropIntervalMinutes?: number | undefined;
	startsAt: Date;
	endsAt: Date;
	antiSnipingEnabled: boolean;
	antiSnipingMinutes: number;
	createdAt: Date;
	updatedAt: Date;
};

export type Bid = {
	id: string;
	auctionId: string;
	customerId: string;
	customerName?: string | undefined;
	/** Bid amount in cents */
	amount: number;
	/** For sealed auctions: max autobid amount */
	maxAutoBid?: number | undefined;
	isWinning: boolean;
	isAutoBid: boolean;
	createdAt: Date;
};

export type AuctionWatch = {
	id: string;
	auctionId: string;
	customerId: string;
	createdAt: Date;
};

// --- Params ---

export type CreateAuctionParams = {
	title: string;
	description?: string | undefined;
	productId: string;
	productName: string;
	imageUrl?: string | undefined;
	type: AuctionType;
	startingPrice: number;
	reservePrice?: number | undefined;
	buyNowPrice?: number | undefined;
	bidIncrement?: number | undefined;
	priceDropAmount?: number | undefined;
	priceDropIntervalMinutes?: number | undefined;
	startsAt: Date;
	endsAt: Date;
	antiSnipingEnabled?: boolean | undefined;
	antiSnipingMinutes?: number | undefined;
};

export type UpdateAuctionParams = {
	title?: string | undefined;
	description?: string | undefined;
	imageUrl?: string | undefined;
	startingPrice?: number | undefined;
	reservePrice?: number | undefined;
	buyNowPrice?: number | undefined;
	bidIncrement?: number | undefined;
	priceDropAmount?: number | undefined;
	priceDropIntervalMinutes?: number | undefined;
	startsAt?: Date | undefined;
	endsAt?: Date | undefined;
	antiSnipingEnabled?: boolean | undefined;
	antiSnipingMinutes?: number | undefined;
};

export type PlaceBidParams = {
	auctionId: string;
	customerId: string;
	customerName?: string | undefined;
	amount: number;
	maxAutoBid?: number | undefined;
};

export type BuyNowParams = {
	auctionId: string;
	customerId: string;
};

// --- Result types ---

export type BidResult = {
	bid: Bid;
	auction: Auction;
	outbidPreviousHighest: boolean;
};

export type AuctionSummary = {
	totalAuctions: number;
	draft: number;
	scheduled: number;
	active: number;
	ended: number;
	sold: number;
	cancelled: number;
	totalBids: number;
	totalRevenue: number;
};

// --- Controller ---

export type AuctionController = ModuleController & {
	// Auction CRUD
	createAuction(params: CreateAuctionParams): Promise<Auction>;
	updateAuction(
		id: string,
		params: UpdateAuctionParams,
	): Promise<Auction | null>;
	getAuction(id: string): Promise<Auction | null>;
	listAuctions(params?: {
		status?: AuctionStatus | undefined;
		type?: AuctionType | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<Auction[]>;
	deleteAuction(id: string): Promise<boolean>;

	// Auction lifecycle
	publishAuction(id: string): Promise<Auction | null>;
	cancelAuction(
		id: string,
		reason?: string | undefined,
	): Promise<Auction | null>;
	closeAuction(id: string): Promise<Auction | null>;

	// Bidding
	placeBid(params: PlaceBidParams): Promise<BidResult>;
	getBid(id: string): Promise<Bid | null>;
	listBids(
		auctionId: string,
		params?: {
			take?: number | undefined;
			skip?: number | undefined;
		},
	): Promise<Bid[]>;
	getHighestBid(auctionId: string): Promise<Bid | null>;
	getBidsByCustomer(
		customerId: string,
		params?: {
			auctionId?: string | undefined;
			take?: number | undefined;
			skip?: number | undefined;
		},
	): Promise<Bid[]>;

	// Buy-it-now
	buyNow(params: BuyNowParams): Promise<Auction>;

	// Watching
	watchAuction(auctionId: string, customerId: string): Promise<AuctionWatch>;
	unwatchAuction(auctionId: string, customerId: string): Promise<boolean>;
	getWatchers(auctionId: string): Promise<AuctionWatch[]>;
	isWatching(auctionId: string, customerId: string): Promise<boolean>;
	getWatchedAuctions(customerId: string): Promise<AuctionWatch[]>;

	// Analytics
	getAuctionSummary(): Promise<AuctionSummary>;
};
