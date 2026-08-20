import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createBrandController } from "../service-impl";

describe("brand controllers — edge cases", () => {
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

	// ── bulkAssignProducts — duplicate productIds ────────────────────

	describe("bulkAssignProducts — duplicates", () => {
		it("handles duplicate productIds in the same call", async () => {
			const brand = await createTestBrand();
			const assigned = await controller.bulkAssignProducts({
				brandId: brand.id,
				productIds: ["prod-1", "prod-1", "prod-1"],
			});
			// First iteration creates the link; subsequent iterations see it
			// already assigned to the same brand and skip
			expect(assigned).toBe(1);
			expect(await controller.countBrandProducts(brand.id)).toBe(1);
		});

		it("handles duplicates mixed with unique productIds", async () => {
			const brand = await createTestBrand();
			const assigned = await controller.bulkAssignProducts({
				brandId: brand.id,
				productIds: ["prod-1", "prod-2", "prod-1", "prod-3", "prod-2"],
			});
			expect(assigned).toBe(3);
			expect(await controller.countBrandProducts(brand.id)).toBe(3);
		});
	});

	// ── Product-brand relationship integrity ─────────────────────────

	describe("product-brand relationship integrity", () => {
		it("reassigning a product removes it from the original brand's count", async () => {
			const brandA = await createTestBrand({ slug: "brand-a" });
			const brandB = await createTestBrand({ slug: "brand-b" });

			await controller.assignProduct({
				brandId: brandA.id,
				productId: "prod-1",
			});
			expect(await controller.countBrandProducts(brandA.id)).toBe(1);

			await controller.assignProduct({
				brandId: brandB.id,
				productId: "prod-1",
			});
			expect(await controller.countBrandProducts(brandA.id)).toBe(0);
			expect(await controller.countBrandProducts(brandB.id)).toBe(1);
		});

		it("getBrandForProduct reflects the latest reassignment", async () => {
			const brandA = await createTestBrand({ slug: "brand-a" });
			const brandB = await createTestBrand({ slug: "brand-b" });
			const brandC = await createTestBrand({ slug: "brand-c" });

			await controller.assignProduct({
				brandId: brandA.id,
				productId: "prod-x",
			});
			expect((await controller.getBrandForProduct("prod-x"))?.id).toBe(
				brandA.id,
			);

			await controller.assignProduct({
				brandId: brandB.id,
				productId: "prod-x",
			});
			expect((await controller.getBrandForProduct("prod-x"))?.id).toBe(
				brandB.id,
			);

			await controller.assignProduct({
				brandId: brandC.id,
				productId: "prod-x",
			});
			expect((await controller.getBrandForProduct("prod-x"))?.id).toBe(
				brandC.id,
			);
		});

		it("bulkAssign moves products from multiple brands to one", async () => {
			const brandA = await createTestBrand({ slug: "brand-a" });
			const brandB = await createTestBrand({ slug: "brand-b" });
			const target = await createTestBrand({ slug: "target" });

			await controller.assignProduct({
				brandId: brandA.id,
				productId: "prod-1",
			});
			await controller.assignProduct({
				brandId: brandB.id,
				productId: "prod-2",
			});

			await controller.bulkAssignProducts({
				brandId: target.id,
				productIds: ["prod-1", "prod-2", "prod-3"],
			});

			expect(await controller.countBrandProducts(brandA.id)).toBe(0);
			expect(await controller.countBrandProducts(brandB.id)).toBe(0);
			expect(await controller.countBrandProducts(target.id)).toBe(3);
		});
	});

	// ── Featured brands ordering ─────────────────────────────────────

	describe("featured brands — same position", () => {
		it("returns all featured brands even with identical positions", async () => {
			await createTestBrand({
				slug: "feat-a",
				isFeatured: true,
				position: 1,
			});
			await createTestBrand({
				slug: "feat-b",
				isFeatured: true,
				position: 1,
			});
			await createTestBrand({
				slug: "feat-c",
				isFeatured: true,
				position: 1,
			});

			const featured = await controller.getFeaturedBrands();
			expect(featured).toHaveLength(3);
		});

		it("limit still applies when all have the same position", async () => {
			for (let i = 0; i < 5; i++) {
				await createTestBrand({
					slug: `same-pos-${i}`,
					isFeatured: true,
					position: 0,
				});
			}

			const limited = await controller.getFeaturedBrands(2);
			expect(limited).toHaveLength(2);
		});

		it("toggling isFeatured off excludes brand from featured list", async () => {
			const brand = await createTestBrand({
				slug: "will-unfeatured",
				isFeatured: true,
			});

			let featured = await controller.getFeaturedBrands();
			expect(featured).toHaveLength(1);

			await controller.updateBrand(brand.id, { isFeatured: false });

			featured = await controller.getFeaturedBrands();
			expect(featured).toHaveLength(0);
		});

		it("deactivating a featured brand excludes it from featured list", async () => {
			const brand = await createTestBrand({
				slug: "will-deactivate",
				isFeatured: true,
				isActive: true,
			});

			let featured = await controller.getFeaturedBrands();
			expect(featured).toHaveLength(1);

			await controller.updateBrand(brand.id, { isActive: false });

			featured = await controller.getFeaturedBrands();
			expect(featured).toHaveLength(0);
		});
	});

	// ── Delete brand with products ───────────────────────────────────

	describe("deleteBrand — product cleanup", () => {
		it("deleted brand products are not returned by getBrandForProduct", async () => {
			const brand = await createTestBrand();
			await controller.assignProduct({
				brandId: brand.id,
				productId: "prod-1",
			});

			expect(await controller.getBrandForProduct("prod-1")).not.toBeNull();

			await controller.deleteBrand(brand.id);

			expect(await controller.getBrandForProduct("prod-1")).toBeNull();
		});

		it("deleting a brand does not affect products in other brands", async () => {
			const brandA = await createTestBrand({ slug: "brand-a" });
			const brandB = await createTestBrand({ slug: "brand-b" });

			await controller.assignProduct({
				brandId: brandA.id,
				productId: "prod-a",
			});
			await controller.assignProduct({
				brandId: brandB.id,
				productId: "prod-b",
			});

			await controller.deleteBrand(brandA.id);

			expect(await controller.countBrandProducts(brandB.id)).toBe(1);
			expect((await controller.getBrandForProduct("prod-b"))?.id).toBe(
				brandB.id,
			);
		});

		it("deleting a brand with many products cleans up all of them", async () => {
			const brand = await createTestBrand();
			const productIds = Array.from({ length: 20 }, (_, i) => `prod-${i}`);
			await controller.bulkAssignProducts({
				brandId: brand.id,
				productIds,
			});
			expect(await controller.countBrandProducts(brand.id)).toBe(20);

			await controller.deleteBrand(brand.id);

			expect(await controller.countBrandProducts(brand.id)).toBe(0);
			for (const pid of productIds) {
				expect(await controller.getBrandForProduct(pid)).toBeNull();
			}
		});
	});

	// ── Count accuracy after bulk operations ─────────────────────────

	describe("countBrandProducts — accuracy after bulk ops", () => {
		it("count is accurate after bulk assign then partial bulk unassign", async () => {
			const brand = await createTestBrand();
			await controller.bulkAssignProducts({
				brandId: brand.id,
				productIds: ["p1", "p2", "p3", "p4", "p5"],
			});
			expect(await controller.countBrandProducts(brand.id)).toBe(5);

			await controller.bulkUnassignProducts({
				brandId: brand.id,
				productIds: ["p2", "p4"],
			});
			expect(await controller.countBrandProducts(brand.id)).toBe(3);
		});

		it("count is accurate after interleaved assign and unassign", async () => {
			const brand = await createTestBrand();

			await controller.assignProduct({
				brandId: brand.id,
				productId: "p1",
			});
			expect(await controller.countBrandProducts(brand.id)).toBe(1);

			await controller.assignProduct({
				brandId: brand.id,
				productId: "p2",
			});
			expect(await controller.countBrandProducts(brand.id)).toBe(2);

			await controller.unassignProduct({
				brandId: brand.id,
				productId: "p1",
			});
			expect(await controller.countBrandProducts(brand.id)).toBe(1);

			await controller.bulkAssignProducts({
				brandId: brand.id,
				productIds: ["p3", "p4"],
			});
			expect(await controller.countBrandProducts(brand.id)).toBe(3);

			await controller.bulkUnassignProducts({
				brandId: brand.id,
				productIds: ["p2", "p3", "p4"],
			});
			expect(await controller.countBrandProducts(brand.id)).toBe(0);
		});

		it("count is 0 for a non-existent brand", async () => {
			expect(await controller.countBrandProducts("no-such-brand")).toBe(0);
		});
	});

	// ── getBrandForProduct — no brand assigned ────────────────────────

	describe("getBrandForProduct — unassigned products", () => {
		it("returns null for a product that was never assigned", async () => {
			await createTestBrand();
			const result = await controller.getBrandForProduct("never-assigned");
			expect(result).toBeNull();
		});

		it("returns null after product is unassigned from its only brand", async () => {
			const brand = await createTestBrand();
			await controller.assignProduct({
				brandId: brand.id,
				productId: "temp-prod",
			});
			await controller.unassignProduct({
				brandId: brand.id,
				productId: "temp-prod",
			});
			expect(await controller.getBrandForProduct("temp-prod")).toBeNull();
		});

		it("returns null when the brand was deleted after assignment", async () => {
			const brand = await createTestBrand();
			await controller.assignProduct({
				brandId: brand.id,
				productId: "orphan-prod",
			});
			await controller.deleteBrand(brand.id);
			expect(await controller.getBrandForProduct("orphan-prod")).toBeNull();
		});

		it("returns null for inactive brand even after reassignment", async () => {
			const active = await createTestBrand({
				slug: "active",
				isActive: true,
			});
			const inactive = await createTestBrand({
				slug: "inactive",
				isActive: false,
			});

			await controller.assignProduct({
				brandId: active.id,
				productId: "prod-1",
			});
			expect(await controller.getBrandForProduct("prod-1")).not.toBeNull();

			// Move product to inactive brand
			await controller.assignProduct({
				brandId: inactive.id,
				productId: "prod-1",
			});
			expect(await controller.getBrandForProduct("prod-1")).toBeNull();
		});
	});

	// ── bulkUnassignProducts — non-existent products ─────────────────

	describe("bulkUnassignProducts — mixed valid and invalid", () => {
		it("returns count of only actually removed products", async () => {
			const brand = await createTestBrand();
			await controller.bulkAssignProducts({
				brandId: brand.id,
				productIds: ["real-1", "real-2", "real-3"],
			});

			const removed = await controller.bulkUnassignProducts({
				brandId: brand.id,
				productIds: ["real-1", "ghost-1", "real-3", "ghost-2"],
			});
			expect(removed).toBe(2);
			expect(await controller.countBrandProducts(brand.id)).toBe(1);
		});

		it("returns 0 when all productIds are non-existent", async () => {
			const brand = await createTestBrand();
			await controller.assignProduct({
				brandId: brand.id,
				productId: "existing",
			});

			const removed = await controller.bulkUnassignProducts({
				brandId: brand.id,
				productIds: ["ghost-a", "ghost-b", "ghost-c"],
			});
			expect(removed).toBe(0);
			expect(await controller.countBrandProducts(brand.id)).toBe(1);
		});

		it("does not affect other brands when unassigning", async () => {
			const brandA = await createTestBrand({ slug: "brand-a" });
			const brandB = await createTestBrand({ slug: "brand-b" });

			await controller.bulkAssignProducts({
				brandId: brandA.id,
				productIds: ["p1", "p2"],
			});
			await controller.bulkAssignProducts({
				brandId: brandB.id,
				productIds: ["p3", "p4"],
			});

			await controller.bulkUnassignProducts({
				brandId: brandA.id,
				productIds: ["p1", "p2", "p3", "p4"],
			});

			// Only brandA's products should be removed; p3/p4 belong to brandB
			expect(await controller.countBrandProducts(brandA.id)).toBe(0);
			expect(await controller.countBrandProducts(brandB.id)).toBe(2);
		});
	});

	// ── Stats after complex operations ───────────────────────────────

	describe("getStats — complex scenarios", () => {
		it("stats reflect product reassignments (unique count)", async () => {
			const brandA = await createTestBrand({ slug: "brand-a" });
			const brandB = await createTestBrand({ slug: "brand-b" });

			await controller.assignProduct({
				brandId: brandA.id,
				productId: "prod-1",
			});
			await controller.assignProduct({
				brandId: brandA.id,
				productId: "prod-2",
			});

			// Reassign prod-1 to brandB
			await controller.assignProduct({
				brandId: brandB.id,
				productId: "prod-1",
			});

			const stats = await controller.getStats();
			// Still 2 unique products total, just spread across brands
			expect(stats.totalProducts).toBe(2);
			expect(stats.totalBrands).toBe(2);
		});

		it("stats after creating, deleting, and recreating brands", async () => {
			const b1 = await createTestBrand({
				slug: "b1",
				isActive: true,
				isFeatured: true,
			});
			await controller.bulkAssignProducts({
				brandId: b1.id,
				productIds: ["p1", "p2"],
			});

			await createTestBrand({
				slug: "b2",
				isActive: false,
				isFeatured: false,
			});

			let stats = await controller.getStats();
			expect(stats.totalBrands).toBe(2);
			expect(stats.activeBrands).toBe(1);
			expect(stats.featuredBrands).toBe(1);
			expect(stats.totalProducts).toBe(2);

			// Delete the active brand
			await controller.deleteBrand(b1.id);

			stats = await controller.getStats();
			expect(stats.totalBrands).toBe(1);
			expect(stats.activeBrands).toBe(0);
			expect(stats.featuredBrands).toBe(0);
			expect(stats.totalProducts).toBe(0);

			// Create a new active brand
			const b3 = await createTestBrand({
				slug: "b3",
				isActive: true,
				isFeatured: true,
			});
			await controller.assignProduct({
				brandId: b3.id,
				productId: "p3",
			});

			stats = await controller.getStats();
			expect(stats.totalBrands).toBe(2);
			expect(stats.activeBrands).toBe(1);
			expect(stats.featuredBrands).toBe(1);
			expect(stats.totalProducts).toBe(1);
		});

		it("stats totalProducts counts unique products not links", async () => {
			const brand = await createTestBrand();
			// Assign then unassign then reassign the same product
			await controller.assignProduct({
				brandId: brand.id,
				productId: "only-prod",
			});
			await controller.unassignProduct({
				brandId: brand.id,
				productId: "only-prod",
			});
			await controller.assignProduct({
				brandId: brand.id,
				productId: "only-prod",
			});

			const stats = await controller.getStats();
			expect(stats.totalProducts).toBe(1);
		});

		it("stats with all brands inactive and featured", async () => {
			await createTestBrand({
				slug: "if-1",
				isActive: false,
				isFeatured: true,
			});
			await createTestBrand({
				slug: "if-2",
				isActive: false,
				isFeatured: true,
			});

			const stats = await controller.getStats();
			expect(stats.totalBrands).toBe(2);
			expect(stats.activeBrands).toBe(0);
			expect(stats.featuredBrands).toBe(2);
		});
	});

	// ── Cross-method interaction edge cases ──────────────────────────

	describe("cross-method interactions", () => {
		it("updating brand slug does not break product assignments", async () => {
			const brand = await createTestBrand({ slug: "old-slug" });
			await controller.assignProduct({
				brandId: brand.id,
				productId: "prod-1",
			});

			await controller.updateBrand(brand.id, { slug: "new-slug" });

			const found = await controller.getBrandForProduct("prod-1");
			expect(found?.slug).toBe("new-slug");
			expect(await controller.countBrandProducts(brand.id)).toBe(1);
		});

		it("getBrandBySlug returns null after slug is changed", async () => {
			const brand = await createTestBrand({ slug: "original-slug" });
			await controller.updateBrand(brand.id, { slug: "changed-slug" });

			const byOld = await controller.getBrandBySlug("original-slug");
			const byNew = await controller.getBrandBySlug("changed-slug");
			expect(byOld).toBeNull();
			expect(byNew?.id).toBe(brand.id);
		});

		it("countBrands reflects deletions", async () => {
			const b1 = await createTestBrand({ slug: "b1", isActive: true });
			await createTestBrand({ slug: "b2", isActive: true });
			await createTestBrand({ slug: "b3", isActive: false });

			expect(await controller.countBrands()).toBe(3);
			expect(await controller.countBrands({ isActive: true })).toBe(2);

			await controller.deleteBrand(b1.id);

			expect(await controller.countBrands()).toBe(2);
			expect(await controller.countBrands({ isActive: true })).toBe(1);
		});

		it("empty string optional fields are preserved", async () => {
			const brand = await createTestBrand({
				description: "",
				logo: "",
				website: "",
			});
			// Empty strings pass the != null check, so they should be set
			expect(brand.description).toBe("");
			expect(brand.logo).toBe("");
			expect(brand.website).toBe("");
		});

		it("assignProduct is idempotent — same result on repeated calls", async () => {
			const brand = await createTestBrand();
			const first = await controller.assignProduct({
				brandId: brand.id,
				productId: "prod-1",
			});
			const second = await controller.assignProduct({
				brandId: brand.id,
				productId: "prod-1",
			});
			const third = await controller.assignProduct({
				brandId: brand.id,
				productId: "prod-1",
			});

			expect(first.id).toBe(second.id);
			expect(second.id).toBe(third.id);
			expect(await controller.countBrandProducts(brand.id)).toBe(1);
		});
	});
});
