import { describe, expect, it, vi } from "vitest";
import { addProducts } from "../admin/endpoints/add-products";
import { createCollection } from "../admin/endpoints/create-collection";
import { deleteCollection } from "../admin/endpoints/delete-collection";
import { getCollectionProducts } from "../admin/endpoints/get-collection-products";
import { getStats } from "../admin/endpoints/get-stats";
import { listCollections } from "../admin/endpoints/list-collections";
import { removeProducts } from "../admin/endpoints/remove-products";
import { reorderProducts } from "../admin/endpoints/reorder-products";
import { updateCollection } from "../admin/endpoints/update-collection";
import type {
	Collection,
	CollectionController,
	CollectionProduct,
	CollectionStats,
	CollectionType,
} from "../service";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeCollection(overrides: Partial<Collection> = {}): Collection {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		title: "Summer Sale",
		slug: "summer-sale",
		type: "manual" as CollectionType,
		sortOrder: "manual",
		isActive: true,
		isFeatured: false,
		position: 0,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeCollectionProduct(
	overrides: Partial<CollectionProduct> = {},
): CollectionProduct {
	return {
		id: crypto.randomUUID(),
		collectionId: "col_1",
		productId: "prod_1",
		position: 0,
		addedAt: new Date(),
		...overrides,
	};
}

function makeStats(overrides: Partial<CollectionStats> = {}): CollectionStats {
	return {
		totalCollections: 0,
		activeCollections: 0,
		featuredCollections: 0,
		manualCollections: 0,
		automaticCollections: 0,
		totalProducts: 0,
		...overrides,
	};
}

function makeController(
	overrides: Partial<CollectionController> = {},
): CollectionController {
	return {
		createCollection: vi.fn().mockResolvedValue(makeCollection()),
		getCollection: vi.fn().mockResolvedValue(null),
		getCollectionBySlug: vi.fn().mockResolvedValue(null),
		updateCollection: vi.fn().mockResolvedValue(null),
		deleteCollection: vi.fn().mockResolvedValue(false),
		listCollections: vi.fn().mockResolvedValue([]),
		countCollections: vi.fn().mockResolvedValue(0),
		addProduct: vi.fn().mockResolvedValue(makeCollectionProduct()),
		removeProduct: vi.fn().mockResolvedValue(false),
		getCollectionProducts: vi.fn().mockResolvedValue([]),
		countCollectionProducts: vi.fn().mockResolvedValue(0),
		reorderProducts: vi.fn().mockResolvedValue(undefined),
		bulkAddProducts: vi.fn().mockResolvedValue(0),
		bulkRemoveProducts: vi.fn().mockResolvedValue(0),
		getFeaturedCollections: vi.fn().mockResolvedValue([]),
		getCollectionsForProduct: vi.fn().mockResolvedValue([]),
		getStats: vi.fn().mockResolvedValue(makeStats()),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: CollectionController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { collections: opts.controller ?? makeController() },
		},
	});
}

const listHandler = extractHandler(listCollections);
const getStatsHandler = extractHandler(getStats);
const createHandler = extractHandler(createCollection);
const updateHandler = extractHandler(updateCollection);
const deleteHandler = extractHandler(deleteCollection);
const getProductsHandler = extractHandler(getCollectionProducts);
const addProductsHandler = extractHandler(addProducts);
const removeProductsHandler = extractHandler(removeProducts);
const reorderHandler = extractHandler(reorderProducts);

