import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	ActiveFlashSaleProduct,
	FlashSale,
	FlashSaleController,
	FlashSaleProduct,
	FlashSaleStats,
	FlashSaleWithProducts,
} from "./service";

function buildFindOptions(opts: {
	where?: Record<string, unknown>;
	orderBy?: Record<string, "asc" | "desc">;
	take?: number | undefined;
	skip?: number | undefined;
}) {
	const result: Record<string, unknown> = {};
	if (opts.where) result.where = opts.where;
	if (opts.orderBy) result.orderBy = opts.orderBy;
	if (opts.take != null) result.take = opts.take;
	if (opts.skip != null) result.skip = opts.skip;
	return result;
}

function isCurrentlyActive(sale: FlashSale): boolean {
	if (sale.status !== "active") return false;
	const now = new Date();
	if (now < sale.startsAt) return false;
	if (now > sale.endsAt) return false;
	return true;
}

function calcDiscountPercent(originalPrice: number, salePrice: number): number {
	if (originalPrice <= 0) return 0;
	return Math.round(((originalPrice - salePrice) / originalPrice) * 100);
}

export function createFlashSaleController(
	data: ModuleDataService,
): FlashSaleController {
	return {
		// ── Flash Sales ─────────────────────────────────────

		async createFlashSale(params) {
			const id = crypto.randomUUID();
			const now = new Date();
			const sale: FlashSale = {
				id,
				name: params.name,
				slug: params.slug,
				status: params.status ?? "draft",
				startsAt: params.startsAt,
				endsAt: params.endsAt,
				createdAt: now,
				updatedAt: now,
				...(params.description != null && {
					description: params.description,
				}),
			};
			await data.upsert("flashSale", id, sale as Record<string, unknown>);
			return sale;
		},

		async getFlashSale(id) {
			const raw = await data.get("flashSale", id);
			return raw as unknown as FlashSale;
		},

		async getFlashSaleBySlug(slug) {
			const results = (await data.findMany("flashSale", {
				where: { slug },
			})) as unknown as FlashSale[];
			return results[0] ?? null;
		},

		async updateFlashSale(id, params) {
			const existing = await data.get("flashSale", id);
			if (!existing) return null;

			const current = existing as unknown as FlashSale;

			const base: FlashSale = {
				id: current.id,
				name: params.name ?? current.name,
				slug: params.slug ?? current.slug,
				status: params.status ?? current.status,
				startsAt: params.startsAt ?? current.startsAt,
				endsAt: params.endsAt ?? current.endsAt,
				createdAt: current.createdAt,
				updatedAt: new Date(),
			};

			const descVal =
				params.description === null
					? null
					: (params.description ?? current.description);
			if (descVal != null) base.description = descVal;

			await data.upsert("flashSale", id, base as Record<string, unknown>);
			return base;
		},

		async deleteFlashSale(id) {
			const existing = await data.get("flashSale", id);
			if (!existing) return false;

			// Cascade: remove all sale products
			const products = (await data.findMany("flashSaleProduct", {
				where: { flashSaleId: id },
			})) as unknown as FlashSaleProduct[];
			for (const product of products) {
				await data.delete("flashSaleProduct", product.id);
			}

			await data.delete("flashSale", id);
			return true;
		},

		async listFlashSales(params) {
			const where: Record<string, unknown> = {};
			if (params?.status !== undefined) where.status = params.status;

			return (await data.findMany(
				"flashSale",
				buildFindOptions({
					where,
					orderBy: { startsAt: "desc" },
					take: params?.take,
					skip: params?.skip,
				}),
			)) as unknown as FlashSale[];
		},

		async countFlashSales(params) {
			const where: Record<string, unknown> = {};
			if (params?.status !== undefined) where.status = params.status;

			const results = (await data.findMany("flashSale", {
				where,
			})) as unknown as FlashSale[];
			return results.length;
		},

		// ── Flash Sale Products ──────────────────────────────

		async addProduct(params) {
			// Check for existing entry (upsert by flashSaleId + productId)
			const existing = (await data.findMany("flashSaleProduct", {
				where: {
					flashSaleId: params.flashSaleId,
					productId: params.productId,
				},
			})) as unknown as FlashSaleProduct[];

			const id = existing[0]?.id ?? crypto.randomUUID();
			const product: FlashSaleProduct = {
				id,
				flashSaleId: params.flashSaleId,
				productId: params.productId,
				...(params.productName ? { productName: params.productName } : {}),
				...(params.productSlug ? { productSlug: params.productSlug } : {}),
				...(params.productImage ? { productImage: params.productImage } : {}),
				salePrice: params.salePrice,
				originalPrice: params.originalPrice,
				stockSold: existing[0]?.stockSold ?? 0,
				sortOrder: params.sortOrder ?? 0,
				createdAt: existing[0]?.createdAt ?? new Date(),
				...(params.stockLimit != null && {
					stockLimit: params.stockLimit,
				}),
			};

			await data.upsert(
				"flashSaleProduct",
				id,
				product as Record<string, unknown>,
			);
			return product;
		},

		async updateProduct(flashSaleId, productId, params) {
			const existing = (await data.findMany("flashSaleProduct", {
				where: { flashSaleId, productId },
			})) as unknown as FlashSaleProduct[];

			if (existing.length === 0) return null;

			const current = existing[0];
			const updated: FlashSaleProduct = {
				id: current.id,
				flashSaleId: current.flashSaleId,
				productId: current.productId,
				salePrice: params.salePrice ?? current.salePrice,
				originalPrice: params.originalPrice ?? current.originalPrice,
				stockSold: current.stockSold,
				sortOrder: params.sortOrder ?? current.sortOrder,
				createdAt: current.createdAt,
			};

			// Handle stockLimit: null clears it, undefined preserves
			if (params.stockLimit === null) {
				// Cleared — don't set stockLimit
			} else if (params.stockLimit != null) {
				updated.stockLimit = params.stockLimit;
			} else if (current.stockLimit != null) {
				updated.stockLimit = current.stockLimit;
			}

			await data.upsert(
				"flashSaleProduct",
				current.id,
				updated as Record<string, unknown>,
			);
			return updated;
		},

		async removeProduct(flashSaleId, productId) {
			const existing = (await data.findMany("flashSaleProduct", {
				where: { flashSaleId, productId },
			})) as unknown as FlashSaleProduct[];

			if (existing.length === 0) return false;

			for (const entry of existing) {
				await data.delete("flashSaleProduct", entry.id);
			}
			return true;
		},

		async listProducts(flashSaleId, params) {
			return (await data.findMany(
				"flashSaleProduct",
				buildFindOptions({
					where: { flashSaleId },
					orderBy: { sortOrder: "asc" },
					take: params?.take,
					skip: params?.skip,
				}),
			)) as unknown as FlashSaleProduct[];
		},

		async countProducts(flashSaleId) {
			const results = (await data.findMany("flashSaleProduct", {
				where: { flashSaleId },
			})) as unknown as FlashSaleProduct[];
			return results.length;
		},

		async bulkAddProducts(flashSaleId, products) {
			const results: FlashSaleProduct[] = [];
			for (const product of products) {
				const result = await this.addProduct({
					flashSaleId,
					productId: product.productId,
					salePrice: product.salePrice,
					originalPrice: product.originalPrice,
					...(product.stockLimit != null && {
						stockLimit: product.stockLimit,
					}),
					...(product.sortOrder != null && {
						sortOrder: product.sortOrder,
					}),
				});
				results.push(result);
			}
			return results;
		},

		// ── Stock tracking ───────────────────────────────────

		async recordSale(flashSaleId, productId, quantity) {
			const existing = (await data.findMany("flashSaleProduct", {
				where: { flashSaleId, productId },
			})) as unknown as FlashSaleProduct[];

			if (existing.length === 0) return null;

			const current = existing[0];

			// Check stock limit
			if (
				current.stockLimit != null &&
				current.stockSold + quantity > current.stockLimit
			) {
				return null;
			}

			const updated: FlashSaleProduct = {
				...current,
				stockSold: current.stockSold + quantity,
			};

			await data.upsert(
				"flashSaleProduct",
				current.id,
				updated as Record<string, unknown>,
			);
			return updated;
		},

		// ── Storefront queries ───────────────────────────────

		async getActiveSales() {
			const allSales = (await data.findMany("flashSale", {
				orderBy: { startsAt: "asc" },
			})) as unknown as FlashSale[];

			const activeSales = allSales.filter(isCurrentlyActive);

			const results: FlashSaleWithProducts[] = [];
			for (const sale of activeSales) {
				const products = (await data.findMany("flashSaleProduct", {
					where: { flashSaleId: sale.id },
					orderBy: { sortOrder: "asc" },
				})) as unknown as FlashSaleProduct[];

				results.push({ ...sale, products });
			}

			return results;
		},

		async getActiveProductDeal(productId) {
			// Find all flash sale products for this product
			const saleProducts = (await data.findMany("flashSaleProduct", {
				where: { productId },
			})) as unknown as FlashSaleProduct[];

			if (saleProducts.length === 0) return null;

			// Check each for an active parent sale
			for (const sp of saleProducts) {
				const sale = await data.get("flashSale", sp.flashSaleId);
				if (!sale) continue;

				const flashSale = sale as unknown as FlashSale;
				if (!isCurrentlyActive(flashSale)) continue;

				// Check stock availability
				if (sp.stockLimit != null && sp.stockSold >= sp.stockLimit) continue;

				return {
					productId: sp.productId,
					salePrice: sp.salePrice,
					originalPrice: sp.originalPrice,
					discountPercent: calcDiscountPercent(sp.originalPrice, sp.salePrice),
					stockLimit: sp.stockLimit ?? null,
					stockSold: sp.stockSold,
					stockRemaining:
						sp.stockLimit != null ? sp.stockLimit - sp.stockSold : null,
					flashSaleId: flashSale.id,
					flashSaleName: flashSale.name,
					endsAt: flashSale.endsAt,
				};
			}

			return null;
		},

		async getActiveProductDeals(productIds) {
			const result: Record<string, ActiveFlashSaleProduct> = {};
			for (const productId of productIds) {
				const deal = await this.getActiveProductDeal(productId);
				if (deal) {
					result[productId] = deal;
				}
			}
			return result;
		},

		// ── Stats ────────────────────────────────────────────

		async getStats() {
			const allSales = (await data.findMany(
				"flashSale",
				{},
			)) as unknown as FlashSale[];
			const allProducts = (await data.findMany(
				"flashSaleProduct",
				{},
			)) as unknown as FlashSaleProduct[];

			const stats: FlashSaleStats = {
				totalSales: allSales.length,
				draftSales: allSales.filter((s) => s.status === "draft").length,
				scheduledSales: allSales.filter((s) => s.status === "scheduled").length,
				activeSales: allSales.filter((s) => s.status === "active").length,
				endedSales: allSales.filter((s) => s.status === "ended").length,
				totalProducts: allProducts.length,
				totalUnitsSold: allProducts.reduce((sum, p) => sum + p.stockSold, 0),
			};
			return stats;
		},
	};
}
