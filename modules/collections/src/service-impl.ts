import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	Collection,
	CollectionController,
	CollectionProduct,
	CollectionSortOrder,
	CollectionStats,
	CollectionType,
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

export function createCollectionController(
	data: ModuleDataService,
): CollectionController {
	return {
		async createCollection(params) {
			const id = crypto.randomUUID();
			const now = new Date();
			const collection: Collection = {
				id,
				title: params.title,
				slug: params.slug,
				type: params.type,
				sortOrder: params.sortOrder ?? "manual",
				isActive: params.isActive ?? true,
				isFeatured: params.isFeatured ?? false,
				position: params.position ?? 0,
				createdAt: now,
				updatedAt: now,
				...(params.description != null && {
					description: params.description,
				}),
				...(params.image != null && { image: params.image }),
				...(params.conditions != null && {
					conditions: params.conditions,
				}),
				...(params.seoTitle != null && { seoTitle: params.seoTitle }),
				...(params.seoDescription != null && {
					seoDescription: params.seoDescription,
				}),
				...(params.publishedAt != null && {
					publishedAt: params.publishedAt,
				}),
			};
			await data.upsert(
				"collection",
				id,
				collection as Record<string, unknown>,
			);
			return collection;
		},

		async getCollection(id) {
			const raw = await data.get("collection", id);
			return (raw as unknown as Collection) ?? null;
		},

		async getCollectionBySlug(slug) {
			const results = (await data.findMany("collection", {
				where: { slug },
			})) as unknown as Collection[];
			return results[0] ?? null;
		},

		async updateCollection(id, params) {
			const existing = await data.get("collection", id);
			if (!existing) return null;

			const current = existing as unknown as Collection;

			// Build base with required fields
			const base: Collection = {
				id: current.id,
				title: params.title ?? current.title,
				slug: params.slug ?? current.slug,
				type: (params.type ?? current.type) as CollectionType,
				sortOrder: (params.sortOrder ??
					current.sortOrder) as CollectionSortOrder,
				isActive: params.isActive ?? current.isActive,
				isFeatured: params.isFeatured ?? current.isFeatured,
				position: params.position ?? current.position,
				createdAt: current.createdAt,
				updatedAt: new Date(),
			};

			// Handle nullable optional fields: null clears, undefined keeps current
			const optionalFields: Partial<Collection> = {};

			const descVal =
				params.description === null
					? null
					: (params.description ?? current.description);
			if (descVal != null) optionalFields.description = descVal;

			const imgVal =
				params.image === null ? null : (params.image ?? current.image);
			if (imgVal != null) optionalFields.image = imgVal;

			const condVal =
				params.conditions === null
					? null
					: (params.conditions ?? current.conditions);
			if (condVal != null) optionalFields.conditions = condVal;

			const seoTitleVal =
				params.seoTitle === null ? null : (params.seoTitle ?? current.seoTitle);
			if (seoTitleVal != null) optionalFields.seoTitle = seoTitleVal;

			const seoDescVal =
				params.seoDescription === null
					? null
					: (params.seoDescription ?? current.seoDescription);
			if (seoDescVal != null) optionalFields.seoDescription = seoDescVal;

			const pubVal =
				params.publishedAt === null
					? null
					: (params.publishedAt ?? current.publishedAt);
			if (pubVal != null) optionalFields.publishedAt = pubVal;

			const updated: Collection = { ...base, ...optionalFields };

			await data.upsert("collection", id, updated as Record<string, unknown>);
			return updated;
		},

		async deleteCollection(id) {
			const existing = await data.get("collection", id);
			if (!existing) return false;

			const products = (await data.findMany("collectionProduct", {
				where: { collectionId: id },
			})) as unknown as CollectionProduct[];

			for (const product of products) {
				await data.delete("collectionProduct", product.id);
			}

			await data.delete("collection", id);
			return true;
		},

		async listCollections(params) {
			const where: Record<string, unknown> = {};
			if (params?.isActive !== undefined) where.isActive = params.isActive;
			if (params?.isFeatured !== undefined)
				where.isFeatured = params.isFeatured;
			if (params?.type) where.type = params.type;

			const results = (await data.findMany(
				"collection",
				buildFindOptions({
					where,
					orderBy: { position: "asc" },
					take: params?.take,
					skip: params?.skip,
				}),
			)) as unknown as Collection[];

			return results;
		},

		async countCollections(params) {
			const where: Record<string, unknown> = {};
			if (params?.isActive !== undefined) where.isActive = params.isActive;
			if (params?.isFeatured !== undefined)
				where.isFeatured = params.isFeatured;
			if (params?.type) where.type = params.type;

			const results = (await data.findMany("collection", {
				where,
			})) as unknown as Collection[];
			return results.length;
		},

		async addProduct(params) {
			const existing = (await data.findMany("collectionProduct", {
				where: {
					collectionId: params.collectionId,
					productId: params.productId,
				},
			})) as unknown as CollectionProduct[];

			if (existing.length > 0) {
				return existing[0];
			}

			let position = params.position ?? 0;
			if (position === 0) {
				const products = (await data.findMany("collectionProduct", {
					where: { collectionId: params.collectionId },
				})) as unknown as CollectionProduct[];
				position = products.length + 1;
			}

			const id = crypto.randomUUID();
			const collectionProduct: CollectionProduct = {
				id,
				collectionId: params.collectionId,
				productId: params.productId,
				position,
				addedAt: new Date(),
			};

			await data.upsert(
				"collectionProduct",
				id,
				collectionProduct as Record<string, unknown>,
			);
			return collectionProduct;
		},

		async removeProduct(params) {
			const existing = (await data.findMany("collectionProduct", {
				where: {
					collectionId: params.collectionId,
					productId: params.productId,
				},
			})) as unknown as CollectionProduct[];

			if (existing.length === 0) return false;

			for (const item of existing) {
				await data.delete("collectionProduct", item.id);
			}
			return true;
		},

		async getCollectionProducts(params) {
			const results = (await data.findMany(
				"collectionProduct",
				buildFindOptions({
					where: { collectionId: params.collectionId },
					orderBy: { position: "asc" },
					take: params.take,
					skip: params.skip,
				}),
			)) as unknown as CollectionProduct[];
			return results;
		},

		async countCollectionProducts(collectionId) {
			const results = (await data.findMany("collectionProduct", {
				where: { collectionId },
			})) as unknown as CollectionProduct[];
			return results.length;
		},

		async reorderProducts(params) {
			for (let i = 0; i < params.productIds.length; i++) {
				const productId = params.productIds[i];
				const existing = (await data.findMany("collectionProduct", {
					where: {
						collectionId: params.collectionId,
						productId,
					},
				})) as unknown as CollectionProduct[];

				if (existing.length > 0) {
					const item = existing[0];
					await data.upsert("collectionProduct", item.id, {
						...item,
						position: i + 1,
					} as Record<string, unknown>);
				}
			}
		},

		async bulkAddProducts(params) {
			let added = 0;
			const existing = (await data.findMany("collectionProduct", {
				where: { collectionId: params.collectionId },
			})) as unknown as CollectionProduct[];

			let nextPosition = existing.length + 1;

			for (const productId of params.productIds) {
				const alreadyExists = existing.some((p) => p.productId === productId);
				if (alreadyExists) continue;

				const id = crypto.randomUUID();
				const item: CollectionProduct = {
					id,
					collectionId: params.collectionId,
					productId,
					position: nextPosition,
					addedAt: new Date(),
				};
				await data.upsert(
					"collectionProduct",
					id,
					item as Record<string, unknown>,
				);
				nextPosition++;
				added++;
			}
			return added;
		},

		async bulkRemoveProducts(params) {
			let removed = 0;
			for (const productId of params.productIds) {
				const existing = (await data.findMany("collectionProduct", {
					where: {
						collectionId: params.collectionId,
						productId,
					},
				})) as unknown as CollectionProduct[];

				for (const item of existing) {
					await data.delete("collectionProduct", item.id);
					removed++;
				}
			}
			return removed;
		},

		async getFeaturedCollections(limit) {
			const results = (await data.findMany(
				"collection",
				buildFindOptions({
					where: { isFeatured: true, isActive: true },
					orderBy: { position: "asc" },
					take: limit,
				}),
			)) as unknown as Collection[];
			return results;
		},

		async getCollectionsForProduct(productId) {
			const links = (await data.findMany("collectionProduct", {
				where: { productId },
			})) as unknown as CollectionProduct[];

			const collections: Collection[] = [];
			for (const link of links) {
				const collection = await data.get("collection", link.collectionId);
				if (collection) {
					const typed = collection as unknown as Collection;
					if (typed.isActive) {
						collections.push(typed);
					}
				}
			}
			return collections;
		},

		async getStats() {
			const all = (await data.findMany(
				"collection",
				{},
			)) as unknown as Collection[];
			const allProducts = (await data.findMany(
				"collectionProduct",
				{},
			)) as unknown as CollectionProduct[];

			const stats: CollectionStats = {
				totalCollections: all.length,
				activeCollections: all.filter((c) => c.isActive).length,
				featuredCollections: all.filter((c) => c.isFeatured).length,
				manualCollections: all.filter((c) => c.type === "manual").length,
				automaticCollections: all.filter((c) => c.type === "automatic").length,
				totalProducts: new Set(allProducts.map((p) => p.productId)).size,
			};
			return stats;
		},
	};
}