describe("admin GET /collections", () => {
	it("returns empty list", async () => {
		const result = (await call(listHandler)) as {
			collections: Collection[];
			total: number;
		};
		expect(result.collections).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("forwards type filter", async () => {
		const ctrl = makeController();
		await call(listHandler, { query: { type: "manual" }, controller: ctrl });
		expect(ctrl.listCollections).toHaveBeenCalledWith(
			expect.objectContaining({ type: "manual" }),
		);
	});

	it("forwards isActive filter", async () => {
		const ctrl = makeController();
		await call(listHandler, {
			query: { isActive: "true" },
			controller: ctrl,
		});
		expect(ctrl.listCollections).toHaveBeenCalledWith(
			expect.objectContaining({ isActive: true }),
		);
	});

	it("returns collections with total", async () => {
		const col = makeCollection({ id: "col_1" });
		const ctrl = makeController({
			listCollections: vi.fn().mockResolvedValue([col]),
			countCollections: vi.fn().mockResolvedValue(1),
		});
		const result = (await call(listHandler, { controller: ctrl })) as {
			collections: Collection[];
			total: number;
		};
		expect(result.collections).toHaveLength(1);
		expect(result.total).toBe(1);
	});
});

describe("admin GET /collections/stats", () => {
	it("returns zero-state stats", async () => {
		const result = (await call(getStatsHandler)) as {
			stats: CollectionStats;
		};
		expect(result.stats.totalCollections).toBe(0);
	});

	it("returns real stats", async () => {
		const ctrl = makeController({
			getStats: vi.fn().mockResolvedValue(
				makeStats({
					totalCollections: 10,
					activeCollections: 8,
					featuredCollections: 3,
					manualCollections: 6,
					automaticCollections: 4,
					totalProducts: 150,
				}),
			),
		});
		const result = (await call(getStatsHandler, { controller: ctrl })) as {
			stats: CollectionStats;
		};
		expect(result.stats.totalCollections).toBe(10);
		expect(result.stats.totalProducts).toBe(150);
	});
});

describe("admin POST /collections/create", () => {
	it("returns 400 when slug already exists", async () => {
		const ctrl = makeController({
			getCollectionBySlug: vi.fn().mockResolvedValue(makeCollection()),
		});
		const result = (await call(createHandler, {
			body: { title: "Test", slug: "existing-slug", type: "manual" },
			controller: ctrl,
		})) as { error: string; status: number };
		expect(result.status).toBe(400);
	});

	it("returns 400 when automatic collection has no conditions", async () => {
		const result = (await call(createHandler, {
			body: { title: "Auto", slug: "auto-col", type: "automatic" },
		})) as { error: string; status: number };
		expect(result.status).toBe(400);
	});

	it("creates and returns a collection", async () => {
		const col = makeCollection({ title: "New Collection", slug: "new-col" });
		const ctrl = makeController({
			createCollection: vi.fn().mockResolvedValue(col),
		});
		const result = (await call(createHandler, {
			body: { title: "New Collection", slug: "new-col", type: "manual" },
			controller: ctrl,
		})) as { collection: Collection };
		expect(result.collection.title).toBe("New Collection");
	});
});

describe("admin POST /collections/:id/update", () => {
	it("returns 400 when slug conflicts with another collection", async () => {
		const other = makeCollection({ id: "other_id", slug: "taken-slug" });
		const ctrl = makeController({
			getCollectionBySlug: vi.fn().mockResolvedValue(other),
		});
		const result = (await call(updateHandler, {
			params: { id: "col_1" },
			body: { slug: "taken-slug" },
			controller: ctrl,
		})) as { error: string; status: number };
		expect(result.status).toBe(400);
	});

	it("returns 404 when collection not found", async () => {
		const result = (await call(updateHandler, {
			params: { id: "missing" },
			body: { title: "Updated" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("updates and returns the collection", async () => {
		const col = makeCollection({ id: "col_1", title: "Updated Title" });
		const ctrl = makeController({
			updateCollection: vi.fn().mockResolvedValue(col),
		});
		const result = (await call(updateHandler, {
			params: { id: "col_1" },
			body: { title: "Updated Title" },
			controller: ctrl,
		})) as { collection: Collection };
		expect(result.collection.title).toBe("Updated Title");
	});
});

describe("admin POST /collections/:id/delete", () => {
	it("returns 404 when collection not found", async () => {
		const result = (await call(deleteHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.error).toBe("Collection not found");
		expect(result.status).toBe(404);
	});

	it("deletes collection and returns success", async () => {
		const ctrl = makeController({
			deleteCollection: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteHandler, {
			params: { id: "col_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});

describe("admin GET /collections/:id/products", () => {
	it("returns 404 when collection not found", async () => {
		const result = (await call(getProductsHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.error).toBe("Collection not found");
		expect(result.status).toBe(404);
	});

	it("returns products and total", async () => {
		const col = makeCollection({ id: "col_1" });
		const product = makeCollectionProduct({ collectionId: "col_1" });
		const ctrl = makeController({
			getCollection: vi.fn().mockResolvedValue(col),
			getCollectionProducts: vi.fn().mockResolvedValue([product]),
			countCollectionProducts: vi.fn().mockResolvedValue(1),
		});
		const result = (await call(getProductsHandler, {
			params: { id: "col_1" },
			controller: ctrl,
		})) as { products: CollectionProduct[]; total: number };
		expect(result.products).toHaveLength(1);
		expect(result.total).toBe(1);
	});
});

describe("admin POST /collections/:id/products/add", () => {
	it("returns 404 when collection not found", async () => {
		const result = (await call(addProductsHandler, {
			params: { id: "missing" },
			body: { productIds: ["prod_1"] },
		})) as { error: string; status: number };
		expect(result.error).toBe("Collection not found");
		expect(result.status).toBe(404);
	});

	it("adds products and returns count", async () => {
		const col = makeCollection({ id: "col_1" });
		const ctrl = makeController({
			getCollection: vi.fn().mockResolvedValue(col),
			bulkAddProducts: vi.fn().mockResolvedValue(2),
		});
		const result = (await call(addProductsHandler, {
			params: { id: "col_1" },
			body: { productIds: ["prod_1", "prod_2"] },
			controller: ctrl,
		})) as { added: number };
		expect(result.added).toBe(2);
	});
});

describe("admin POST /collections/:id/products/remove", () => {
	it("returns 404 when collection not found", async () => {
		const result = (await call(removeProductsHandler, {
			params: { id: "missing" },
			body: { productIds: ["prod_1"] },
		})) as { error: string; status: number };
		expect(result.error).toBe("Collection not found");
		expect(result.status).toBe(404);
	});

	it("removes products and returns count", async () => {
		const col = makeCollection({ id: "col_1" });
		const ctrl = makeController({
			getCollection: vi.fn().mockResolvedValue(col),
			bulkRemoveProducts: vi.fn().mockResolvedValue(1),
		});
		const result = (await call(removeProductsHandler, {
			params: { id: "col_1" },
			body: { productIds: ["prod_1"] },
			controller: ctrl,
		})) as { removed: number };
		expect(result.removed).toBe(1);
	});
});

describe("admin POST /collections/:id/products/reorder", () => {
	it("returns 404 when collection not found", async () => {
		const result = (await call(reorderHandler, {
			params: { id: "missing" },
			body: { productIds: ["prod_1"] },
		})) as { error: string; status: number };
		expect(result.error).toBe("Collection not found");
		expect(result.status).toBe(404);
	});

	it("reorders products and returns success", async () => {
		const col = makeCollection({ id: "col_1" });
		const ctrl = makeController({
			getCollection: vi.fn().mockResolvedValue(col),
			reorderProducts: vi.fn().mockResolvedValue(undefined),
		});
		const result = (await call(reorderHandler, {
			params: { id: "col_1" },
			body: { productIds: ["prod_2", "prod_1"] },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.reorderProducts).toHaveBeenCalledWith(
			expect.objectContaining({ collectionId: "col_1" }),
		);
	});
});
