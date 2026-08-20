import type { ScopedEventEmitter } from "@86d-app/core/events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	Brand,
	BrandController,
	BrandProduct,
	BrandStats,
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

export function createBrandController(
	data: ModuleDataService,
	events?: ScopedEventEmitter | undefined,
): BrandController {
	return {
		async createBrand(params) {
			const id = crypto.randomUUID();
			const now = new Date();
			const brand: Brand = {
				id,
				name: params.name,
				slug: params.slug,
				isActive: params.isActive ?? true,
				isFeatured: params.isFeatured ?? false,
				position: params.position ?? 0,
				createdAt: now,
				updatedAt: now,
				...(params.description != null && {
					description: params.description,
				}),
				...(params.logo != null && { logo: params.logo }),
				...(params.bannerImage != null && {
					bannerImage: params.bannerImage,
				}),
				...(params.website != null && { website: params.website }),
				...(params.seoTitle != null && { seoTitle: params.seoTitle }),
				...(params.seoDescription != null && {
					seoDescription: params.seoDescription,
				}),
			};
			await data.upsert("brand", id, brand as Record<string, unknown>);
			void events?.emit("brand.created", {
				brandId: brand.id,
				name: brand.name,
				slug: brand.slug,
			});
			return brand;
		},

		async getBrand(id) {
			const raw = await data.get("brand", id);
			return (raw as unknown as Brand) ?? null;
		},

		async getBrandBySlug(slug) {
			const results = (await data.findMany("brand", {
				where: { slug },
			})) as unknown as Brand[];
			return results[0] ?? null;
		},

		async updateBrand(id, params) {
			const existing = await data.get("brand", id);
			if (!existing) return null;

			const current = existing as unknown as Brand;

			const base: Brand = {
				id: current.id,
				name: params.name ?? current.name,
				slug: params.slug ?? current.slug,
				isActive: params.isActive ?? current.isActive,
				isFeatured: params.isFeatured ?? current.isFeatured,
				position: params.position ?? current.position,
				createdAt: current.createdAt,
				updatedAt: new Date(),
			};

			const optionalFields: Partial<Brand> = {};

			const descVal =
				params.description === null
					? null
					: (params.description ?? current.description);
			if (descVal != null) optionalFields.description = descVal;

			const logoVal =
				params.logo === null ? null : (params.logo ?? current.logo);
			if (logoVal != null) optionalFields.logo = logoVal;

			const bannerVal =
				params.bannerImage === null
					? null
					: (params.bannerImage ?? current.bannerImage);
			if (bannerVal != null) optionalFields.bannerImage = bannerVal;

			const webVal =
				params.website === null ? null : (params.website ?? current.website);
			if (webVal != null) optionalFields.website = webVal;

			const seoTitleVal =
				params.seoTitle === null ? null : (params.seoTitle ?? current.seoTitle);
			if (seoTitleVal != null) optionalFields.seoTitle = seoTitleVal;

			const seoDescVal =
				params.seoDescription === null
					? null
					: (params.seoDescription ?? current.seoDescription);
			if (seoDescVal != null) optionalFields.seoDescription = seoDescVal;

			const updated: Brand = { ...base, ...optionalFields };

			await data.upsert("brand", id, updated as Record<string, unknown>);
			void events?.emit("brand.updated", {
				brandId: updated.id,
				name: updated.name,
				slug: updated.slug,
			});
			return updated;
		},

		async deleteBrand(id) {
			const existing = await data.get("brand", id);
			if (!existing) return false;

			const products = (await data.findMany("brandProduct", {
				where: { brandId: id },
			})) as unknown as BrandProduct[];

			for (const product of products) {
				await data.delete("brandProduct", product.id);
			}

			await data.delete("brand", id);
			void events?.emit("brand.deleted", { brandId: id });
			return true;
		},

		async listBrands(params) {
			const where: Record<string, unknown> = {};
			if (params?.isActive !== undefined) where.isActive = params.isActive;
			if (params?.isFeatured !== undefined)
				where.isFeatured = params.isFeatured;

			const results = (await data.findMany(
				"brand",
				buildFindOptions({
					where,
					orderBy: { position: "asc" },
					take: params?.take,
					skip: params?.skip,
				}),
			)) as unknown as Brand[];

			return results;
		},

		async countBrands(params) {
			const where: Record<string, unknown> = {};
			if (params?.isActive !== undefined) where.isActive = params.isActive;
			if (params?.isFeatured !== undefined)
				where.isFeatured = params.isFeatured;

			const results = (await data.findMany("brand", {
				where,
			})) as unknown as Brand[];
			return results.length;
		},

		async assignProduct(params) {
			// A product can only belong to one brand — remove from any other brand first
			const existingForProduct = (await data.findMany("brandProduct", {
				where: { productId: params.productId },
			})) as unknown as BrandProduct[];

			for (const existing of existingForProduct) {
				if (existing.brandId === params.brandId) {
					return existing;
				}
				await data.delete("brandProduct", existing.id);
			}

			const id = crypto.randomUUID();
			const brandProduct: BrandProduct = {
				id,
				brandId: params.brandId,
				productId: params.productId,
				assignedAt: new Date(),
			};

			await data.upsert(
				"brandProduct",
				id,
				brandProduct as Record<string, unknown>,
			);
			void events?.emit("brand.product.assigned", {
				brandId: params.brandId,
				productId: params.productId,
			});
			return brandProduct;
		},

		async unassignProduct(params) {
			const existing = (await data.findMany("brandProduct", {
				where: {
					brandId: params.brandId,
					productId: params.productId,
				},
			})) as unknown as BrandProduct[];

			if (existing.length === 0) return false;

			for (const item of existing) {
				await data.delete("brandProduct", item.id);
			}
			void events?.emit("brand.product.unassigned", {
				brandId: params.brandId,
				productId: params.productId,
			});
			return true;
		},

		async getBrandProducts(params) {
			const results = (await data.findMany(
				"brandProduct",
				buildFindOptions({
					where: { brandId: params.brandId },
					orderBy: { assignedAt: "desc" },
					take: params.take,
					skip: params.skip,
				}),
			)) as unknown as BrandProduct[];
			return results;
		},

		async countBrandProducts(brandId) {
			const results = (await data.findMany("brandProduct", {
				where: { brandId },
			})) as unknown as BrandProduct[];
			return results.length;
		},

		async getBrandForProduct(productId) {
			const links = (await data.findMany("brandProduct", {
				where: { productId },
			})) as unknown as BrandProduct[];

			if (links.length === 0) return null;

			const brand = await data.get("brand", links[0].brandId);
			if (!brand) return null;

			const typed = brand as unknown as Brand;
			return typed.isActive ? typed : null;
		},

		async bulkAssignProducts(params) {
			let assigned = 0;

			for (const productId of params.productIds) {
				// Remove product from any other brand
				const existingForProduct = (await data.findMany("brandProduct", {
					where: { productId },
				})) as unknown as BrandProduct[];

				const alreadyAssigned = existingForProduct.some(
					(p) => p.brandId === params.brandId,
				);
				if (alreadyAssigned) continue;

				for (const existing of existingForProduct) {
					await data.delete("brandProduct", existing.id);
				}

				const id = crypto.randomUUID();
				const item: BrandProduct = {
					id,
					brandId: params.brandId,
					productId,
					assignedAt: new Date(),
				};
				await data.upsert("brandProduct", id, item as Record<string, unknown>);
				assigned++;
			}
			return assigned;
		},

		async bulkUnassignProducts(params) {
			let removed = 0;
			for (const productId of params.productIds) {
				const existing = (await data.findMany("brandProduct", {
					where: {
						brandId: params.brandId,
						productId,
					},
				})) as unknown as BrandProduct[];

				for (const item of existing) {
					await data.delete("brandProduct", item.id);
					removed++;
				}
			}
			return removed;
		},

		async getFeaturedBrands(limit) {
			const results = (await data.findMany(
				"brand",
				buildFindOptions({
					where: { isFeatured: true, isActive: true },
					orderBy: { position: "asc" },
					take: limit,
				}),
			)) as unknown as Brand[];
			return results;
		},

		async getStats() {
			const all = (await data.findMany("brand", {})) as unknown as Brand[];
			const allProducts = (await data.findMany(
				"brandProduct",
				{},
			)) as unknown as BrandProduct[];

			const stats: BrandStats = {
				totalBrands: all.length,
				activeBrands: all.filter((b) => b.isActive).length,
				featuredBrands: all.filter((b) => b.isFeatured).length,
				totalProducts: new Set(allProducts.map((p) => p.productId)).size,
			};
			return stats;
		},
	};
}
