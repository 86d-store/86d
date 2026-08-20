import type { ModuleController } from "@86d-app/core/types/module";

// ── Channel types ────────────────────────────────────────────────────

export type FeedChannel =
	| "google-shopping"
	| "facebook"
	| "microsoft"
	| "pinterest"
	| "tiktok"
	| "custom";

export type FeedFormat = "xml" | "csv" | "tsv" | "json";
export type FeedStatus = "active" | "paused" | "error" | "draft";
export type FeedItemStatus = "valid" | "warning" | "error" | "excluded";

// ── Field mapping ────────────────────────────────────────────────────

export type FieldMapping = {
	/** Source field from product data (e.g. "title", "price", "sku") */
	sourceField: string;
	/** Target field in the feed (e.g. "g:title", "g:price") */
	targetField: string;
	/** Optional transform: "uppercase", "lowercase", "prefix", "suffix", "template" */
	transform?: string | undefined;
	/** Value used with transform or when source field is empty */
	transformValue?: string | undefined;
	/** Static default if source field is missing */
	defaultValue?: string | undefined;
};

// ── Feed filters ─────────────────────────────────────────────────────

export type FeedFilters = {
	/** Only include products with these statuses */
	includeStatuses?: string[] | undefined;
	/** Exclude products in these categories */
	excludeCategories?: string[] | undefined;
	/** Only include products in these categories */
	includeCategories?: string[] | undefined;
	/** Minimum price filter */
	minPrice?: number | undefined;
	/** Maximum price filter */
	maxPrice?: number | undefined;
	/** Require at least one image */
	requireImages?: boolean | undefined;
	/** Require non-zero inventory */
	requireInStock?: boolean | undefined;
};

// ── Validation issues ────────────────────────────────────────────────

export type FeedItemIssue = {
	field: string;
	severity: "error" | "warning";
	message: string;
};

// ── Entities ─────────────────────────────────────────────────────────

export type Feed = {
	id: string;
	name: string;
	slug: string;
	channel: FeedChannel;
	format: FeedFormat;
	status: FeedStatus;
	country?: string | undefined;
	currency?: string | undefined;
	language?: string | undefined;
	fieldMappings: FieldMapping[];
	filters: FeedFilters;
	itemCount: number;
	errorCount: number;
	warningCount: number;
	cachedOutput?: string | undefined;
	lastGeneratedAt?: Date | undefined;
	createdAt: Date;
	updatedAt: Date;
};

export type FeedItem = {
	id: string;
	feedId: string;
	productId: string;
	mappedData: Record<string, string>;
	status: FeedItemStatus;
	issues: FeedItemIssue[];
	lastSyncedAt: Date;
};

export type CategoryMapping = {
	id: string;
	feedId: string;
	storeCategory: string;
	channelCategory: string;
	channelCategoryId?: string | undefined;
};

// ── Params ───────────────────────────────────────────────────────────

export type CreateFeedParams = {
	name: string;
	slug: string;
	channel: FeedChannel;
	format?: FeedFormat | undefined;
	country?: string | undefined;
	currency?: string | undefined;
	language?: string | undefined;
	fieldMappings?: FieldMapping[] | undefined;
	filters?: FeedFilters | undefined;
};

export type UpdateFeedParams = {
	name?: string | undefined;
	slug?: string | undefined;
	channel?: FeedChannel | undefined;
	format?: FeedFormat | undefined;
	status?: FeedStatus | undefined;
	country?: string | undefined;
	currency?: string | undefined;
	language?: string | undefined;
	fieldMappings?: FieldMapping[] | undefined;
	filters?: FeedFilters | undefined;
};

export type ProductData = {
	id: string;
	title: string;
	description?: string | undefined;
	price: number;
	compareAtPrice?: number | undefined;
	currency?: string | undefined;
	sku?: string | undefined;
	barcode?: string | undefined;
	brand?: string | undefined;
	category?: string | undefined;
	imageUrl?: string | undefined;
	additionalImages?: string[] | undefined;
	url?: string | undefined;
	availability?: string | undefined;
	condition?: string | undefined;
	weight?: number | undefined;
	weightUnit?: string | undefined;
	color?: string | undefined;
	size?: string | undefined;
	material?: string | undefined;
	customFields?: Record<string, string> | undefined;
};

export type GenerateFeedResult = {
	itemCount: number;
	errorCount: number;
	warningCount: number;
	output: string;
};

export type FeedStats = {
	totalFeeds: number;
	activeFeeds: number;
	totalItems: number;
	errorItems: number;
	warningItems: number;
};

// ── Controller ───────────────────────────────────────────────────────

export type ProductFeedsController = ModuleController & {
	// Feed CRUD
	createFeed(params: CreateFeedParams): Promise<Feed>;
	getFeed(id: string): Promise<Feed | null>;
	getFeedBySlug(slug: string): Promise<Feed | null>;
	updateFeed(id: string, params: UpdateFeedParams): Promise<Feed | null>;
	deleteFeed(id: string): Promise<boolean>;
	listFeeds(params?: {
		status?: FeedStatus | undefined;
		channel?: FeedChannel | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<Feed[]>;
	countFeeds(): Promise<number>;

	// Feed generation
	generateFeed(
		id: string,
		products: ProductData[],
	): Promise<GenerateFeedResult | null>;
	getFeedOutput(id: string): Promise<string | null>;

	// Feed items
	getFeedItems(
		feedId: string,
		params?: {
			status?: FeedItemStatus | undefined;
			take?: number | undefined;
			skip?: number | undefined;
		},
	): Promise<FeedItem[]>;
	getFeedItem(feedId: string, productId: string): Promise<FeedItem | null>;
	countFeedItems(feedId: string): Promise<number>;

	// Category mappings
	addCategoryMapping(
		feedId: string,
		params: {
			storeCategory: string;
			channelCategory: string;
			channelCategoryId?: string | undefined;
		},
	): Promise<CategoryMapping>;
	updateCategoryMapping(
		id: string,
		params: {
			channelCategory?: string | undefined;
			channelCategoryId?: string | undefined;
		},
	): Promise<CategoryMapping | null>;
	deleteCategoryMapping(id: string): Promise<boolean>;
	listCategoryMappings(feedId: string): Promise<CategoryMapping[]>;

	// Validation
	validateFeed(id: string): Promise<FeedItemIssue[]>;

	// Stats
	getStats(): Promise<FeedStats>;
};
