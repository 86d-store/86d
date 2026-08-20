import type { ModuleController } from "@86d-app/core/types/module";

export type RecommendationStrategy =
	| "manual"
	| "bought_together"
	| "trending"
	| "personalized"
	| "ai_similar";

export type InteractionType = "view" | "purchase" | "add_to_cart";

export type RecommendationRule = {
	id: string;
	name: string;
	strategy: RecommendationStrategy;
	sourceProductId?: string | undefined;
	targetProductIds: string[];
	weight: number;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
};

export type CoOccurrence = {
	id: string;
	productId1: string;
	productId2: string;
	count: number;
	lastOccurredAt: Date;
};

export type ProductInteraction = {
	id: string;
	productId: string;
	customerId?: string | undefined;
	sessionId?: string | undefined;
	type: InteractionType;
	productName: string;
	productSlug: string;
	productImage?: string | undefined;
	productPrice?: number | undefined;
	productCategory?: string | undefined;
	createdAt: Date;
};

export type ProductEmbedding = {
	id: string;
	productId: string;
	embedding: number[];
	text: string;
	createdAt: Date;
};

export type RecommendationSurface =
	| "for_product"
	| "trending"
	| "personalized"
	| "ai_similar";

export type RecommendationImpression = {
	id: string;
	surface: RecommendationSurface;
	sourceProductId?: string | undefined;
	customerId?: string | undefined;
	sessionId?: string | undefined;
	productIds: string[];
	strategies: RecommendationStrategy[];
	servedAt: Date;
};

export type RecommendationClick = {
	id: string;
	impressionId: string;
	surface: RecommendationSurface;
	productId: string;
	position: number;
	strategy?: RecommendationStrategy | undefined;
	clickedAt: Date;
};

export type RecommendationAnalytics = {
	totalImpressions: number;
	totalServedItems: number;
	totalClicks: number;
	clickThroughRate: number;
	avgClickPosition: number;
	bySurface: Array<{
		surface: RecommendationSurface;
		impressions: number;
		clicks: number;
		clickThroughRate: number;
	}>;
};

export type RecommendedProduct = {
	productId: string;
	productName: string;
	productSlug: string;
	productImage?: string | undefined;
	productPrice?: number | undefined;
	score: number;
	strategy: RecommendationStrategy;
};

export type RecommendationController = ModuleController & {
	// --- Rules ---
	createRule(params: {
		name: string;
		strategy: RecommendationStrategy;
		sourceProductId?: string | undefined;
		targetProductIds: string[];
		weight?: number | undefined;
		isActive?: boolean | undefined;
	}): Promise<RecommendationRule>;

	updateRule(
		id: string,
		params: {
			name?: string | undefined;
			strategy?: RecommendationStrategy | undefined;
			sourceProductId?: string | undefined;
			targetProductIds?: string[] | undefined;
			weight?: number | undefined;
			isActive?: boolean | undefined;
		},
	): Promise<RecommendationRule | null>;

	deleteRule(id: string): Promise<boolean>;

	getRule(id: string): Promise<RecommendationRule | null>;

	listRules(params?: {
		strategy?: RecommendationStrategy | undefined;
		isActive?: boolean | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<RecommendationRule[]>;

	countRules(params?: {
		strategy?: RecommendationStrategy | undefined;
		isActive?: boolean | undefined;
	}): Promise<number>;

	// --- Co-occurrences ---
	recordPurchase(productIds: string[]): Promise<number>;

	getCoOccurrences(
		productId: string,
		params?: { take?: number | undefined },
	): Promise<CoOccurrence[]>;

	// --- Interactions ---
	trackInteraction(params: {
		productId: string;
		customerId?: string | undefined;
		sessionId?: string | undefined;
		type: InteractionType;
		productName: string;
		productSlug: string;
		productImage?: string | undefined;
		productPrice?: number | undefined;
		productCategory?: string | undefined;
	}): Promise<ProductInteraction>;

	// --- Recommendations ---
	getForProduct(
		productId: string,
		params?: {
			strategy?: RecommendationStrategy | undefined;
			take?: number | undefined;
		},
	): Promise<RecommendedProduct[]>;

	getTrending(params?: {
		take?: number | undefined;
		since?: Date | undefined;
	}): Promise<RecommendedProduct[]>;

	getPersonalized(
		customerId: string,
		params?: { take?: number | undefined },
	): Promise<RecommendedProduct[]>;

	// --- AI embeddings ---
	generateProductEmbedding(
		productId: string,
		text: string,
		metadata?: {
			productName?: string | undefined;
			productSlug?: string | undefined;
			productImage?: string | undefined;
			productPrice?: number | undefined;
		},
	): Promise<ProductEmbedding | null>;

	getAISimilar(
		productId: string,
		params?: { take?: number | undefined },
	): Promise<RecommendedProduct[]>;

	// --- Impressions & clicks ---
	recordImpression(params: {
		surface: RecommendationSurface;
		sourceProductId?: string | undefined;
		customerId?: string | undefined;
		sessionId?: string | undefined;
		productIds: string[];
		strategies: RecommendationStrategy[];
	}): Promise<RecommendationImpression>;

	recordClick(params: {
		impressionId: string;
		productId: string;
		position: number;
		surface?: RecommendationSurface | undefined;
		strategy?: RecommendationStrategy | undefined;
	}): Promise<RecommendationClick | null>;

	getAnalytics(): Promise<RecommendationAnalytics>;

	// --- Admin stats ---
	getStats(): Promise<{
		totalRules: number;
		activeRules: number;
		totalCoOccurrences: number;
		totalInteractions: number;
		embeddingsCount: number;
		aiConfigured: boolean;
		totalImpressions: number;
		totalClicks: number;
		clickThroughRate: number;
		avgClickPosition: number;
	}>;
};
