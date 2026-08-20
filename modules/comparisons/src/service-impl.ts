import type { ModuleDataService } from "@86d-app/core/types/module";
import type { ComparisonController, ComparisonItem } from "./service";

const DEFAULT_MAX_PRODUCTS = 4;

export function createComparisonController(
	data: ModuleDataService,
): ComparisonController {
	return {
		async addProduct(params) {
			const max = params.maxProducts ?? DEFAULT_MAX_PRODUCTS;

			// Build owner filter
			const ownerWhere: Record<string, unknown> = {};
			if (params.customerId) ownerWhere.customerId = params.customerId;
			else if (params.sessionId) ownerWhere.sessionId = params.sessionId;

			if (Object.keys(ownerWhere).length === 0) {
				throw new Error("Either customerId or sessionId is required");
			}

			// Check for duplicate product in this comparison
			const existing = (await data.findMany("comparisonItem", {
				where: { ...ownerWhere, productId: params.productId },
			})) as unknown as ComparisonItem[];

			if (existing.length > 0) {
				// Update the snapshot data
				const updated: ComparisonItem = {
					...existing[0],
					productName: params.productName,
					productSlug: params.productSlug,
					productImage: params.productImage,
					productPrice: params.productPrice,
					productCategory: params.productCategory,
					attributes: params.attributes,
					addedAt: new Date(),
				};
				await data.upsert(
					"comparisonItem",
					existing[0].id,
					updated as Record<string, unknown>,
				);
				return updated;
			}

			// Check max products limit
			const current = (await data.findMany("comparisonItem", {
				where: ownerWhere,
			})) as unknown as ComparisonItem[];

			if (current.length >= max) {
				throw new Error(
					`Comparison limit reached. Maximum ${max} products allowed.`,
				);
			}

			const id = crypto.randomUUID();
			const item: ComparisonItem = {
				id,
				customerId: params.customerId,
				sessionId: params.sessionId,
				productId: params.productId,
				productName: params.productName,
				productSlug: params.productSlug,
				productImage: params.productImage,
				productPrice: params.productPrice,
				productCategory: params.productCategory,
				attributes: params.attributes,
				addedAt: new Date(),
			};
			await data.upsert("comparisonItem", id, item as Record<string, unknown>);
			return item;
		},

		async removeProduct(params) {
			const where: Record<string, unknown> = {
				productId: params.productId,
			};
			if (params.customerId) where.customerId = params.customerId;
			else if (params.sessionId) where.sessionId = params.sessionId;

			if (!params.customerId && !params.sessionId) return false;

			const items = (await data.findMany("comparisonItem", {
				where,
			})) as unknown as ComparisonItem[];

			if (items.length === 0) return false;

			for (const item of items) {
				await data.delete("comparisonItem", item.id);
			}
			return true;
		},

		async getComparison(params) {
			const where: Record<string, unknown> = {};
			if (params.customerId) where.customerId = params.customerId;
			else if (params.sessionId) where.sessionId = params.sessionId;

			if (Object.keys(where).length === 0) return [];

			const items = (await data.findMany("comparisonItem", {
				where,
			})) as unknown as ComparisonItem[];

			// Sort by addedAt ascending (oldest first — stable comparison order)
			return items.sort(
				(a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime(),
			);
		},

		async clearComparison(params) {
			const where: Record<string, unknown> = {};
			if (params.customerId) where.customerId = params.customerId;
			else if (params.sessionId) where.sessionId = params.sessionId;

			if (Object.keys(where).length === 0) return 0;

			const items = (await data.findMany("comparisonItem", {
				where,
			})) as unknown as ComparisonItem[];

			for (const item of items) {
				await data.delete("comparisonItem", item.id);
			}
			return items.length;
		},

		async mergeComparison(params) {
			const max = params.maxProducts ?? DEFAULT_MAX_PRODUCTS;

			const sessionItems = (await data.findMany("comparisonItem", {
				where: { sessionId: params.sessionId },
			})) as unknown as ComparisonItem[];

			// Get current customer items count
			const customerItems = (await data.findMany("comparisonItem", {
				where: { customerId: params.customerId },
			})) as unknown as ComparisonItem[];

			let merged = 0;
			for (const item of sessionItems) {
				// Check if customer already has this product
				const duplicate = customerItems.find(
					(c) => c.productId === item.productId,
				);

				if (duplicate) {
					// Customer already has it — delete the session item
					await data.delete("comparisonItem", item.id);
				} else if (customerItems.length + merged < max) {
					// Transfer to customer
					const updated: ComparisonItem = {
						...item,
						customerId: params.customerId,
						sessionId: undefined,
					};
					await data.upsert(
						"comparisonItem",
						item.id,
						updated as Record<string, unknown>,
					);
					merged += 1;
				} else {
					// Over limit — delete the session item
					await data.delete("comparisonItem", item.id);
				}
			}
			return merged;
		},

		async deleteItem(id) {
			const existing = await data.get("comparisonItem", id);
			if (!existing) return false;
			await data.delete("comparisonItem", id);
			return true;
		},

		async listAll(params) {
			const where: Record<string, unknown> = {};
			if (params?.customerId) where.customerId = params.customerId;
			if (params?.productId) where.productId = params.productId;

			const items = (await data.findMany("comparisonItem", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			})) as unknown as ComparisonItem[];

			return items.sort(
				(a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(),
			);
		},

		async countItems(params) {
			const where: Record<string, unknown> = {};
			if (params?.customerId) where.customerId = params.customerId;
			if (params?.productId) where.productId = params.productId;

			const items = (await data.findMany("comparisonItem", {
				...(Object.keys(where).length > 0 ? { where } : {}),
			})) as unknown as ComparisonItem[];

			return items.length;
		},

		async getFrequentlyCompared(params) {
			const all = (await data.findMany(
				"comparisonItem",
				{},
			)) as unknown as ComparisonItem[];

			const productCounts = new Map<
				string,
				{
					productId: string;
					productName: string;
					productSlug: string;
					productImage?: string | undefined;
					compareCount: number;
				}
			>();

			for (const item of all) {
				const entry = productCounts.get(item.productId);
				if (entry) {
					entry.compareCount += 1;
				} else {
					productCounts.set(item.productId, {
						productId: item.productId,
						productName: item.productName,
						productSlug: item.productSlug,
						productImage: item.productImage,
						compareCount: 1,
					});
				}
			}

			const take = params?.take ?? 10;
			return Array.from(productCounts.values())
				.sort((a, b) => b.compareCount - a.compareCount)
				.slice(0, take);
		},
	};
}
