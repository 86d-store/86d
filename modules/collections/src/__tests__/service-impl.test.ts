import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createCollectionController } from "../service-impl";

describe("createCollectionController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createCollectionController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createCollectionController(mockData);
	});

	async function createTestCollection(
		overrides: Partial<Parameters<typeof controller.createCollection>[0]> = {},
	) {
		return controller.createCollection({
			title: "Summer Sale",
			slug: "summer-sale",
			type: "manual",
			...overrides,
		});
	}

	// ── createCollection ──

	describe("createCollection", () => {
		it("creates a collection with required fields", async () => {
			const col = await createTestCollection();
			expect(col.id).toBeDefined();
			expect(col.title).toBe("Summer Sale");
			expect(col.slug).toBe("summer-sale");
			expect(col.type).toBe("manual");
			expect(col.isActive).toBe(true);
			expect(col.isFeatured).toBe(false);
			expect(col.position).toBe(0);
			expect(col.sortOrder).toBe("manual");
			expect(col.createdAt).toBeInstanceOf(Date);
			expect(col.updatedAt).toBeInstanceOf(Date);
		});

		it("creates a collection with all optional fields", async () => {
			const now = new Date();
			const col = await createTestCollection({
				description: "Hot summer deals",
				image: "https://example.com/summer.jpg",
				type: "automatic",
				sortOrder: "price-asc",
				isActive: false,
				isFeatured: true,
				position: 5,
				conditions: {
					match: "all",
					rules: [
						{
							field: "category",
							operator: "equals",
							value: "summer",
						},
					],
				},
				seoTitle: "Summer Sale SEO",
				seoDescription: "Best summer deals",
				publishedAt: now,
			});
			expect(col.description).toBe("Hot summer deals");
			expect(col.image).toBe("https://example.com/summer.jpg");
			expect(col.type).toBe("automatic");
			expect(col.sortOrder).toBe("price-asc");
			expect(col.isActive).toBe(false);
			expect(col.isFeatured).toBe(true);
			expect(col.position).toBe(5);
			expect(col.conditions?.match).toBe("all");
			expect(col.conditions?.rules).toHaveLength(1);
			expect(col.seoTitle).toBe("Summer Sale SEO");
			expect(col.seoDescription).toBe("Best summer deals");
			expect(col.publishedAt).toBe(now);
		});

		it("generates unique IDs", async () => {
			const col1 = await createTestCollection({ slug: "col-1" });
			const col2 = await createTestCollection({ slug: "col-2" });
			expect(col1.id).not.toBe(col2.id);
		});
	});

	// ── getCollection ──

	describe("getCollection", () => {
		it("returns a collection by ID", async () => {
			const created = await createTestCollection();
			const found = await controller.getCollection(created.id);
			expect(found?.title).toBe("Summer Sale");
		});

		it("returns null for non-existent ID", async () => {
			const found = await controller.getCollection("non-existent");
			expect(found).toBeNull();
		});
	});

	// ── getCollectionBySlug ──

	describe("getCollectionBySlug", () => {
		it("returns a collection by slug", async () => {
			await createTestCollection();
			const found = await controller.getCollectionBySlug("summer-sale");
			expect(found?.title).toBe("Summer Sale");
		});

		it("returns null for non-existent slug", async () => {
			const found = await controller.getCollectionBySlug("non-existent");
			expect(found).toBeNull();
		});
	});

	// ── updateCollection ──

	describe("updateCollection", () => {
		it("updates basic fields", async () => {
			const created = await createTestCollection();
			const updated = await controller.updateCollection(created.id, {
				title: "Winter Sale",
				slug: "winter-sale",
			});
			expect(updated?.title).toBe("Winter Sale");
			expect(updated?.slug).toBe("winter-sale");
		});

		it("clears optional fields with null", async () => {
			const created = await createTestCollection({
				description: "Some description",
				image: "https://example.com/img.jpg",
				seoTitle: "SEO title",
			});
			const updated = await controller.updateCollection(created.id, {
				description: null,
				image: null,
				seoTitle: null,
			});
			expect(updated?.description).toBeUndefined();
			expect(updated?.image).toBeUndefined();
			expect(updated?.seoTitle).toBeUndefined();
		});

		it("preserves fields not specified in update", async () => {
			const created = await createTestCollection({
				description: "Original",
			});
			const updated = await controller.updateCollection(created.id, {
				title: "New Title",
			});
			expect(updated?.title).toBe("New Title");
			expect(updated?.description).toBe("Original");
		});

		it("returns null for non-existent collection", async () => {
			const updated = await controller.updateCollection("non-existent", {
				title: "New",
			});
			expect(updated).toBeNull();
		});

		it("updates the updatedAt timestamp", async () => {
			const created = await createTestCollection();
			const updated = await controller.updateCollection(created.id, {
				title: "Updated",
			});
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				created.updatedAt.getTime(),
			);
		});
	});

	// ── deleteCollection ──

	describe("deleteCollection", () => {
		it("deletes an existing collection", async () => {
			const created = await createTestCollection();
			const deleted = await controller.deleteCollection(created.id);
			expect(deleted).toBe(true);
			const found = await controller.getCollection(created.id);
			expect(found).toBeNull();
		});

		it("returns false for non-existent collection", async () => {
			const deleted = await controller.deleteCollection("non-existent");
			expect(deleted).toBe(false);
		});

		it("removes associated products when deleting", async () => {
			const col = await createTestCollection();
			await controller.addProduct({
				collectionId: col.id,
				productId: "prod-1",
			});
			await controller.addProduct({
				collectionId: col.id,
				productId: "prod-2",
			});

			await controller.deleteCollection(col.id);

			const products = await controller.getCollectionProducts({
				collectionId: col.id,
			});
			expect(products).toHaveLength(0);
		});
	});

	// ── listCollections ──

	describe("listCollections", () => {
		it("returns all collections", async () => {
			await createTestCollection({ slug: "col-1" });
			await createTestCollection({ slug: "col-2" });
			await createTestCollection({ slug: "col-3" });

			const list = await controller.listCollections();
			expect(list).toHaveLength(3);
		});

		it("filters by isActive", async () => {
			await createTestCollection({
				slug: "active",
				isActive: true,
			});
			await createTestCollection({
				slug: "inactive",
				isActive: false,
			});

			const active = await controller.listCollections({
				isActive: true,
			});
			expect(active).toHaveLength(1);
			expect(active[0].slug).toBe("active");
		});

		it("filters by isFeatured", async () => {
			await createTestCollection({
				slug: "featured",
				isFeatured: true,
			});
			await createTestCollection({
				slug: "normal",
				isFeatured: false,
			});

			const featured = await controller.listCollections({
				isFeatured: true,
			});
			expect(featured).toHaveLength(1);
			expect(featured[0].slug).toBe("featured");
		});

		it("filters by type", async () => {
			await createTestCollection({
				slug: "manual-col",
				type: "manual",
			});
			await createTestCollection({
				slug: "auto-col",
				type: "automatic",
			});

			const manual = await controller.listCollections({
				type: "manual",
			});
			expect(manual).toHaveLength(1);
			expect(manual[0].type).toBe("manual");
		});

		it("supports pagination with take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await createTestCollection({ slug: `col-${i}` });
			}

			const page1 = await controller.listCollections({
				take: 2,
				skip: 0,
			});
			expect(page1).toHaveLength(2);

			const page2 = await controller.listCollections({
				take: 2,
				skip: 2,
			});
			expect(page2).toHaveLength(2);
		});
	});

	// ── countCollections ──

	describe("countCollections", () => {
		it("counts all collections", async () => {
			await createTestCollection({ slug: "col-1" });
			await createTestCollection({ slug: "col-2" });
			const count = await controller.countCollections();
			expect(count).toBe(2);
		});

		it("counts filtered collections", async () => {
			await createTestCollection({
				slug: "active",
				isActive: true,
			});
			await createTestCollection({
				slug: "inactive",
				isActive: false,
			});
			const count = await controller.countCollections({
				isActive: true,
			});
			expect(count).toBe(1);
		});

		it("returns 0 when no collections exist", async () => {
			const count = await controller.countCollections();
			expect(count).toBe(0);
		});
	});

	// ── addProduct ──

	describe("addProduct", () => {
		it("adds a product to a collection", async () => {
			const col = await createTestCollection();
			const item = await controller.addProduct({
				collectionId: col.id,
				productId: "prod-1",
			});
			expect(item.id).toBeDefined();
			expect(item.collectionId).toBe(col.id);
			expect(item.productId).toBe("prod-1");
			expect(item.addedAt).toBeInstanceOf(Date);
		});

		it("auto-assigns position when not specified", async () => {
			const col = await createTestCollection();
			const item1 = await controller.addProduct({
				collectionId: col.id,
				productId: "prod-1",
			});
			const item2 = await controller.addProduct({
				collectionId: col.id,
				productId: "prod-2",
			});
			expect(item1.position).toBe(1);
			expect(item2.position).toBe(2);
		});

		it("uses specified position", async () => {
			const col = await createTestCollection();
			const item = await controller.addProduct({
				collectionId: col.id,
				productId: "prod-1",
				position: 10,
			});
			expect(item.position).toBe(10);
		});

		it("returns existing item if product already in collection", async () => {
			const col = await createTestCollection();
			const first = await controller.addProduct({
				collectionId: col.id,
				productId: "prod-1",
			});
			const second = await controller.addProduct({
				collectionId: col.id,
				productId: "prod-1",
			});
			expect(first.id).toBe(second.id);
		});
	});

	// ── removeProduct ──

	describe("removeProduct", () => {
		it("removes a product from a collection", async () => {
			const col = await createTestCollection();
			await controller.addProduct({
				collectionId: col.id,
				productId: "prod-1",
			});
			const removed = await controller.removeProduct({
				collectionId: col.id,
				productId: "prod-1",
			});
			expect(removed).toBe(true);

			const products = await controller.getCollectionProducts({
				collectionId: col.id,
			});
			expect(products).toHaveLength(0);
		});

		it("returns false if product not in collection", async () => {
			const col = await createTestCollection();
			const removed = await controller.removeProduct({
				collectionId: col.id,
				productId: "non-existent",
			});
			expect(removed).toBe(false);
		});
	});

	// ── getCollectionProducts ──

	describe("getCollectionProducts", () => {
		it("returns products in a collection", async () => {
			const col = await createTestCollection();
			await controller.addProduct({
				collectionId: col.id,
				productId: "prod-1",
			});
			await controller.addProduct({
				collectionId: col.id,
				productId: "prod-2",
			});

			const products = await controller.getCollectionProducts({
				collectionId: col.id,
			});
			expect(products).toHaveLength(2);
		});

		it("returns empty array for collection with no products", async () => {
			const col = await createTestCollection();
			const products = await controller.getCollectionProducts({
				collectionId: col.id,
			});
			expect(products).toHaveLength(0);
		});

		it("supports pagination", async () => {
			const col = await createTestCollection();
			for (let i = 0; i < 5; i++) {
				await controller.addProduct({
					collectionId: col.id,
					productId: `prod-${i}`,
				});
			}

			const page = await controller.getCollectionProducts({
				collectionId: col.id,
				take: 2,
				skip: 0,
			});
			expect(page).toHaveLength(2);
		});
	});

	// ── countCollectionProducts ──

	describe("countCollectionProducts", () => {
		it("counts products in a collection", async () => {
			const col = await createTestCollection();
			await controller.addProduct({
				collectionId: col.id,
				productId: "prod-1",
			});
			await controller.addProduct({
				collectionId: col.id,
				productId: "prod-2",
			});

			const count = await controller.countCollectionProducts(col.id);
			expect(count).toBe(2);
		});

		it("returns 0 for empty collection", async () => {
			const col = await createTestCollection();
			const count = await controller.countCollectionProducts(col.id);
			expect(count).toBe(0);
		});
	});

	// ── reorderProducts ──

	describe("reorderProducts", () => {
		it("reorders products by position", async () => {
			const col = await createTestCollection();
			await controller.addProduct({
				collectionId: col.id,
				productId: "prod-a",
			});
			await controller.addProduct({
				collectionId: col.id,
				productId: "prod-b",
			});
			await controller.addProduct({
				collectionId: col.id,
				productId: "prod-c",
			});

			await controller.reorderProducts({
				collectionId: col.id,
				productIds: ["prod-c", "prod-a", "prod-b"],
			});

			const products = await controller.getCollectionProducts({
				collectionId: col.id,
			});
			const positions = products.reduce(
				(acc, p) => {
					acc[p.productId] = p.position;
					return acc;
				},
				{} as Record<string, number>,
			);

			expect(positions["prod-c"]).toBe(1);
			expect(positions["prod-a"]).toBe(2);
			expect(positions["prod-b"]).toBe(3);
		});

		it("ignores non-existent products in reorder list", async () => {
			const col = await createTestCollection();
			await controller.addProduct({
				collectionId: col.id,
				productId: "prod-a",
			});

			await controller.reorderProducts({
				collectionId: col.id,
				productIds: ["non-existent", "prod-a"],
			});

			const products = await controller.getCollectionProducts({
				collectionId: col.id,
			});
			expect(products[0].position).toBe(2);
		});
	});

	// ── bulkAddProducts ──

	describe("bulkAddProducts", () => {
		it("adds multiple products at once", async () => {
			const col = await createTestCollection();
			const added = await controller.bulkAddProducts({
				collectionId: col.id,
				productIds: ["prod-1", "prod-2", "prod-3"],
			});
			expect(added).toBe(3);

			const count = await controller.countCollectionProducts(col.id);
			expect(count).toBe(3);
		});

		it("skips duplicates", async () => {
			const col = await createTestCollection();
			await controller.addProduct({
				collectionId: col.id,
				productId: "prod-1",
			});

			const added = await controller.bulkAddProducts({
				collectionId: col.id,
				productIds: ["prod-1", "prod-2", "prod-3"],
			});
			expect(added).toBe(2);

			const count = await controller.countCollectionProducts(col.id);
			expect(count).toBe(3);
		});

		it("assigns sequential positions", async () => {
			const col = await createTestCollection();
			await controller.bulkAddProducts({
				collectionId: col.id,
				productIds: ["prod-1", "prod-2"],
			});

			const products = await controller.getCollectionProducts({
				collectionId: col.id,
			});
			const positions = products.map((p) => p.position).sort();
			expect(positions).toEqual([1, 2]);
		});
	});

	// ── bulkRemoveProducts ──

	describe("bulkRemoveProducts", () => {
		it("removes multiple products at once", async () => {
			const col = await createTestCollection();
			await controller.bulkAddProducts({
				collectionId: col.id,
				productIds: ["prod-1", "prod-2", "prod-3"],
			});

			const removed = await controller.bulkRemoveProducts({
				collectionId: col.id,
				productIds: ["prod-1", "prod-3"],
			});
			expect(removed).toBe(2);

			const count = await controller.countCollectionProducts(col.id);
			expect(count).toBe(1);
		});

		it("returns 0 when no products match", async () => {
			const col = await createTestCollection();
			const removed = await controller.bulkRemoveProducts({
				collectionId: col.id,
				productIds: ["non-existent"],
			});
			expect(removed).toBe(0);
		});
	});

	// ── getFeaturedCollections ──

	describe("getFeaturedCollections", () => {
		it("returns only featured and active collections", async () => {
			await createTestCollection({
				slug: "featured-active",
				isFeatured: true,
				isActive: true,
			});
			await createTestCollection({
				slug: "featured-inactive",
				isFeatured: true,
				isActive: false,
			});
			await createTestCollection({
				slug: "not-featured",
				isFeatured: false,
				isActive: true,
			});

			const featured = await controller.getFeaturedCollections();
			expect(featured).toHaveLength(1);
			expect(featured[0].slug).toBe("featured-active");
		});

		it("respects the limit parameter", async () => {
			for (let i = 0; i < 5; i++) {
				await createTestCollection({
					slug: `featured-${i}`,
					isFeatured: true,
				});
			}

			const limited = await controller.getFeaturedCollections(3);
			expect(limited).toHaveLength(3);
		});

		it("returns empty array when no featured collections", async () => {
			await createTestCollection({ isFeatured: false });
			const featured = await controller.getFeaturedCollections();
			expect(featured).toHaveLength(0);
		});
	});

	// ── getCollectionsForProduct ──

	describe("getCollectionsForProduct", () => {
		it("returns collections containing a product", async () => {
			const col1 = await createTestCollection({ slug: "col-1" });
			const col2 = await createTestCollection({ slug: "col-2" });
			await createTestCollection({ slug: "col-3" });

			await controller.addProduct({
				collectionId: col1.id,
				productId: "prod-1",
			});
			await controller.addProduct({
				collectionId: col2.id,
				productId: "prod-1",
			});

			const collections = await controller.getCollectionsForProduct("prod-1");
			expect(collections).toHaveLength(2);
		});

		it("only returns active collections", async () => {
			const active = await createTestCollection({
				slug: "active",
				isActive: true,
			});
			const inactive = await createTestCollection({
				slug: "inactive",
				isActive: false,
			});

			await controller.addProduct({
				collectionId: active.id,
				productId: "prod-1",
			});
			await controller.addProduct({
				collectionId: inactive.id,
				productId: "prod-1",
			});

			const collections = await controller.getCollectionsForProduct("prod-1");
			expect(collections).toHaveLength(1);
			expect(collections[0].slug).toBe("active");
		});

		it("returns empty array for product in no collections", async () => {
			const collections =
				await controller.getCollectionsForProduct("non-existent");
			expect(collections).toHaveLength(0);
		});
	});

	// ── getStats ──

	describe("getStats", () => {
		it("returns correct statistics", async () => {
			await createTestCollection({
				slug: "manual-active",
				type: "manual",
				isActive: true,
				isFeatured: true,
			});
			await createTestCollection({
				slug: "auto-active",
				type: "automatic",
				isActive: true,
				isFeatured: false,
			});
			await createTestCollection({
				slug: "manual-inactive",
				type: "manual",
				isActive: false,
				isFeatured: false,
			});

			const stats = await controller.getStats();
			expect(stats.totalCollections).toBe(3);
			expect(stats.activeCollections).toBe(2);
			expect(stats.featuredCollections).toBe(1);
			expect(stats.manualCollections).toBe(2);
			expect(stats.automaticCollections).toBe(1);
		});

		it("counts unique products across collections", async () => {
			const col1 = await createTestCollection({ slug: "col-1" });
			const col2 = await createTestCollection({ slug: "col-2" });

			await controller.addProduct({
				collectionId: col1.id,
				productId: "prod-1",
			});
			await controller.addProduct({
				collectionId: col1.id,
				productId: "prod-2",
			});
			await controller.addProduct({
				collectionId: col2.id,
				productId: "prod-1",
			});

			const stats = await controller.getStats();
			expect(stats.totalProducts).toBe(2);
		});

		it("returns zeros when no data", async () => {
			const stats = await controller.getStats();
			expect(stats.totalCollections).toBe(0);
			expect(stats.activeCollections).toBe(0);
			expect(stats.featuredCollections).toBe(0);
			expect(stats.manualCollections).toBe(0);
			expect(stats.automaticCollections).toBe(0);
			expect(stats.totalProducts).toBe(0);
		});
	});
});
