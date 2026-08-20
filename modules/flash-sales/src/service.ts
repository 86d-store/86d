import type { ModuleController } from "@86d-app/core/types/module";

export type FlashSaleStatus = "draft" | "scheduled" | "active" | "ended";

export type FlashSale = {
	id: string;
	name: string;
	slug: string;
	description?: string;
	status: FlashSaleStatus;
	startsAt: Date;
	endsAt: Date;
	createdAt: Date;
	updatedAt: Date;
};

export type FlashSaleProduct = {
	id: string;
	flashSaleId: string;
	productId: string;
	productName?: string;
	productSlug?: string;
	productImage?: string;
	salePrice: number;
	originalPrice: number;
	stockLimit?: number;
	stockSold: number;
	sortOrder: number;
	createdAt: Date;
};

export type FlashSaleWithProducts = FlashSale & {
	products: FlashSaleProduct[];
};

export type FlashSaleStats = {
	totalSales: number;
	draftSales: number;
	scheduledSales: number;
	activeSales: number;
	endedSales: number;
	totalProducts: number;
	totalUnitsSold: number;
};

export type ActiveFlashSaleProduct = {
	productId: string;
	salePrice: number;
	originalPrice: number;
	discountPercent: number;
	stockLimit: number | null;
	stockSold: number;
	stockRemaining: number | null;
	flashSaleId: string;
	flashSaleName: string;
	endsAt: Date;
};

export type FlashSaleController = ModuleController & {
	// ── Flash Sales ──

	createFlashSale(params: {
		name: string;
		slug: string;
		description?: string;
		status?: FlashSaleStatus;
		startsAt: Date;
		endsAt: Date;
	}): Promise<FlashSale>;

	getFlashSale(id: string): Promise<FlashSale | null>;

	getFlashSaleBySlug(slug: string): Promise<FlashSale | null>;

	updateFlashSale(
		id: string,
		params: {
			name?: string;
			slug?: string;
			description?: string | null;
			status?: FlashSaleStatus;
			startsAt?: Date;
			endsAt?: Date;
		},
	): Promise<FlashSale | null>;

	deleteFlashSale(id: string): Promise<boolean>;

	listFlashSales(params?: {
		status?: FlashSaleStatus;
		take?: number;
		skip?: number;
	}): Promise<FlashSale[]>;

	countFlashSales(params?: { status?: FlashSaleStatus }): Promise<number>;

	// ── Flash Sale Products ──

	addProduct(params: {
		flashSaleId: string;
		productId: string;
		productName?: string;
		productSlug?: string;
		productImage?: string;
		salePrice: number;
		originalPrice: number;
		stockLimit?: number;
		sortOrder?: number;
	}): Promise<FlashSaleProduct>;

	updateProduct(
		flashSaleId: string,
		productId: string,
		params: {
			salePrice?: number;
			originalPrice?: number;
			stockLimit?: number | null;
			sortOrder?: number;
		},
	): Promise<FlashSaleProduct | null>;

	removeProduct(flashSaleId: string, productId: string): Promise<boolean>;

	listProducts(
		flashSaleId: string,
		params?: { take?: number; skip?: number },
	): Promise<FlashSaleProduct[]>;

	countProducts(flashSaleId: string): Promise<number>;

	bulkAddProducts(
		flashSaleId: string,
		products: Array<{
			productId: string;
			productName?: string;
			productSlug?: string;
			productImage?: string;
			salePrice: number;
			originalPrice: number;
			stockLimit?: number;
			sortOrder?: number;
		}>,
	): Promise<FlashSaleProduct[]>;

	// ── Stock tracking ──

	recordSale(
		flashSaleId: string,
		productId: string,
		quantity: number,
	): Promise<FlashSaleProduct | null>;

	// ── Storefront queries ──

	getActiveSales(): Promise<FlashSaleWithProducts[]>;

	getActiveProductDeal(
		productId: string,
	): Promise<ActiveFlashSaleProduct | null>;

	getActiveProductDeals(
		productIds: string[],
	): Promise<Record<string, ActiveFlashSaleProduct>>;

	// ── Stats ──

	getStats(): Promise<FlashSaleStats>;
};
