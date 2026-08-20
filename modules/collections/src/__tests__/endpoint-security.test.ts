import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createCollectionController } from "../service-impl";

/**
 * Security and isolation tests for collections endpoints.
 *
 * These verify:
 * - Cascade delete removes all product links when a collection is deleted
 * - Active/featured filtering excludes records that do not match
 * - Product queries are scoped to the correct collection
 * - Bulk operations do not leak across collection boundaries
 * - Slug-based lookup returns the correct collection
 */

describe("collections endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createCollectionController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createCollectionController(mockData);
	});

	describe("cascade delete", () => {
		it("deleting a collection removes all its product links", async () => {
			const col = await controller.createCollection({
				title: "Summer",
				slug: "summer",
				type: "manual",
			});
			await controller.addProduct({ collectionId: col.id, productId: "p1" });
			await controller.addProduct({ collectionId: col.id, productId: "p2" });
			await controller.addProduct({ collectionId: col.id, productId: "p3" });

			expect(await controller.countCollectionProducts(col.id)).toBe(3);

			const deleted = await controller.deleteCollection(col.id);
			expect(deleted).toBe(true);

			const remaining = await controller.getCollectionProducts({
				collectionId: col.id,
			});
			expect(remaining).toHaveLength(0);
		});

		it("deleting a non-existent collection returns false", async () => {
			const result = await controller.deleteCollection("no-such-id");
			expect(result).toBe(false);
		});

		it("deleting one collection does not remove another collection's product links", async () => {
			const colA = await controller.createCollection({
				title: "Collection A",
				slug: "col-a",
				type: "manual",
			});
			const colB = await controller.createCollection({
				title: "Collection B",
				slug: "col-b",
				type: "manual",
			});

			await controller.addProduct({ collectionId: colA.id, productId: "p1" });
			await controller.addProduct({ collectionId: colA.id, productId: "p2" });
			await controller.addProduct({ collectionId: colB.id, productId: "p1" });
			await controller.addProduct({ collectionId: colB.id, productId: "p3" });

			await controller.deleteCollection(colA.id);

			const colBProducts = await controller.getCollectionProducts({
				collectionId: colB.id,
			});
			expect(colBProducts).toHaveLength(2);
			expect(colBProducts.map((p) => p.productId).sort()).toEqual(["p1", "p3"]);
		});
	});

	describe("active filtering", () => {
		it("listCollections with isActive=true excludes inactive collections", async () => {
			await controller.createCollection({
				title: "Active",
				slug: "active",
				type: "manual",
				isActive: true,
			});
			await controller.createCollection({
				title: "Inactive",
				slug: "inactive",
				type: "manual",
				isActive: false,
			});

			const active = await controller.listCollections({ isActive: true });
			expect(active).toHaveLength(1);
			expect(active[0].title).toBe("Active");
		});

		it("countCollections respects isActive filter", async () => {
			await controller.createCollection({
				title: "A1",
				slug: "a1",
				type: "manual",
				isActive: true,
			});
			await controller.createCollection({
				title: "A2",
				slug: "a2",
				type: "manual",
				isActive: true,
			});
			await controller.createCollection({
				title: "I1",
				slug: "i1",
				type: "manual",
				isActive: false,
			});

			expect(await controller.countCollections({ isActive: true })).toBe(2);
			expect(await controller.countCollections({ isActive: false })).toBe(1);
		});
	});

	describe("featured filtering", () => {
		it("getFeaturedCollections only returns collections that are both featured and active", async () => {
			await controller.createCollection({
				title: "Featured Active",
				slug: "feat-active",
				type: "manual",
				isActive: true,
				isFeatured: true,
			});
			await controller.createCollection({
				title: "Featured Inactive",
				slug: "feat-inactive",
				type: "manual",
				isActive: false,
				isFeatured: true,
			});
			await controller.createCollection({
				title: "Not Featured Active",
				slug: "no-feat-active",
				type: "manual",
				isActive: true,
				isFeatured: false,
			});

			const featured = await controller.getFeaturedCollections();
			expect(featured).toHaveLength(1);
			expect(featured[0].title).toBe("Featured Active");
		});

		it("getFeaturedCollections respects the limit parameter", async () => {
			await controller.createCollection({
				title: "F1",
				slug: "f1",
				type: "manual",
				isActive: true,
				isFeatured: true,
				position: 1,
			});
			await controller.createCollection({
				title: "F2",
				slug: "f2",
				type: "manual",
				isActive: true,
				isFeatured: true,
				position: 2,
			});
			await controller.createCollection({
				title: "F3",
				slug: "f3",
				type: "manual",
				isActive: true,
				isFeatured: true,
				position: 3,
			});

			const limited = await controller.getFeaturedCollections(2);
			expect(limited).toHaveLength(2);
		});
	});

	describe("product isolation", () => {
		it("getCollectionProducts is scoped to the given collectionId", async () => {
			const colA = await controller.createCollection({
				title: "Col A",
				slug: "col-a",
				type: "manual",
			});
			const colB = await controller.createCollection({
				title: "Col B",
				slug: "col-b",
				type: "manual",
			});

			await controller.addProduct({ collectionId: colA.id, productId: "p1" });
			await controller.addProduct({ collectionId: colA.id, productId: "p2" });
			await controller.addProduct({ collectionId: colB.id, productId: "p3" });

			const productsA = await controller.getCollectionProducts({
				collectionId: colA.id,
			});
			expect(productsA).toHaveLength(2);
			expect(productsA.every((p) => p.collectionId === colA.id)).toBe(true);

			const productsB = await controller.getCollectionProducts({
				collectionId: colB.id,
			});
			expect(productsB).toHaveLength(1);
			expect(productsB[0].productId).toBe("p3");
		});

		it("countCollectionProducts is scoped to the given collectionId", async () => {
			const colA = await controller.createCollection({
				title: "Col A",
				slug: "col-a",
				type: "manual",
			});
			const colB = await controller.createCollection({
				title: "Col B",
				slug: "col-b",
				type: "manual",
			});

			await controller.addProduct({ collectionId: colA.id, productId: "p1" });
			await controller.addProduct({ collectionId: colB.id, productId: "p2" });
			await controller.addProduct({ collectionId: colB.id, productId: "p3" });

			expect(await controller.countCollectionProducts(colA.id)).toBe(1);
			expect(await controller.countCollectionProducts(colB.id)).toBe(2);
		});

		it("getCollectionsForProduct only returns active collections containing that product", async () => {
			const activeCol = await controller.createCollection({
				title: "Active Col",
				slug: "active-col",
				type: "manual",
				isActive: true,
			});
			const inactiveCol = await controller.createCollection({
				title: "Inactive Col",
				slug: "inactive-col",
				type: "manual",
				isActive: false,
			});

			await controller.addProduct({
				collectionId: activeCol.id,
				productId: "p1",
			});
			await controller.addProduct({
				collectionId: inactiveCol.id,
				productId: "p1",
			});

			const collections = await controller.getCollectionsForProduct("p1");
			expect(collections).toHaveLength(1);
			expect(collections[0].id).toBe(activeCol.id);
		});
	});

	describe("bulk operations isolation", () => {
		it("bulkAddProducts does not affect other collections", async () => {
			const colA = await controller.createCollection({
				title: "Col A",
				slug: "col-a",
				type: "manual",
			});
			const colB = await controller.createCollection({
				title: "Col B",
				slug: "col-b",
				type: "manual",
			});

			await controller.addProduct({ collectionId: colB.id, productId: "p9" });

			const added = await controller.bulkAddProducts({
				collectionId: colA.id,
				productIds: ["p1", "p2", "p3"],
			});
			expect(added).toBe(3);

			const colBProducts = await controller.getCollectionProducts({
				collectionId: colB.id,
			});
			expect(colBProducts).toHaveLength(1);
			expect(colBProducts[0].productId).toBe("p9");
		});

		it("bulkRemoveProducts does not affect other collections", async () => {
			const colA = await controller.createCollection({
				title: "Col A",
				slug: "col-a",
				type: "manual",
			});
			const colB = await controller.createCollection({
				title: "Col B",
				slug: "col-b",
				type: "manual",
			});

			await controller.bulkAddProducts({
				collectionId: colA.id,
				productIds: ["p1", "p2"],
			});
			await controller.bulkAddProducts({
				collectionId: colB.id,
				productIds: ["p1", "p2"],
			});

			await controller.bulkRemoveProducts({
				collectionId: colA.id,
				productIds: ["p1", "p2"],
			});

			expect(await controller.countCollectionProducts(colA.id)).toBe(0);
			expect(await controller.countCollectionProducts(colB.id)).toBe(2);
		});

		it("bulkAddProducts skips duplicates without error", async () => {
			const col = await controller.createCollection({
				title: "Col",
				slug: "col",
				type: "manual",
			});

			await controller.addProduct({ collectionId: col.id, productId: "p1" });

			const added = await controller.bulkAddProducts({
				collectionId: col.id,
				productIds: ["p1", "p2", "p3"],
			});
			expect(added).toBe(2);
			expect(await controller.countCollectionProducts(col.id)).toBe(3);
		});
	});

	describe("slug-based lookup", () => {
		it("getCollectionBySlug returns the correct collection", async () => {
			await controller.createCollection({
				title: "Winter Sale",
				slug: "winter-sale",
				type: "manual",
			});
			await controller.createCollection({
				title: "Summer Sale",
				slug: "summer-sale",
				type: "automatic",
			});

			const result = await controller.getCollectionBySlug("summer-sale");
			expect(result).not.toBeNull();
			expect(result?.title).toBe("Summer Sale");
			expect(result?.slug).toBe("summer-sale");
		});

		it("getCollectionBySlug returns null for non-existent slug", async () => {
			const result = await controller.getCollectionBySlug("does-not-exist");
			expect(result).toBeNull();
		});
	});

	describe("stats accuracy", () => {
		it("getStats reflects correct counts across active, featured, and type dimensions", async () => {
			await controller.createCollection({
				title: "Active Manual",
				slug: "am",
				type: "manual",
				isActive: true,
				isFeatured: false,
			});
			await controller.createCollection({
				title: "Inactive Auto",
				slug: "ia",
				type: "automatic",
				isActive: false,
				isFeatured: true,
			});
			await controller.createCollection({
				title: "Active Featured Auto",
				slug: "afa",
				type: "automatic",
				isActive: true,
				isFeatured: true,
			});

			await controller.addProduct({
				collectionId: (await controller.getCollectionBySlug("am"))?.id ?? "",
				productId: "p1",
			});
			await controller.addProduct({
				collectionId: (await controller.getCollectionBySlug("afa"))?.id ?? "",
				productId: "p1",
			});
			await controller.addProduct({
				collectionId: (await controller.getCollectionBySlug("afa"))?.id ?? "",
				productId: "p2",
			});

			const stats = await controller.getStats();
			expect(stats.totalCollections).toBe(3);
			expect(stats.activeCollections).toBe(2);
			expect(stats.featuredCollections).toBe(2);
			expect(stats.manualCollections).toBe(1);
			expect(stats.automaticCollections).toBe(2);
			expect(stats.totalProducts).toBe(2);
		});
	});
});
