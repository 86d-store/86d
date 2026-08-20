import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { CollectionController, CollectionType } from "../service";
import { createCollectionController } from "../service-impl";

/**
 * Store endpoint integration tests for the collections module.
 *
 * All store endpoints are public (no auth required). Tests verify:
 *
 * 1. list-collections — filtering by type/featured, only active collections returned
 * 2. get-collection — slug lookup, 404 for inactive/missing
 * 3. get-collection-products — pagination, 404 for inactive collection
 * 4. get-featured — limit param, only active + featured returned
 * 5. get-product-collections — reverse lookup, only active collections
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Helpers ─────────────────────────────────────────────────────────────

async function seedCollection(
	controller: CollectionController,
	overrides: Partial<{
		title: string;
		slug: string;
		type: CollectionType;
		isActive: boolean;
		isFeatured: boolean;
		position: number;
		description: string;
	}> = {},
) {
	return controller.createCollection({
		title: overrides.title ?? "Test Collection",
		slug: overrides.slug ?? `col-${crypto.randomUUID().slice(0, 8)}`,
		type: overrides.type ?? "manual",
		isActive: overrides.isActive ?? true,
		isFeatured: overrides.isFeatured ?? false,
		position: overrides.position ?? 0,
		...(overrides.description != null
			? { description: overrides.description }
			: {}),
	});
}

// ── Simulate endpoint logic ─────────────────────────────────────────────

async function simulateListCollections(
	controller: CollectionController,
	query: {
		type?: CollectionType;
		featured?: boolean;
		take?: number;
		skip?: number;
	} = {},
) {
	const collections = await controller.listCollections({
		isActive: true,
		...(query.type ? { type: query.type } : {}),
		...(query.featured !== undefined ? { isFeatured: query.featured } : {}),
		take: query.take ?? 50,
		skip: query.skip ?? 0,
	});
	return { collections };
}

async function simulateGetCollection(
	controller: CollectionController,
	slug: string,
) {
	const collection = await controller.getCollectionBySlug(slug);
	if (!collection?.isActive) {
		return { error: "Not found", status: 404 };
	}
	const productCount = await controller.countCollectionProducts(collection.id);
	return { collection, productCount };
}

async function simulateGetCollectionProducts(
	controller: CollectionController,
	slug: string,
	query: { take?: number; skip?: number } = {},
) {
	const collection = await controller.getCollectionBySlug(slug);
	if (!collection?.isActive) {
		return { error: "Not found", status: 404 };
	}
	const take = query.take ?? 50;
	const skip = query.skip ?? 0;
	const products = await controller.getCollectionProducts({
		collectionId: collection.id,
		take,
		skip,
	});
	const totalCount = await controller.countCollectionProducts(collection.id);
	return { products, totalCount };
}

async function simulateGetFeatured(
	controller: CollectionController,
	query: { limit?: number } = {},
) {
	const limit = query.limit ?? 10;
	const collections = await controller.getFeaturedCollections(limit);
	return { collections };
}

async function simulateGetProductCollections(
	controller: CollectionController,
	productId: string,
) {
	const collections = await controller.getCollectionsForProduct(productId);
	return { collections };
}

// ── Tests ───────────────────────────────────────────────────────────────

let data: DataService;
let controller: CollectionController;

beforeEach(() => {
	data = createMockDataService();
	controller = createCollectionController(data);
});

describe("list-collections (GET /collections)", () => {
	it("returns only active collections", async () => {
		await seedCollection(controller, {
			slug: "active",
			isActive: true,
		});
		await seedCollection(controller, {
			slug: "inactive",
			isActive: false,
		});

		const result = await simulateListCollections(controller);
		expect(result.collections).toHaveLength(1);
		expect(result.collections[0].slug).toBe("active");
	});

	it("filters by collection type", async () => {
		await seedCollection(controller, {
			slug: "manual-col",
			type: "manual",
		});
		await seedCollection(controller, {
			slug: "auto-col",
			type: "automatic",
		});

		const manual = await simulateListCollections(controller, {
			type: "manual",
		});
		expect(manual.collections).toHaveLength(1);
		expect(manual.collections[0].slug).toBe("manual-col");

		const automatic = await simulateListCollections(controller, {
			type: "automatic",
		});
		expect(automatic.collections).toHaveLength(1);
		expect(automatic.collections[0].slug).toBe("auto-col");
	});

	it("filters by featured status", async () => {
		await seedCollection(controller, {
			slug: "featured",
			isFeatured: true,
		});
		await seedCollection(controller, {
			slug: "regular",
			isFeatured: false,
		});

		const featured = await simulateListCollections(controller, {
			featured: true,
		});
		expect(featured.collections).toHaveLength(1);
		expect(featured.collections[0].slug).toBe("featured");
	});

	it("paginates with take/skip", async () => {
		for (let i = 0; i < 5; i++) {
			await seedCollection(controller, {
				slug: `col-${i}`,
				position: i,
			});
		}

		const page1 = await simulateListCollections(controller, {
			take: 2,
			skip: 0,
		});
		expect(page1.collections).toHaveLength(2);

		const page2 = await simulateListCollections(controller, {
			take: 2,
			skip: 2,
		});
		expect(page2.collections).toHaveLength(2);

		const page3 = await simulateListCollections(controller, {
			take: 2,
			skip: 4,
		});
		expect(page3.collections).toHaveLength(1);
	});

	it("returns empty array when no collections exist", async () => {
		const result = await simulateListCollections(controller);
		expect(result.collections).toHaveLength(0);
	});
});

describe("get-collection (GET /collections/:slug)", () => {
	it("returns collection with product count", async () => {
		const col = await seedCollection(controller, {
			slug: "summer-sale",
			title: "Summer Sale",
			description: "Hot deals",
		});
		await controller.addProduct({
			collectionId: col.id,
			productId: "prod_1",
		});
		await controller.addProduct({
			collectionId: col.id,
			productId: "prod_2",
		});

		const result = await simulateGetCollection(controller, "summer-sale");
		expect("collection" in result).toBe(true);
		if ("collection" in result) {
			expect(result.collection.title).toBe("Summer Sale");
			expect(result.collection.description).toBe("Hot deals");
			expect(result.productCount).toBe(2);
		}
	});

	it("returns 404 for non-existent slug", async () => {
		const result = await simulateGetCollection(controller, "nonexistent");
		expect(result).toEqual({ error: "Not found", status: 404 });
	});

	it("returns 404 for inactive collection", async () => {
		await seedCollection(controller, {
			slug: "hidden",
			isActive: false,
		});

		const result = await simulateGetCollection(controller, "hidden");
		expect(result).toEqual({ error: "Not found", status: 404 });
	});
});

describe("get-collection-products (GET /collections/:slug/products)", () => {
	it("returns products in the collection", async () => {
		const col = await seedCollection(controller, { slug: "tops" });
		await controller.addProduct({
			collectionId: col.id,
			productId: "prod_1",
		});
		await controller.addProduct({
			collectionId: col.id,
			productId: "prod_2",
		});
		await controller.addProduct({
			collectionId: col.id,
			productId: "prod_3",
		});

		const result = await simulateGetCollectionProducts(controller, "tops");
		expect("products" in result).toBe(true);
		if ("products" in result) {
			expect(result.products).toHaveLength(3);
			expect(result.totalCount).toBe(3);
		}
	});

	it("paginates products", async () => {
		const col = await seedCollection(controller, { slug: "big" });
		for (let i = 0; i < 5; i++) {
			await controller.addProduct({
				collectionId: col.id,
				productId: `prod_${i}`,
			});
		}

		const page1 = await simulateGetCollectionProducts(controller, "big", {
			take: 2,
			skip: 0,
		});
		if ("products" in page1) {
			expect(page1.products).toHaveLength(2);
			expect(page1.totalCount).toBe(5);
		}

		const page3 = await simulateGetCollectionProducts(controller, "big", {
			take: 2,
			skip: 4,
		});
		if ("products" in page3) {
			expect(page3.products).toHaveLength(1);
		}
	});

	it("returns 404 for inactive collection", async () => {
		await seedCollection(controller, {
			slug: "hidden",
			isActive: false,
		});

		const result = await simulateGetCollectionProducts(controller, "hidden");
		expect(result).toEqual({ error: "Not found", status: 404 });
	});

	it("returns empty products for collection with none", async () => {
		await seedCollection(controller, { slug: "empty" });

		const result = await simulateGetCollectionProducts(controller, "empty");
		if ("products" in result) {
			expect(result.products).toHaveLength(0);
			expect(result.totalCount).toBe(0);
		}
	});
});

describe("get-featured (GET /collections/featured)", () => {
	it("returns only featured and active collections", async () => {
		await seedCollection(controller, {
			slug: "feat-active",
			isFeatured: true,
			isActive: true,
		});
		await seedCollection(controller, {
			slug: "feat-inactive",
			isFeatured: true,
			isActive: false,
		});
		await seedCollection(controller, {
			slug: "not-featured",
			isFeatured: false,
			isActive: true,
		});

		const result = await simulateGetFeatured(controller);
		expect(result.collections).toHaveLength(1);
		expect(result.collections[0].slug).toBe("feat-active");
	});

	it("respects limit parameter", async () => {
		for (let i = 0; i < 5; i++) {
			await seedCollection(controller, {
				slug: `feat-${i}`,
				isFeatured: true,
				position: i,
			});
		}

		const result = await simulateGetFeatured(controller, { limit: 3 });
		expect(result.collections).toHaveLength(3);
	});

	it("returns empty when no featured collections exist", async () => {
		await seedCollection(controller, {
			slug: "regular",
			isFeatured: false,
		});

		const result = await simulateGetFeatured(controller);
		expect(result.collections).toHaveLength(0);
	});
});

describe("get-product-collections (GET /collections/product/:productId)", () => {
	it("returns all active collections containing the product", async () => {
		const col1 = await seedCollection(controller, { slug: "col-1" });
		const col2 = await seedCollection(controller, { slug: "col-2" });
		await seedCollection(controller, { slug: "col-3" });

		await controller.addProduct({
			collectionId: col1.id,
			productId: "prod_1",
		});
		await controller.addProduct({
			collectionId: col2.id,
			productId: "prod_1",
		});

		const result = await simulateGetProductCollections(controller, "prod_1");
		expect(result.collections).toHaveLength(2);
	});

	it("excludes inactive collections", async () => {
		const active = await seedCollection(controller, {
			slug: "active",
			isActive: true,
		});
		const inactive = await seedCollection(controller, {
			slug: "inactive",
			isActive: false,
		});

		await controller.addProduct({
			collectionId: active.id,
			productId: "prod_1",
		});
		await controller.addProduct({
			collectionId: inactive.id,
			productId: "prod_1",
		});

		const result = await simulateGetProductCollections(controller, "prod_1");
		expect(result.collections).toHaveLength(1);
		expect(result.collections[0].slug).toBe("active");
	});

	it("returns empty for product in no collections", async () => {
		const result = await simulateGetProductCollections(
			controller,
			"prod_orphan",
		);
		expect(result.collections).toHaveLength(0);
	});
});

describe("cross-endpoint consistency", () => {
	it("collection visible in list, detail, and featured", async () => {
		const col = await seedCollection(controller, {
			slug: "best-sellers",
			title: "Best Sellers",
			isFeatured: true,
		});
		await controller.addProduct({
			collectionId: col.id,
			productId: "prod_1",
		});

		// Appears in list
		const list = await simulateListCollections(controller);
		expect(list.collections.some((c) => c.slug === "best-sellers")).toBe(true);

		// Appears in detail
		const detail = await simulateGetCollection(controller, "best-sellers");
		expect("collection" in detail).toBe(true);
		if ("collection" in detail) {
			expect(detail.productCount).toBe(1);
		}

		// Appears in featured
		const featured = await simulateGetFeatured(controller);
		expect(featured.collections.some((c) => c.slug === "best-sellers")).toBe(
			true,
		);

		// Product reverse lookup
		const prodCols = await simulateGetProductCollections(controller, "prod_1");
		expect(prodCols.collections).toHaveLength(1);
	});

	it("deactivating a collection hides it from all endpoints", async () => {
		const col = await seedCollection(controller, {
			slug: "seasonal",
			isFeatured: true,
		});
		await controller.addProduct({
			collectionId: col.id,
			productId: "prod_1",
		});

		// Deactivate
		await controller.updateCollection(col.id, { isActive: false });

		// Hidden from list
		const list = await simulateListCollections(controller);
		expect(list.collections).toHaveLength(0);

		// Hidden from detail
		const detail = await simulateGetCollection(controller, "seasonal");
		expect(detail).toEqual({ error: "Not found", status: 404 });

		// Hidden from featured
		const featured = await simulateGetFeatured(controller);
		expect(featured.collections).toHaveLength(0);

		// Hidden from product reverse lookup
		const prodCols = await simulateGetProductCollections(controller, "prod_1");
		expect(prodCols.collections).toHaveLength(0);
	});
});
