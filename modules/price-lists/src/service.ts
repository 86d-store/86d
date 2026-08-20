import type { ModuleController } from "@86d-app/core/types/module";

export type PriceListStatus = "active" | "inactive" | "scheduled";

export type PriceList = {
	id: string;
	name: string;
	slug: string;
	description?: string;
	currency?: string;
	priority: number;
	status: PriceListStatus;
	startsAt?: Date;
	endsAt?: Date;
	customerGroupId?: string;
	createdAt: Date;
	updatedAt: Date;
};

export type PriceEntry = {
	id: string;
	priceListId: string;
	productId: string;
	price: number;
	compareAtPrice?: number;
	minQuantity?: number;
	maxQuantity?: number;
	createdAt: Date;
};

export type ResolvedPrice = {
	price: number;
	compareAtPrice: number | null;
	priceListId: string;
	priceListName: string;
};

export type PriceListStats = {
	totalPriceLists: number;
	activePriceLists: number;
	scheduledPriceLists: number;
	inactivePriceLists: number;
	totalEntries: number;
	priceListsWithEntries: number;
};

export type PriceListController = ModuleController & {
	// ── Price Lists ──

	createPriceList(params: {
		name: string;
		slug: string;
		description?: string;
		currency?: string;
		priority?: number;
		status?: PriceListStatus;
		startsAt?: Date;
		endsAt?: Date;
		customerGroupId?: string;
	}): Promise<PriceList>;

	getPriceList(id: string): Promise<PriceList | null>;

	getPriceListBySlug(slug: string): Promise<PriceList | null>;

	updatePriceList(
		id: string,
		params: {
			name?: string;
			slug?: string;
			description?: string | null;
			currency?: string | null;
			priority?: number;
			status?: PriceListStatus;
			startsAt?: Date | null;
			endsAt?: Date | null;
			customerGroupId?: string | null;
		},
	): Promise<PriceList | null>;

	deletePriceList(id: string): Promise<boolean>;

	listPriceLists(params?: {
		status?: PriceListStatus;
		customerGroupId?: string;
		take?: number;
		skip?: number;
	}): Promise<PriceList[]>;

	countPriceLists(params?: {
		status?: PriceListStatus;
		customerGroupId?: string;
	}): Promise<number>;

	// ── Price Entries ──

	setPrice(params: {
		priceListId: string;
		productId: string;
		price: number;
		compareAtPrice?: number;
		minQuantity?: number;
		maxQuantity?: number;
	}): Promise<PriceEntry>;

	getPrice(priceListId: string, productId: string): Promise<PriceEntry | null>;

	removePrice(priceListId: string, productId: string): Promise<boolean>;

	listPrices(
		priceListId: string,
		params?: { take?: number; skip?: number },
	): Promise<PriceEntry[]>;

	countPrices(priceListId: string): Promise<number>;

	bulkSetPrices(
		priceListId: string,
		entries: Array<{
			productId: string;
			price: number;
			compareAtPrice?: number;
			minQuantity?: number;
			maxQuantity?: number;
		}>,
	): Promise<PriceEntry[]>;

	// ── Price Resolution ──

	resolvePrice(
		productId: string,
		params?: {
			customerGroupId?: string;
			quantity?: number;
			currency?: string;
		},
	): Promise<ResolvedPrice | null>;

	resolvePrices(
		productIds: string[],
		params?: {
			customerGroupId?: string;
			quantity?: number;
			currency?: string;
		},
	): Promise<Record<string, ResolvedPrice>>;

	// ── Stats ──

	getStats(): Promise<PriceListStats>;
};
