import type { ModuleController } from "@86d-app/core/types/module";

/** Types of activity events that can be tracked */
export type ActivityEventType =
	| "purchase"
	| "view"
	| "cart_add"
	| "wishlist_add";

/** Positions where trust badges can be displayed */
export type BadgePosition =
	| "header"
	| "footer"
	| "product"
	| "checkout"
	| "cart";

/** Time periods for aggregating activity data */
export type ActivityPeriod = "1h" | "24h" | "7d" | "30d";

export type ActivityEvent = {
	id: string;
	productId: string;
	productName: string;
	productSlug: string;
	productImage?: string | undefined;
	eventType: ActivityEventType;
	region?: string | undefined;
	country?: string | undefined;
	city?: string | undefined;
	quantity?: number | undefined;
	createdAt: Date;
};

export type TrustBadge = {
	id: string;
	name: string;
	description?: string | undefined;
	icon: string;
	url?: string | undefined;
	position: BadgePosition;
	priority: number;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
};

/** Aggregated activity stats for a product */
export type ProductActivity = {
	productId: string;
	viewCount: number;
	purchaseCount: number;
	cartAddCount: number;
	wishlistAddCount: number;
	totalEvents: number;
	recentPurchases: Array<{
		region?: string | undefined;
		city?: string | undefined;
		country?: string | undefined;
		quantity?: number | undefined;
		createdAt: Date;
	}>;
};

/** A product ranked by activity volume */
export type TrendingProduct = {
	productId: string;
	productName: string;
	productSlug: string;
	productImage?: string | undefined;
	eventCount: number;
	purchaseCount: number;
};

/** Summary stats for admin dashboard */
export type ActivitySummary = {
	totalEvents: number;
	totalPurchases: number;
	totalViews: number;
	totalCartAdds: number;
	uniqueProducts: number;
	topProducts: TrendingProduct[];
};

export type SocialProofController = ModuleController & {
	// --- Activity Events ---

	recordEvent(params: {
		productId: string;
		productName: string;
		productSlug: string;
		productImage?: string | undefined;
		eventType: ActivityEventType;
		region?: string | undefined;
		country?: string | undefined;
		city?: string | undefined;
		quantity?: number | undefined;
	}): Promise<ActivityEvent>;

	getProductActivity(
		productId: string,
		params?: {
			period?: ActivityPeriod | undefined;
		},
	): Promise<ProductActivity>;

	getRecentActivity(params?: {
		eventType?: ActivityEventType | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<ActivityEvent[]>;

	getTrendingProducts(params?: {
		period?: ActivityPeriod | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<TrendingProduct[]>;

	// --- Trust Badges ---

	createBadge(params: {
		name: string;
		description?: string | undefined;
		icon: string;
		url?: string | undefined;
		position: BadgePosition;
		priority?: number | undefined;
		isActive?: boolean | undefined;
	}): Promise<TrustBadge>;

	getBadge(id: string): Promise<TrustBadge | null>;

	updateBadge(
		id: string,
		params: {
			name?: string | undefined;
			description?: string | null | undefined;
			icon?: string | undefined;
			url?: string | null | undefined;
			position?: BadgePosition | undefined;
			priority?: number | undefined;
			isActive?: boolean | undefined;
		},
	): Promise<TrustBadge | null>;

	deleteBadge(id: string): Promise<boolean>;

	listBadges(params?: {
		position?: BadgePosition | undefined;
		isActive?: boolean | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<TrustBadge[]>;

	countBadges(params?: {
		position?: BadgePosition | undefined;
		isActive?: boolean | undefined;
	}): Promise<number>;

	// --- Admin Queries ---

	listEvents(params?: {
		productId?: string | undefined;
		eventType?: ActivityEventType | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<ActivityEvent[]>;

	countEvents(params?: {
		productId?: string | undefined;
		eventType?: ActivityEventType | undefined;
	}): Promise<number>;

	cleanupEvents(olderThanDays: number): Promise<number>;

	getActivitySummary(params?: {
		period?: ActivityPeriod | undefined;
	}): Promise<ActivitySummary>;
};
