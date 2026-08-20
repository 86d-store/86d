import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createBrandController } from "../service-impl";

/**
 * Security regression tests for brands endpoints.
 *
 * Brands are public-read on storefront (no auth for browsing).
 * Security focuses on:
 * - Only active brands are visible on storefront (getBrandForProduct)
 * - Inactive brands are hidden from store-facing queries
 * - Product assignment is exclusive (one brand per product)
 * - Cascade deletion removes all brand-product associations
 * - Featured brands filter respects isActive
 * - Slug uniqueness and lookup correctness
 * - Pagination boundary enforcement
 * - Update operations preserve data integrity
 * - Bulk operations handle edge cases safely
 */

describe("brands endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createBrandController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createBrandController(mockData);
	});

	function makeBrand(
		overrides: Partial<Parameters<typeof controller.createBrand>[0]> = {},
	) {
		return controller.createBrand({
			name: "Test Brand",
			slug: `brand-${crypto.randomUUID().slice(0, 8)}`,
			...overrides,
		});
	}

	describe("storefront visibility rules", () => {
		it("inactive brands are hidden from getBrandForProduct", async () => {
			const brand = await makeBrand({
				name: "Hidden Brand",
				slug: "hidden-brand",
				isActive: false,
			});
			await controller.assignProduct({
				brandId: brand.id,
				productId: "prod_1",
			});

			const result = await controller.getBrandForProduct("prod_1");
			expect(result).toBeNull();
		});

		it("active brands are visible from getBrandForProduct", async () => {
			const brand = await makeBrand({
				name: "Visible Brand",
				slug: "visible-brand",
				isActive: true,
			});
			await controller.assignProduct({
				brandId: brand.id,
				productId: "prod_1",
			});

			const result = await controller.getBrandForProduct("prod_1");
			expect(result).not.toBeNull();
			expect(result?.name).toBe("Visible Brand");
		});

		it("deactivating a brand hides it from product lookups", async () => {
			const brand = await makeBrand({
				slug: "brand",
				isActive: true,
			});
			await controller.assignProduct({
				brandId: brand.id,
				productId: "prod_1",
			});

			await controller.updateBrand(brand.id, { isActive: false });

			const result = await controller.getBrandForProduct("prod_1");
			expect(result).toBeNull();
		});

		it("featured brands filter respects isActive", async () => {
			await makeBrand({
				slug: "active-featured",
				isFeatured: true,
				isActive: true,
			});
			await makeBrand({
				slug: "inactive-featured",
				isFeatured: true,
				isActive: false,
			});

			const featured = await controller.getFeaturedBrands();
			expect(featured).toHaveLength(1);
			expect(featured[0].slug).toBe("active-featured");
		});

		it("listBrands with isActive=true excludes inactive brands", async () => {
			await makeBrand({ slug: "active-1", isActive: true });
			await makeBrand({ slug: "active-2", isActive: true });
			await makeBrand({ slug: "inactive-1", isActive: false });

			const active = await controller.listBrands({ isActive: true });
			expect(active).toHaveLength(2);
			for (const b of active) {
				expect(b.isActive).toBe(true);
			}
		});

		it("reactivating a brand makes it visible again", async () => {
			const brand = await makeBrand({
				slug: "toggle",
				isActive: false,
			});
			await controller.assignProduct({
				brandId: brand.id,
				productId: "prod_toggle",
			});

			expect(await controller.getBrandForProduct("prod_toggle")).toBeNull();

			await controller.updateBrand(brand.id, { isActive: true });

			const result = await controller.getBrandForProduct("prod_toggle");
			expect(result).not.toBeNull();
			expect(result?.id).toBe(brand.id);
		});

		it("getBrandBySlug returns inactive brands (admin use)", async () => {
			const brand = await makeBrand({
				slug: "admin-only",
				isActive: false,
			});

			const result = await controller.getBrandBySlug("admin-only");
			expect(result).not.toBeNull();
			expect(result?.id).toBe(brand.id);
		});
	});

	describe("product assignment exclusivity", () => {
		it("assigning a product to a new brand removes it from the old brand", async () => {
			const brand1 = await makeBrand({ slug: "brand-a" });
			const brand2 = await makeBrand({ slug: "brand-b" });

			await controller.assignProduct({
				brandId: brand1.id,
				productId: "prod_1",
			});
			await controller.assignProduct({
				brandId: brand2.id,
				productId: "prod_1",
			});

			const brand1Products = await controller.getBrandProducts({
				brandId: brand1.id,
			});
			const brand2Products = await controller.getBrandProducts({
				brandId: brand2.id,
			});

			expect(brand1Products).toHaveLength(0);
			expect(brand2Products).toHaveLength(1);
		});

		it("re-assigning same product to same brand is idempotent", async () => {
			const brand = await makeBrand({ slug: "brand" });

			const first = await controller.assignProduct({
				brandId: brand.id,
				productId: "prod_1",
			});
			const second = await controller.assignProduct({
				brandId: brand.id,
				productId: "prod_1",
			});

			expect(first.id).toBe(second.id);
			const products = await controller.getBrandProducts({
				brandId: brand.id,
			});
			expect(products).toHaveLength(1);
		});

		it("rapid reassignment across 3 brands leaves product with last brand only", async () => {
			const brands = await Promise.all([
				makeBrand({ slug: "rapid-a" }),
				makeBrand({ slug: "rapid-b" }),
				makeBrand({ slug: "rapid-c" }),
			]);

			for (const brand of brands) {
				await controller.assignProduct({
					brandId: brand.id,
					productId: "prod_rapid",
				});
			}

			for (let i = 0; i < brands.length - 1; i++) {
				expect(await controller.countBrandProducts(brands[i].id)).toBe(0);
			}
			expect(await controller.countBrandProducts(brands[2].id)).toBe(1);
		});

		it("multiple products can be assigned to the same brand", async () => {
			const brand = await makeBrand({ slug: "multi-prod" });
			for (let i = 0; i < 10; i++) {
				await controller.assignProduct({
					brandId: brand.id,
					productId: `prod_${i}`,
				});
			}
			expect(await controller.countBrandProducts(brand.id)).toBe(10);
		});
	});

	describe("cascade deletion", () => {
		it("deleting a brand removes all its product associations", async () => {
			const brand = await makeBrand({ slug: "doomed-brand" });
			await controller.assignProduct({
				brandId: brand.id,
				productId: "prod_1",
			});
			await controller.assignProduct({
				brandId: brand.id,
				productId: "prod_2",
			});

			await controller.deleteBrand(brand.id);

			const prod1Brand = await controller.getBrandForProduct("prod_1");
			const prod2Brand = await controller.getBrandForProduct("prod_2");
			expect(prod1Brand).toBeNull();
			expect(prod2Brand).toBeNull();
		});

		it("deleting a brand does not affect other brands' products", async () => {
			const brand1 = await makeBrand({ slug: "brand-1" });
			const brand2 = await makeBrand({ slug: "brand-2" });
			await controller.assignProduct({
				brandId: brand1.id,
				productId: "prod_1",
			});
			await controller.assignProduct({
				brandId: brand2.id,
				productId: "prod_2",
			});

			await controller.deleteBrand(brand1.id);

			const brand2Products = await controller.getBrandProducts({
				brandId: brand2.id,
			});
			expect(brand2Products).toHaveLength(1);
		});

		it("deleting a non-existent brand returns false", async () => {
			const result = await controller.deleteBrand("nonexistent");
			expect(result).toBe(false);
		});

		it("double delete returns false on second call", async () => {
			const brand = await makeBrand({ slug: "double-delete" });
			expect(await controller.deleteBrand(brand.id)).toBe(true);
			expect(await controller.deleteBrand(brand.id)).toBe(false);
		});

		it("getBrand returns null after deletion", async () => {
			const brand = await makeBrand({ slug: "will-delete" });
			expect(await controller.getBrand(brand.id)).not.toBeNull();
			await controller.deleteBrand(brand.id);
			expect(await controller.getBrand(brand.id)).toBeNull();
		});

		it("getBrandBySlug returns null after deletion", async () => {
			await makeBrand({ slug: "gone-slug" });
			expect(await controller.getBrandBySlug("gone-slug")).not.toBeNull();
			const brand = await controller.getBrandBySlug("gone-slug");
			await controller.deleteBrand(brand?.id ?? "");
			expect(await controller.getBrandBySlug("gone-slug")).toBeNull();
		});
	});

	describe("bulk assignment safety", () => {
		it("bulkAssignProducts moves products from other brands", async () => {
			const brand1 = await makeBrand({ slug: "old-brand" });
			const brand2 = await makeBrand({ slug: "new-brand" });

			await controller.assignProduct({
				brandId: brand1.id,
				productId: "prod_1",
			});

			const assigned = await controller.bulkAssignProducts({
				brandId: brand2.id,
				productIds: ["prod_1", "prod_2"],
			});
			expect(assigned).toBe(2);

			const brand1Count = await controller.countBrandProducts(brand1.id);
			expect(brand1Count).toBe(0);
		});

		it("bulkAssignProducts skips already-assigned products", async () => {
			const brand = await makeBrand({ slug: "brand" });
			await controller.assignProduct({
				brandId: brand.id,
				productId: "prod_1",
			});

			const assigned = await controller.bulkAssignProducts({
				brandId: brand.id,
				productIds: ["prod_1", "prod_2"],
			});
			expect(assigned).toBe(1);
		});

		it("bulkAssignProducts with empty array assigns nothing", async () => {
			const brand = await makeBrand({ slug: "empty-bulk" });
			const assigned = await controller.bulkAssignProducts({
				brandId: brand.id,
				productIds: [],
			});
			expect(assigned).toBe(0);
			expect(await controller.countBrandProducts(brand.id)).toBe(0);
		});

		it("bulkUnassignProducts returns 0 for empty array", async () => {
			const brand = await makeBrand({ slug: "empty-unassign" });
			await controller.assignProduct({
				brandId: brand.id,
				productId: "prod_1",
			});
			const removed = await controller.bulkUnassignProducts({
				brandId: brand.id,
				productIds: [],
			});
			expect(removed).toBe(0);
			expect(await controller.countBrandProducts(brand.id)).toBe(1);
		});

		it("bulkUnassignProducts only removes from the target brand", async () => {
			const brandA = await makeBrand({ slug: "bulk-a" });
			const brandB = await makeBrand({ slug: "bulk-b" });

			await controller.assignProduct({
				brandId: brandA.id,
				productId: "p1",
			});
			await controller.assignProduct({
				brandId: brandB.id,
				productId: "p2",
			});

			const removed = await controller.bulkUnassignProducts({
				brandId: brandA.id,
				productIds: ["p1", "p2"],
			});
			expect(removed).toBe(1);
			expect(await controller.countBrandProducts(brandB.id)).toBe(1);
		});
	});

	describe("unassign safety", () => {
		it("unassigning a non-existent product returns false", async () => {
			const brand = await makeBrand({ slug: "brand" });
			const result = await controller.unassignProduct({
				brandId: brand.id,
				productId: "nonexistent",
			});
			expect(result).toBe(false);
		});

		it("unassigning from a non-existent brand returns false", async () => {
			const result = await controller.unassignProduct({
				brandId: "no-such-brand",
				productId: "prod_1",
			});
			expect(result).toBe(false);
		});

		it("double unassign returns false on second call", async () => {
			const brand = await makeBrand({ slug: "double-unassign" });
			await controller.assignProduct({
				brandId: brand.id,
				productId: "prod_once",
			});
			expect(
				await controller.unassignProduct({
					brandId: brand.id,
					productId: "prod_once",
				}),
			).toBe(true);
			expect(
				await controller.unassignProduct({
					brandId: brand.id,
					productId: "prod_once",
				}),
			).toBe(false);
		});
	});

	describe("slug lookup correctness", () => {
		it("getBrandBySlug returns correct brand among many", async () => {
			await makeBrand({ name: "Alpha", slug: "alpha" });
			await makeBrand({ name: "Beta", slug: "beta" });
			await makeBrand({ name: "Gamma", slug: "gamma" });

			const result = await controller.getBrandBySlug("beta");
			expect(result?.name).toBe("Beta");
		});

		it("getBrandBySlug returns null for non-existent slug", async () => {
			await makeBrand({ slug: "exists" });
			const result = await controller.getBrandBySlug("does-not-exist");
			expect(result).toBeNull();
		});

		it("slug update makes old slug unreachable", async () => {
			const brand = await makeBrand({ slug: "old-slug" });
			await controller.updateBrand(brand.id, { slug: "new-slug" });

			expect(await controller.getBrandBySlug("old-slug")).toBeNull();
			expect((await controller.getBrandBySlug("new-slug"))?.id).toBe(brand.id);
		});
	});

	describe("pagination and listing safety", () => {
		it("listBrands respects take parameter", async () => {
			for (let i = 0; i < 10; i++) {
				await makeBrand({ slug: `page-${i}`, isActive: true });
			}

			const page = await controller.listBrands({
				isActive: true,
				take: 3,
			});
			expect(page).toHaveLength(3);
		});

		it("listBrands respects skip parameter", async () => {
			for (let i = 0; i < 5; i++) {
				await makeBrand({
					slug: `skip-${i}`,
					isActive: true,
					position: i,
				});
			}

			const all = await controller.listBrands({ isActive: true });
			const skipped = await controller.listBrands({
				isActive: true,
				skip: 2,
			});
			expect(skipped).toHaveLength(all.length - 2);
		});

		it("listBrands with take=0 returns no results", async () => {
			await makeBrand({ slug: "take-zero", isActive: true });
			const results = await controller.listBrands({
				isActive: true,
				take: 0,
			});
			expect(results).toHaveLength(0);
		});

		it("listBrands skip beyond total returns empty", async () => {
			await makeBrand({ slug: "only-one", isActive: true });
			const results = await controller.listBrands({
				isActive: true,
				skip: 100,
			});
			expect(results).toHaveLength(0);
		});

		it("listBrands combines filters correctly", async () => {
			await makeBrand({
				slug: "af",
				isActive: true,
				isFeatured: true,
			});
			await makeBrand({
				slug: "anf",
				isActive: true,
				isFeatured: false,
			});
			await makeBrand({
				slug: "if",
				isActive: false,
				isFeatured: true,
			});

			const activeFeatured = await controller.listBrands({
				isActive: true,
				isFeatured: true,
			});
			expect(activeFeatured).toHaveLength(1);
			expect(activeFeatured[0].slug).toBe("af");
		});

		it("getBrandProducts respects pagination", async () => {
			const brand = await makeBrand({ slug: "paginated" });
			for (let i = 0; i < 8; i++) {
				await controller.assignProduct({
					brandId: brand.id,
					productId: `pag-prod-${i}`,
				});
			}

			const page1 = await controller.getBrandProducts({
				brandId: brand.id,
				take: 3,
				skip: 0,
			});
			const page2 = await controller.getBrandProducts({
				brandId: brand.id,
				take: 3,
				skip: 3,
			});
			expect(page1).toHaveLength(3);
			expect(page2).toHaveLength(3);
			const ids1 = page1.map((p) => p.productId);
			const ids2 = page2.map((p) => p.productId);
			expect(ids1.some((id) => ids2.includes(id))).toBe(false);
		});
	});

	describe("update data integrity", () => {
		it("update preserves unmodified fields", async () => {
			const brand = await makeBrand({
				name: "Original",
				slug: "original",
				description: "A description",
				logo: "logo.png",
				website: "https://example.com",
				isActive: true,
				isFeatured: true,
				position: 5,
			});

			const updated = await controller.updateBrand(brand.id, {
				name: "Renamed",
			});

			expect(updated?.name).toBe("Renamed");
			expect(updated?.slug).toBe("original");
			expect(updated?.description).toBe("A description");
			expect(updated?.logo).toBe("logo.png");
			expect(updated?.website).toBe("https://example.com");
			expect(updated?.isActive).toBe(true);
			expect(updated?.isFeatured).toBe(true);
			expect(updated?.position).toBe(5);
		});

		it("update can clear optional fields with null", async () => {
			const brand = await makeBrand({
				slug: "clearable",
				description: "Will be cleared",
				logo: "logo.png",
				website: "https://example.com",
				seoTitle: "SEO Title",
				seoDescription: "SEO Desc",
			});

			const updated = await controller.updateBrand(brand.id, {
				description: null,
				logo: null,
				website: null,
				seoTitle: null,
				seoDescription: null,
			});

			expect(updated?.description).toBeUndefined();
			expect(updated?.logo).toBeUndefined();
			expect(updated?.website).toBeUndefined();
			expect(updated?.seoTitle).toBeUndefined();
			expect(updated?.seoDescription).toBeUndefined();
		});

		it("update a non-existent brand returns null", async () => {
			const result = await controller.updateBrand("nonexistent", {
				name: "New Name",
			});
			expect(result).toBeNull();
		});

		it("updatedAt timestamp changes on update", async () => {
			const brand = await makeBrand({ slug: "timestamp-test" });
			const originalUpdatedAt = brand.updatedAt;

			const updated = await controller.updateBrand(brand.id, {
				name: "Updated Name",
			});

			expect(updated?.updatedAt).not.toBeNull();
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				originalUpdatedAt.getTime(),
			);
		});

		it("createdAt is never modified by update", async () => {
			const brand = await makeBrand({ slug: "immutable-created" });
			const originalCreatedAt = brand.createdAt;

			await controller.updateBrand(brand.id, {
				name: "Changed",
				slug: "changed-slug",
				isActive: false,
			});

			const fetched = await controller.getBrand(brand.id);
			expect(fetched?.createdAt.getTime()).toBe(originalCreatedAt.getTime());
		});

		it("SEO fields are stored and retrieved correctly", async () => {
			const brand = await makeBrand({
				slug: "seo-test",
				seoTitle: "Buy Our Products",
				seoDescription: "Best products in the world",
			});

			const fetched = await controller.getBrand(brand.id);
			expect(fetched?.seoTitle).toBe("Buy Our Products");
			expect(fetched?.seoDescription).toBe("Best products in the world");
		});
	});

	describe("count accuracy", () => {
		it("countBrands with no filters returns total", async () => {
			await makeBrand({ slug: "c1", isActive: true });
			await makeBrand({ slug: "c2", isActive: false });
			await makeBrand({ slug: "c3", isActive: true });

			expect(await controller.countBrands()).toBe(3);
		});

		it("countBrands with isActive filter", async () => {
			await makeBrand({ slug: "ca1", isActive: true });
			await makeBrand({ slug: "ca2", isActive: true });
			await makeBrand({ slug: "ci1", isActive: false });

			expect(await controller.countBrands({ isActive: true })).toBe(2);
			expect(await controller.countBrands({ isActive: false })).toBe(1);
		});

		it("countBrands with isFeatured filter", async () => {
			await makeBrand({ slug: "cf1", isFeatured: true });
			await makeBrand({ slug: "cf2", isFeatured: false });

			expect(await controller.countBrands({ isFeatured: true })).toBe(1);
			expect(await controller.countBrands({ isFeatured: false })).toBe(1);
		});

		it("countBrandProducts returns 0 for brand with no products", async () => {
			const brand = await makeBrand({ slug: "empty" });
			expect(await controller.countBrandProducts(brand.id)).toBe(0);
		});

		it("countBrandProducts returns 0 for non-existent brand", async () => {
			expect(await controller.countBrandProducts("does-not-exist")).toBe(0);
		});
	});

	describe("stats correctness", () => {
		it("getStats on empty data", async () => {
			const stats = await controller.getStats();
			expect(stats.totalBrands).toBe(0);
			expect(stats.activeBrands).toBe(0);
			expect(stats.featuredBrands).toBe(0);
			expect(stats.totalProducts).toBe(0);
		});

		it("getStats correctly counts active and featured", async () => {
			await makeBrand({
				slug: "s1",
				isActive: true,
				isFeatured: true,
			});
			await makeBrand({
				slug: "s2",
				isActive: true,
				isFeatured: false,
			});
			await makeBrand({
				slug: "s3",
				isActive: false,
				isFeatured: true,
			});

			const stats = await controller.getStats();
			expect(stats.totalBrands).toBe(3);
			expect(stats.activeBrands).toBe(2);
			expect(stats.featuredBrands).toBe(2);
		});

		it("getStats totalProducts counts unique products only", async () => {
			const brandA = await makeBrand({ slug: "stats-a" });
			const brandB = await makeBrand({ slug: "stats-b" });

			await controller.assignProduct({
				brandId: brandA.id,
				productId: "shared-prod",
			});
			await controller.assignProduct({
				brandId: brandB.id,
				productId: "shared-prod",
			});
			await controller.assignProduct({
				brandId: brandB.id,
				productId: "unique-prod",
			});

			const stats = await controller.getStats();
			expect(stats.totalProducts).toBe(2);
		});
	});

	describe("featured brands limits", () => {
		it("getFeaturedBrands respects limit parameter", async () => {
			for (let i = 0; i < 10; i++) {
				await makeBrand({
					slug: `feat-lim-${i}`,
					isFeatured: true,
					isActive: true,
					position: i,
				});
			}

			const limited = await controller.getFeaturedBrands(3);
			expect(limited).toHaveLength(3);
		});

		it("getFeaturedBrands without limit returns all", async () => {
			for (let i = 0; i < 5; i++) {
				await makeBrand({
					slug: `feat-all-${i}`,
					isFeatured: true,
					isActive: true,
				});
			}

			const all = await controller.getFeaturedBrands();
			expect(all).toHaveLength(5);
		});

		it("getFeaturedBrands excludes non-featured active brands", async () => {
			await makeBrand({
				slug: "not-featured",
				isFeatured: false,
				isActive: true,
			});
			await makeBrand({
				slug: "yes-featured",
				isFeatured: true,
				isActive: true,
			});

			const featured = await controller.getFeaturedBrands();
			expect(featured).toHaveLength(1);
			expect(featured[0].slug).toBe("yes-featured");
		});
	});

	describe("brand creation defaults", () => {
		it("isActive defaults to true", async () => {
			const brand = await controller.createBrand({
				name: "Default Active",
				slug: "default-active",
			});
			expect(brand.isActive).toBe(true);
		});

		it("isFeatured defaults to false", async () => {
			const brand = await controller.createBrand({
				name: "Default Featured",
				slug: "default-featured",
			});
			expect(brand.isFeatured).toBe(false);
		});

		it("position defaults to 0", async () => {
			const brand = await controller.createBrand({
				name: "Default Pos",
				slug: "default-pos",
			});
			expect(brand.position).toBe(0);
		});

		it("optional fields are undefined when not provided", async () => {
			const brand = await controller.createBrand({
				name: "Minimal",
				slug: "minimal",
			});
			expect(brand.description).toBeUndefined();
			expect(brand.logo).toBeUndefined();
			expect(brand.bannerImage).toBeUndefined();
			expect(brand.website).toBeUndefined();
			expect(brand.seoTitle).toBeUndefined();
			expect(brand.seoDescription).toBeUndefined();
		});

		it("all optional fields are set when provided", async () => {
			const brand = await controller.createBrand({
				name: "Full",
				slug: "full",
				description: "Desc",
				logo: "logo.png",
				bannerImage: "banner.jpg",
				website: "https://example.com",
				seoTitle: "Title",
				seoDescription: "Desc SEO",
			});
			expect(brand.description).toBe("Desc");
			expect(brand.logo).toBe("logo.png");
			expect(brand.bannerImage).toBe("banner.jpg");
			expect(brand.website).toBe("https://example.com");
			expect(brand.seoTitle).toBe("Title");
			expect(brand.seoDescription).toBe("Desc SEO");
		});

		it("each brand gets a unique id", async () => {
			const ids = new Set<string>();
			for (let i = 0; i < 20; i++) {
				const brand = await makeBrand({ slug: `unique-id-${i}` });
				ids.add(brand.id);
			}
			expect(ids.size).toBe(20);
		});
	});
});
