import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createBrandController } from "../service-impl";

describe("createBrandController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createBrandController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createBrandController(mockData);
	});

	async function createTestBrand(
		overrides: Partial<Parameters<typeof controller.createBrand>[0]> = {},
	) {
		return controller.createBrand({
			name: "Acme Corp",
			slug: "acme-corp",
			...overrides,
		});
	}

	// ── createBrand ──

	describe("createBrand", () => {
		it("creates a brand with required fields", async () => {
			const brand = await createTestBrand();
			expect(brand.id).toBeDefined();
			expect(brand.name).toBe("Acme Corp");
			expect(brand.slug).toBe("acme-corp");
			expect(brand.isActive).toBe(true);
			expect(brand.isFeatured).toBe(false);
			expect(brand.position).toBe(0);
			expect(brand.createdAt).toBeInstanceOf(Date);
			expect(brand.updatedAt).toBeInstanceOf(Date);
		});

		it("creates a brand with all optional fields", async () => {
			const brand = await createTestBrand({
				description: "Quality products since 1920",
				logo: "https://example.com/acme-logo.png",
				bannerImage: "https://example.com/acme-banner.jpg",
				website: "https://acme.com",
				isActive: false,
				isFeatured: true,
				position: 5,
				seoTitle: "Acme Corp - Premium Products",
				seoDescription: "Shop Acme Corp products",
			});
			expect(brand.description).toBe("Quality products since 1920");
			expect(brand.logo).toBe("https://example.com/acme-logo.png");
			expect(brand.bannerImage).toBe("https://example.com/acme-banner.jpg");
			expect(brand.website).toBe("https://acme.com");
			expect(brand.isActive).toBe(false);
			expect(brand.isFeatured).toBe(true);
			expect(brand.position).toBe(5);
			expect(brand.seoTitle).toBe("Acme Corp - Premium Products");
			expect(brand.seoDescription).toBe("Shop Acme Corp products");
		});

		it("generates unique IDs", async () => {
			const b1 = await createTestBrand({ slug: "brand-1" });
			const b2 = await createTestBrand({ slug: "brand-2" });
			expect(b1.id).not.toBe(b2.id);
		});

		it("defaults isActive to true", async () => {
			const brand = await createTestBrand();
			expect(brand.isActive).toBe(true);
		});

		it("defaults isFeatured to false", async () => {
			const brand = await createTestBrand();
			expect(brand.isFeatured).toBe(false);
		});

		it("defaults position to 0", async () => {
			const brand = await createTestBrand();
			expect(brand.position).toBe(0);
		});
	});

	// ── getBrand ──

	describe("getBrand", () => {
		it("returns a brand by ID", async () => {
			const created = await createTestBrand();
			const found = await controller.getBrand(created.id);
			expect(found?.name).toBe("Acme Corp");
		});

		it("returns null for non-existent ID", async () => {
			const found = await controller.getBrand("non-existent");
			expect(found).toBeNull();
		});
	});

	// ── getBrandBySlug ──

	describe("getBrandBySlug", () => {
		it("returns a brand by slug", async () => {
			await createTestBrand();
			const found = await controller.getBrandBySlug("acme-corp");
			expect(found?.name).toBe("Acme Corp");
		});

		it("returns null for non-existent slug", async () => {
			const found = await controller.getBrandBySlug("non-existent");
			expect(found).toBeNull();
		});
	});

	// ── updateBrand ──

	describe("updateBrand", () => {
		it("updates basic fields", async () => {
			const created = await createTestBrand();
			const updated = await controller.updateBrand(created.id, {
				name: "Acme Inc",
				slug: "acme-inc",
			});
			expect(updated?.name).toBe("Acme Inc");
			expect(updated?.slug).toBe("acme-inc");
		});

		it("clears optional fields with null", async () => {
			const created = await createTestBrand({
				description: "Some description",
				logo: "https://example.com/logo.png",
				website: "https://acme.com",
				seoTitle: "SEO title",
			});
			const updated = await controller.updateBrand(created.id, {
				description: null,
				logo: null,
				website: null,
				seoTitle: null,
			});
			expect(updated?.description).toBeUndefined();
			expect(updated?.logo).toBeUndefined();
			expect(updated?.website).toBeUndefined();
			expect(updated?.seoTitle).toBeUndefined();
		});

		it("clears bannerImage and seoDescription with null", async () => {
			const created = await createTestBrand({
				bannerImage: "https://example.com/banner.jpg",
				seoDescription: "Meta description",
			});
			const updated = await controller.updateBrand(created.id, {
				bannerImage: null,
				seoDescription: null,
			});
			expect(updated?.bannerImage).toBeUndefined();
			expect(updated?.seoDescription).toBeUndefined();
		});

		it("preserves fields not specified in update", async () => {
			const created = await createTestBrand({
				description: "Original",
				logo: "https://example.com/logo.png",
			});
			const updated = await controller.updateBrand(created.id, {
				name: "New Name",
			});
			expect(updated?.name).toBe("New Name");
			expect(updated?.description).toBe("Original");
			expect(updated?.logo).toBe("https://example.com/logo.png");
		});

		it("returns null for non-existent brand", async () => {
			const updated = await controller.updateBrand("non-existent", {
				name: "New",
			});
			expect(updated).toBeNull();
		});

		it("updates the updatedAt timestamp", async () => {
			const created = await createTestBrand();
			const updated = await controller.updateBrand(created.id, {
				name: "Updated",
			});
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				created.updatedAt.getTime(),
			);
		});

		it("updates isActive and isFeatured flags", async () => {
			const created = await createTestBrand({
				isActive: true,
				isFeatured: false,
			});
			const updated = await controller.updateBrand(created.id, {
				isActive: false,
				isFeatured: true,
			});
			expect(updated?.isActive).toBe(false);
			expect(updated?.isFeatured).toBe(true);
		});

		it("updates position", async () => {
			const created = await createTestBrand({ position: 0 });
			const updated = await controller.updateBrand(created.id, {
				position: 10,
			});
			expect(updated?.position).toBe(10);
		});
	});

	// ── deleteBrand ──

	describe("deleteBrand", () => {
		it("deletes an existing brand", async () => {
			const created = await createTestBrand();
			const deleted = await controller.deleteBrand(created.id);
			expect(deleted).toBe(true);
			const found = await controller.getBrand(created.id);
			expect(found).toBeNull();
		});

		it("returns false for non-existent brand", async () => {
			const deleted = await controller.deleteBrand("non-existent");
			expect(deleted).toBe(false);
		});

		it("removes associated products when deleting", async () => {
			const brand = await createTestBrand();
			await controller.assignProduct({
				brandId: brand.id,
				productId: "prod-1",
			});
			await controller.assignProduct({
				brandId: brand.id,
				productId: "prod-2",
			});

			await controller.deleteBrand(brand.id);

			const products = await controller.getBrandProducts({
				brandId: brand.id,
			});
			expect(products).toHaveLength(0);
		});
	});

	// ── listBrands ──

	describe("listBrands", () => {
		it("returns all brands", async () => {
			await createTestBrand({ slug: "brand-1" });
			await createTestBrand({ slug: "brand-2" });
			await createTestBrand({ slug: "brand-3" });

			const list = await controller.listBrands();
			expect(list).toHaveLength(3);
		});

		it("filters by isActive", async () => {
			await createTestBrand({ slug: "active", isActive: true });
			await createTestBrand({ slug: "inactive", isActive: false });

			const active = await controller.listBrands({ isActive: true });
			expect(active).toHaveLength(1);
			expect(active[0].slug).toBe("active");
		});

		it("filters by isFeatured", async () => {
			await createTestBrand({ slug: "featured", isFeatured: true });
			await createTestBrand({ slug: "normal", isFeatured: false });

			const featured = await controller.listBrands({ isFeatured: true });
			expect(featured).toHaveLength(1);
			expect(featured[0].slug).toBe("featured");
		});

		it("supports pagination with take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await createTestBrand({ slug: `brand-${i}` });
			}

			const page1 = await controller.listBrands({
				take: 2,
				skip: 0,
			});
			expect(page1).toHaveLength(2);

			const page2 = await controller.listBrands({
				take: 2,
				skip: 2,
			});
			expect(page2).toHaveLength(2);
		});

		it("returns empty array when no brands exist", async () => {
			const list = await controller.listBrands();
			expect(list).toHaveLength(0);
		});
	});

	// ── countBrands ──

	describe("countBrands", () => {
		it("counts all brands", async () => {
			await createTestBrand({ slug: "brand-1" });
			await createTestBrand({ slug: "brand-2" });
			const count = await controller.countBrands();
			expect(count).toBe(2);
		});

		it("counts filtered brands", async () => {
			await createTestBrand({ slug: "active", isActive: true });
			await createTestBrand({ slug: "inactive", isActive: false });
			const count = await controller.countBrands({ isActive: true });
			expect(count).toBe(1);
		});

		it("returns 0 when no brands exist", async () => {
			const count = await controller.countBrands();
			expect(count).toBe(0);
		});
	});

	// ── assignProduct ──

	describe("assignProduct", () => {
		it("assigns a product to a brand", async () => {
			const brand = await createTestBrand();
			const item = await controller.assignProduct({
				brandId: brand.id,
				productId: "prod-1",
			});
			expect(item.id).toBeDefined();
			expect(item.brandId).toBe(brand.id);
			expect(item.productId).toBe("prod-1");
			expect(item.assignedAt).toBeInstanceOf(Date);
		});

		it("returns existing if product already assigned to same brand", async () => {
			const brand = await createTestBrand();
			const first = await controller.assignProduct({
				brandId: brand.id,
				productId: "prod-1",
			});
			const second = await controller.assignProduct({
				brandId: brand.id,
				productId: "prod-1",
			});
			expect(first.id).toBe(second.id);
		});

		it("reassigns product from one brand to another", async () => {
			const brand1 = await createTestBrand({ slug: "brand-1" });
			const brand2 = await createTestBrand({ slug: "brand-2" });

			await controller.assignProduct({
				brandId: brand1.id,
				productId: "prod-1",
			});

			const reassigned = await controller.assignProduct({
				brandId: brand2.id,
				productId: "prod-1",
			});
			expect(reassigned.brandId).toBe(brand2.id);

			// Product should no longer be in brand1
			const brand1Products = await controller.getBrandProducts({
				brandId: brand1.id,
			});
			expect(brand1Products).toHaveLength(0);

			// Product should be in brand2
			const brand2Products = await controller.getBrandProducts({
				brandId: brand2.id,
			});
			expect(brand2Products).toHaveLength(1);
		});
	});

	// ── unassignProduct ──

	describe("unassignProduct", () => {
		it("unassigns a product from a brand", async () => {
			const brand = await createTestBrand();
			await controller.assignProduct({
				brandId: brand.id,
				productId: "prod-1",
			});
			const removed = await controller.unassignProduct({
				brandId: brand.id,
				productId: "prod-1",
			});
			expect(removed).toBe(true);

			const products = await controller.getBrandProducts({
				brandId: brand.id,
			});
			expect(products).toHaveLength(0);
		});

		it("returns false if product not assigned to brand", async () => {
			const brand = await createTestBrand();
			const removed = await controller.unassignProduct({
				brandId: brand.id,
				productId: "non-existent",
			});
			expect(removed).toBe(false);
		});
	});

	// ── getBrandProducts ──

	describe("getBrandProducts", () => {
		it("returns products for a brand", async () => {
			const brand = await createTestBrand();
			await controller.assignProduct({
				brandId: brand.id,
				productId: "prod-1",
			});
			await controller.assignProduct({
				brandId: brand.id,
				productId: "prod-2",
			});

			const products = await controller.getBrandProducts({
				brandId: brand.id,
			});
			expect(products).toHaveLength(2);
		});

		it("returns empty array for brand with no products", async () => {
			const brand = await createTestBrand();
			const products = await controller.getBrandProducts({
				brandId: brand.id,
			});
			expect(products).toHaveLength(0);
		});

		it("supports pagination", async () => {
			const brand = await createTestBrand();
			for (let i = 0; i < 5; i++) {
				await controller.assignProduct({
					brandId: brand.id,
					productId: `prod-${i}`,
				});
			}

			const page = await controller.getBrandProducts({
				brandId: brand.id,
				take: 2,
				skip: 0,
			});
			expect(page).toHaveLength(2);
		});
	});

	// ── countBrandProducts ──

	describe("countBrandProducts", () => {
		it("counts products in a brand", async () => {
			const brand = await createTestBrand();
			await controller.assignProduct({
				brandId: brand.id,
				productId: "prod-1",
			});
			await controller.assignProduct({
				brandId: brand.id,
				productId: "prod-2",
			});

			const count = await controller.countBrandProducts(brand.id);
			expect(count).toBe(2);
		});

		it("returns 0 for brand with no products", async () => {
			const brand = await createTestBrand();
			const count = await controller.countBrandProducts(brand.id);
			expect(count).toBe(0);
		});
	});

	// ── getBrandForProduct ──

	describe("getBrandForProduct", () => {
		it("returns the brand for a product", async () => {
			const brand = await createTestBrand();
			await controller.assignProduct({
				brandId: brand.id,
				productId: "prod-1",
			});

			const found = await controller.getBrandForProduct("prod-1");
			expect(found?.name).toBe("Acme Corp");
		});

		it("returns null for unassigned product", async () => {
			const found = await controller.getBrandForProduct("non-existent");
			expect(found).toBeNull();
		});

		it("returns null if brand is inactive", async () => {
			const brand = await createTestBrand({ isActive: false });
			await controller.assignProduct({
				brandId: brand.id,
				productId: "prod-1",
			});

			const found = await controller.getBrandForProduct("prod-1");
			expect(found).toBeNull();
		});

		it("returns brand when brand is active", async () => {
			const brand = await createTestBrand({ isActive: true });
			await controller.assignProduct({
				brandId: brand.id,
				productId: "prod-1",
			});

			const found = await controller.getBrandForProduct("prod-1");
			expect(found?.id).toBe(brand.id);
		});
	});

	// ── bulkAssignProducts ──

	describe("bulkAssignProducts", () => {
		it("assigns multiple products at once", async () => {
			const brand = await createTestBrand();
			const assigned = await controller.bulkAssignProducts({
				brandId: brand.id,
				productIds: ["prod-1", "prod-2", "prod-3"],
			});
			expect(assigned).toBe(3);

			const count = await controller.countBrandProducts(brand.id);
			expect(count).toBe(3);
		});

		it("skips already assigned products", async () => {
			const brand = await createTestBrand();
			await controller.assignProduct({
				brandId: brand.id,
				productId: "prod-1",
			});

			const assigned = await controller.bulkAssignProducts({
				brandId: brand.id,
				productIds: ["prod-1", "prod-2", "prod-3"],
			});
			expect(assigned).toBe(2);

			const count = await controller.countBrandProducts(brand.id);
			expect(count).toBe(3);
		});

		it("reassigns products from other brands", async () => {
			const brand1 = await createTestBrand({ slug: "brand-1" });
			const brand2 = await createTestBrand({ slug: "brand-2" });

			await controller.assignProduct({
				brandId: brand1.id,
				productId: "prod-1",
			});

			const assigned = await controller.bulkAssignProducts({
				brandId: brand2.id,
				productIds: ["prod-1", "prod-2"],
			});
			expect(assigned).toBe(2);

			const brand1Count = await controller.countBrandProducts(brand1.id);
			expect(brand1Count).toBe(0);

			const brand2Count = await controller.countBrandProducts(brand2.id);
			expect(brand2Count).toBe(2);
		});
	});

	// ── bulkUnassignProducts ──

	describe("bulkUnassignProducts", () => {
		it("unassigns multiple products at once", async () => {
			const brand = await createTestBrand();
			await controller.bulkAssignProducts({
				brandId: brand.id,
				productIds: ["prod-1", "prod-2", "prod-3"],
			});

			const removed = await controller.bulkUnassignProducts({
				brandId: brand.id,
				productIds: ["prod-1", "prod-3"],
			});
			expect(removed).toBe(2);

			const count = await controller.countBrandProducts(brand.id);
			expect(count).toBe(1);
		});

		it("returns 0 when no products match", async () => {
			const brand = await createTestBrand();
			const removed = await controller.bulkUnassignProducts({
				brandId: brand.id,
				productIds: ["non-existent"],
			});
			expect(removed).toBe(0);
		});
	});

	// ── getFeaturedBrands ──

	describe("getFeaturedBrands", () => {
		it("returns only featured and active brands", async () => {
			await createTestBrand({
				slug: "featured-active",
				isFeatured: true,
				isActive: true,
			});
			await createTestBrand({
				slug: "featured-inactive",
				isFeatured: true,
				isActive: false,
			});
			await createTestBrand({
				slug: "not-featured",
				isFeatured: false,
				isActive: true,
			});

			const featured = await controller.getFeaturedBrands();
			expect(featured).toHaveLength(1);
			expect(featured[0].slug).toBe("featured-active");
		});

		it("respects the limit parameter", async () => {
			for (let i = 0; i < 5; i++) {
				await createTestBrand({
					slug: `featured-${i}`,
					isFeatured: true,
				});
			}

			const limited = await controller.getFeaturedBrands(3);
			expect(limited).toHaveLength(3);
		});

		it("returns empty array when no featured brands", async () => {
			await createTestBrand({ isFeatured: false });
			const featured = await controller.getFeaturedBrands();
			expect(featured).toHaveLength(0);
		});
	});

	// ── Edge Cases ──

	describe("edge cases", () => {
		it("bulkAssignProducts with empty array", async () => {
			const brand = await createTestBrand();
			const assigned = await controller.bulkAssignProducts({
				brandId: brand.id,
				productIds: [],
			});
			expect(assigned).toBe(0);
		});

		it("bulkUnassignProducts with empty array", async () => {
			const brand = await createTestBrand();
			const removed = await controller.bulkUnassignProducts({
				brandId: brand.id,
				productIds: [],
			});
			expect(removed).toBe(0);
		});

		it("countBrands with isFeatured filter", async () => {
			await createTestBrand({ slug: "f1", isFeatured: true });
			await createTestBrand({ slug: "f2", isFeatured: true });
			await createTestBrand({ slug: "n1", isFeatured: false });
			const count = await controller.countBrands({ isFeatured: true });
			expect(count).toBe(2);
		});

		it("listBrands with both isActive and isFeatured", async () => {
			await createTestBrand({
				slug: "af",
				isActive: true,
				isFeatured: true,
			});
			await createTestBrand({
				slug: "an",
				isActive: true,
				isFeatured: false,
			});
			await createTestBrand({
				slug: "if",
				isActive: false,
				isFeatured: true,
			});
			const list = await controller.listBrands({
				isActive: true,
				isFeatured: true,
			});
			expect(list).toHaveLength(1);
			expect(list[0].slug).toBe("af");
		});

		it("getBrandForProduct returns null after unassign", async () => {
			const brand = await createTestBrand();
			await controller.assignProduct({
				brandId: brand.id,
				productId: "prod-1",
			});
			await controller.unassignProduct({
				brandId: brand.id,
				productId: "prod-1",
			});
			const found = await controller.getBrandForProduct("prod-1");
			expect(found).toBeNull();
		});

		it("multiple brands can exist with different slugs", async () => {
			await createTestBrand({ name: "Brand A", slug: "brand-a" });
			await createTestBrand({ name: "Brand B", slug: "brand-b" });
			await createTestBrand({ name: "Brand C", slug: "brand-c" });
			const list = await controller.listBrands();
			expect(list).toHaveLength(3);
		});

		it("updateBrand preserves createdAt", async () => {
			const brand = await createTestBrand();
			const original = brand.createdAt;
			const updated = await controller.updateBrand(brand.id, {
				name: "Updated",
			});
			expect(updated?.createdAt.getTime()).toBe(original.getTime());
		});

		it("deleteBrand returns false after already deleted", async () => {
			const brand = await createTestBrand();
			await controller.deleteBrand(brand.id);
			const secondDelete = await controller.deleteBrand(brand.id);
			expect(secondDelete).toBe(false);
		});
	});

	// ── Integration ──

	describe("integration", () => {
		it("full brand lifecycle: create → assign products → update → delete", async () => {
			const brand = await createTestBrand({
				name: "Test Brand",
				slug: "test-brand",
				description: "A test brand",
			});

			// Assign products
			await controller.bulkAssignProducts({
				brandId: brand.id,
				productIds: ["p1", "p2", "p3"],
			});
			expect(await controller.countBrandProducts(brand.id)).toBe(3);

			// Update the brand
			await controller.updateBrand(brand.id, {
				name: "Updated Brand",
				isFeatured: true,
			});

			// Verify featured
			const featured = await controller.getFeaturedBrands();
			expect(featured).toHaveLength(1);
			expect(featured[0].name).toBe("Updated Brand");

			// Delete
			await controller.deleteBrand(brand.id);
			expect(await controller.getBrand(brand.id)).toBeNull();
			expect(await controller.countBrandProducts(brand.id)).toBe(0);
		});

		it("product reassignment across brands", async () => {
			const brandA = await createTestBrand({ slug: "a" });
			const brandB = await createTestBrand({ slug: "b" });

			await controller.assignProduct({
				brandId: brandA.id,
				productId: "shared-prod",
			});

			// Verify in brand A
			expect(await controller.getBrandForProduct("shared-prod")).not.toBeNull();
			expect((await controller.getBrandForProduct("shared-prod"))?.id).toBe(
				brandA.id,
			);

			// Reassign to brand B
			await controller.assignProduct({
				brandId: brandB.id,
				productId: "shared-prod",
			});

			// Now in brand B, not A
			expect((await controller.getBrandForProduct("shared-prod"))?.id).toBe(
				brandB.id,
			);
			expect(await controller.countBrandProducts(brandA.id)).toBe(0);
			expect(await controller.countBrandProducts(brandB.id)).toBe(1);
		});

		it("stats reflect all operations", async () => {
			const b1 = await createTestBrand({
				slug: "active",
				isActive: true,
				isFeatured: true,
			});
			await createTestBrand({
				slug: "inactive",
				isActive: false,
			});

			await controller.bulkAssignProducts({
				brandId: b1.id,
				productIds: ["p1", "p2"],
			});

			const stats = await controller.getStats();
			expect(stats.totalBrands).toBe(2);
			expect(stats.activeBrands).toBe(1);
			expect(stats.featuredBrands).toBe(1);
			expect(stats.totalProducts).toBe(2);
		});
	});

	// ── getStats ──

	describe("getStats", () => {
		it("returns correct statistics", async () => {
			await createTestBrand({
				slug: "active-featured",
				isActive: true,
				isFeatured: true,
			});
			await createTestBrand({
				slug: "active-normal",
				isActive: true,
				isFeatured: false,
			});
			await createTestBrand({
				slug: "inactive",
				isActive: false,
				isFeatured: false,
			});

			const stats = await controller.getStats();
			expect(stats.totalBrands).toBe(3);
			expect(stats.activeBrands).toBe(2);
			expect(stats.featuredBrands).toBe(1);
		});

		it("counts unique products across brands", async () => {
			const brand1 = await createTestBrand({ slug: "brand-1" });
			const brand2 = await createTestBrand({ slug: "brand-2" });

			await controller.assignProduct({
				brandId: brand1.id,
				productId: "prod-1",
			});
			await controller.assignProduct({
				brandId: brand2.id,
				productId: "prod-2",
			});

			const stats = await controller.getStats();
			expect(stats.totalProducts).toBe(2);
		});

		it("returns zeros when no data", async () => {
			const stats = await controller.getStats();
			expect(stats.totalBrands).toBe(0);
			expect(stats.activeBrands).toBe(0);
			expect(stats.featuredBrands).toBe(0);
			expect(stats.totalProducts).toBe(0);
		});
	});
});
