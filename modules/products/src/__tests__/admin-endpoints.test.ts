import { describe, expect, it, vi } from "vitest";
import { addCollectionProduct } from "../admin/endpoints/add-collection-product";
import { bulkAction } from "../admin/endpoints/bulk-action";
import {
	createCatalogRevisionDraft,
	publishCatalogRevision,
	reviewCatalogRevision,
} from "../admin/endpoints/catalog-revisions";
import { createCategory } from "../admin/endpoints/create-category";
import { createCollection } from "../admin/endpoints/create-collection";
import { createProduct } from "../admin/endpoints/create-product";
import { createVariant } from "../admin/endpoints/create-variant";
import { deleteCategory } from "../admin/endpoints/delete-category";
import { deleteCollection } from "../admin/endpoints/delete-collection";
import { deleteProduct } from "../admin/endpoints/delete-product";
import { deleteVariant } from "../admin/endpoints/delete-variant";
import { adminGetProduct } from "../admin/endpoints/get-product";
import { importProducts } from "../admin/endpoints/import-products";
import { adminListCategories } from "../admin/endpoints/list-categories";
import { adminListCollections } from "../admin/endpoints/list-collections";
import { adminListProducts } from "../admin/endpoints/list-products";
import { removeCollectionProduct } from "../admin/endpoints/remove-collection-product";
import { updateCategory } from "../admin/endpoints/update-category";
import { updateCollection } from "../admin/endpoints/update-collection";
import { updateProduct } from "../admin/endpoints/update-product";
import { updateVariant } from "../admin/endpoints/update-variant";
import type {
	Category,
	Collection,
	CollectionProduct,
	Product,
	ProductVariant,
	ProductWithVariants,
} from "../controllers";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeProduct(overrides: Partial<Product> = {}): Product {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Test Product",
		slug: "test-product",
		price: 1999,
		inventory: 10,
		trackInventory: true,
		allowBackorder: false,
		status: "active",
		images: [],
		tags: [],
		isFeatured: false,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeProductWithVariants(
	overrides: Partial<ProductWithVariants> = {},
): ProductWithVariants {
	return { ...makeProduct(), variants: [], ...overrides };
}

function makeVariant(
	productId: string,
	overrides: Partial<ProductVariant> = {},
): ProductVariant {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		productId,
		name: "Default",
		price: 1999,
		inventory: 5,
		options: {},
		images: [],
		position: 0,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeCategory(overrides: Partial<Category> = {}): Category {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Electronics",
		slug: "electronics",
		position: 0,
		isVisible: true,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeCollection(overrides: Partial<Collection> = {}): Collection {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Summer Sale",
		slug: "summer-sale",
		isFeatured: false,
		isVisible: true,
		position: 0,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeCollectionProduct(
	collectionId: string,
	productId: string,
): CollectionProduct {
	return {
		id: crypto.randomUUID(),
		collectionId,
		productId,
		position: 0,
		createdAt: new Date(),
	};
}

type SubCtrl = Record<string, ReturnType<typeof vi.fn>>;

type ProductControllers = {
	product: SubCtrl;
	variant: SubCtrl;
	category: SubCtrl;
	bulk: SubCtrl;
	import: SubCtrl;
	collection: SubCtrl;
};

function makeControllers(
	overrides: Partial<Record<keyof ProductControllers, SubCtrl>> = {},
): ProductControllers {
	const defaultProduct = makeProduct();
	const defaultCategory = makeCategory();
	const defaultCollection = makeCollection();
	return {
		product: {
			create: vi.fn().mockResolvedValue(defaultProduct),
			getById: vi.fn().mockResolvedValue(null),
			getBySlug: vi.fn().mockResolvedValue(null),
			getWithVariants: vi.fn().mockResolvedValue(null),
			list: vi
				.fn()
				.mockResolvedValue({ products: [], total: 0, page: 1, limit: 20 }),
			update: vi.fn().mockResolvedValue(null),
			delete: vi.fn().mockResolvedValue(undefined),
			...overrides.product,
		},
		variant: {
			create: vi.fn().mockResolvedValue(makeVariant("prod_1")),
			getById: vi.fn().mockResolvedValue(null),
			update: vi.fn().mockResolvedValue(null),
			delete: vi.fn().mockResolvedValue(undefined),
			...overrides.variant,
		},
		category: {
			create: vi.fn().mockResolvedValue(defaultCategory),
			getById: vi.fn().mockResolvedValue(null),
			getBySlug: vi.fn().mockResolvedValue(null),
			list: vi
				.fn()
				.mockResolvedValue({ categories: [], total: 0, page: 1, limit: 20 }),
			update: vi.fn().mockResolvedValue(null),
			delete: vi.fn().mockResolvedValue(undefined),
			...overrides.category,
		},
		bulk: {
			updateStatus: vi.fn().mockResolvedValue({ updated: 0 }),
			deleteMany: vi.fn().mockResolvedValue({ deleted: 0 }),
			...overrides.bulk,
		},
		import: {
			importProducts: vi
				.fn()
				.mockResolvedValue({ created: 0, updated: 0, errors: [] }),
			...overrides.import,
		},
		collection: {
			create: vi.fn().mockResolvedValue(defaultCollection),
			getById: vi.fn().mockResolvedValue(null),
			getBySlug: vi.fn().mockResolvedValue(null),
			list: vi
				.fn()
				.mockResolvedValue({ collections: [], total: 0, page: 1, limit: 20 }),
			update: vi.fn().mockResolvedValue(null),
			delete: vi.fn().mockResolvedValue({ success: true }),
			addProduct: vi.fn().mockResolvedValue(null),
			removeProduct: vi.fn().mockResolvedValue({ success: true }),
			listProducts: vi.fn().mockResolvedValue({ products: [] }),
			...overrides.collection,
		},
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controllers?: ProductControllers;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: opts.controllers ?? makeControllers(),
			data: {
				get: vi.fn().mockResolvedValue(null),
				findMany: vi.fn().mockResolvedValue([]),
				upsert: vi.fn().mockResolvedValue(undefined),
				delete: vi.fn().mockResolvedValue(undefined),
			},
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const createProductHandler = extractHandler(createProduct);
const getProductHandler = extractHandler(adminGetProduct);
const listProductsHandler = extractHandler(adminListProducts);
const updateProductHandler = extractHandler(updateProduct);
const deleteProductHandler = extractHandler(deleteProduct);
const createVariantHandler = extractHandler(createVariant);
const updateVariantHandler = extractHandler(updateVariant);
const deleteVariantHandler = extractHandler(deleteVariant);
const createCategoryHandler = extractHandler(createCategory);
const listCategoriesHandler = extractHandler(adminListCategories);
const updateCategoryHandler = extractHandler(updateCategory);
const deleteCategoryHandler = extractHandler(deleteCategory);
const bulkActionHandler = extractHandler(bulkAction);
const importProductsHandler = extractHandler(importProducts);
const createCollectionHandler = extractHandler(createCollection);
const listCollectionsHandler = extractHandler(adminListCollections);
const updateCollectionHandler = extractHandler(updateCollection);
const deleteCollectionHandler = extractHandler(deleteCollection);
const addCollectionProductHandler = extractHandler(addCollectionProduct);
const removeCollectionProductHandler = extractHandler(removeCollectionProduct);
const createCatalogRevisionDraftHandler = extractHandler(
	createCatalogRevisionDraft,
);
const reviewCatalogRevisionHandler = extractHandler(reviewCatalogRevision);
const publishCatalogRevisionHandler = extractHandler(publishCatalogRevision);

// ── createProduct ─────────────────────────────────────────────────────────────

describe("admin POST /products/create", () => {
	it("returns 400 when slug is already taken", async () => {
		const existing = makeProduct({ slug: "taken-slug" });
		const controllers = makeControllers({
			product: { getBySlug: vi.fn().mockResolvedValue(existing) },
		});
		const result = (await call(createProductHandler, {
			body: { name: "New Product", slug: "taken-slug", price: 999 },
			controllers,
		})) as { error: string; status: number };
		expect(result.status).toBe(400);
		expect(result.error).toMatch(/slug already exists/i);
	});

	it("creates product when slug is unique", async () => {
		const product = makeProduct({ name: "Widget", slug: "widget" });
		const controllers = makeControllers({
			product: {
				getBySlug: vi.fn().mockResolvedValue(null),
				create: vi.fn().mockResolvedValue(product),
			},
		});
		const result = (await call(createProductHandler, {
			body: { name: "Widget", slug: "widget", price: 1500 },
			controllers,
		})) as { product: Product; status: number };
		expect(result.product.name).toBe("Widget");
		expect(result.status).toBe(201);
	});
});

// ── adminGetProduct ───────────────────────────────────────────────────────────

describe("admin GET /products/:id", () => {
	it("returns 404 when product not found", async () => {
		const result = (await call(getProductHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Product not found");
	});

	it("returns product with variants when found", async () => {
		const product = makeProductWithVariants({ id: "prod_1" });
		const controllers = makeControllers({
			product: {
				getWithVariants: vi.fn().mockResolvedValue(product),
			},
		});
		const result = (await call(getProductHandler, {
			params: { id: "prod_1" },
			controllers,
		})) as { product: ProductWithVariants };
		expect(result.product.id).toBe("prod_1");
		expect(result.product.variants).toHaveLength(0);
	});
});

// ── adminListProducts ─────────────────────────────────────────────────────────

describe("admin GET /products/list", () => {
	it("returns list result from controller", async () => {
		const products = [makeProductWithVariants()];
		const controllers = makeControllers({
			product: {
				list: vi
					.fn()
					.mockResolvedValue({ products, total: 1, page: 1, limit: 20 }),
			},
		});
		const result = (await call(listProductsHandler, { controllers })) as {
			products: ProductWithVariants[];
			total: number;
		};
		expect(result.products).toHaveLength(1);
		expect(result.total).toBe(1);
	});

	it("passes status filter to controller", async () => {
		const controllers = makeControllers();
		await call(listProductsHandler, {
			query: { status: "active" },
			controllers,
		});
		expect(controllers.product.list).toHaveBeenCalled();
	});
});

// ── updateProduct ─────────────────────────────────────────────────────────────

describe("admin PUT /products/:id/update", () => {
	it("returns 404 when product not found", async () => {
		const result = (await call(updateProductHandler, {
			params: { id: "missing" },
			body: { name: "Updated" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Product not found");
	});

	it("updates product and returns it", async () => {
		const existing = makeProduct({ id: "prod_2", slug: "prod-2" });
		const updated = makeProduct({
			id: "prod_2",
			name: "Updated",
			slug: "prod-2",
		});
		const controllers = makeControllers({
			product: {
				getById: vi.fn().mockResolvedValue(existing),
				getBySlug: vi.fn().mockResolvedValue(null),
				update: vi.fn().mockResolvedValue(updated),
			},
		});
		const result = (await call(updateProductHandler, {
			params: { id: "prod_2" },
			body: { name: "Updated" },
			controllers,
		})) as { product: Product };
		expect(result.product.name).toBe("Updated");
	});
});

// ── deleteProduct ─────────────────────────────────────────────────────────────

describe("admin DELETE /products/:id/delete", () => {
	it("returns 404 when product not found", async () => {
		const result = (await call(deleteProductHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("deletes product and returns success message", async () => {
		const existing = makeProduct({ id: "prod_3" });
		const controllers = makeControllers({
			product: {
				getById: vi.fn().mockResolvedValue(existing),
				delete: vi.fn().mockResolvedValue(undefined),
			},
		});
		const result = (await call(deleteProductHandler, {
			params: { id: "prod_3" },
			controllers,
		})) as { success: boolean; message: string };
		expect(result.success).toBe(true);
		expect(result.message).toMatch(/deleted/i);
	});
});

// ── createVariant ─────────────────────────────────────────────────────────────

describe("admin POST /products/:productId/variants", () => {
	it("returns 404 when parent product not found", async () => {
		const result = (await call(createVariantHandler, {
			params: { productId: "missing" },
			body: { name: "Small", price: 999, options: { size: "S" } },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Product not found");
	});

	it("creates variant and returns it with 201", async () => {
		const parent = makeProduct({ id: "prod_4" });
		const variant = makeVariant("prod_4", { name: "Small" });
		const controllers = makeControllers({
			product: {
				getById: vi.fn().mockResolvedValue(parent),
			},
			variant: {
				create: vi.fn().mockResolvedValue(variant),
			},
		});
		const result = (await call(createVariantHandler, {
			params: { productId: "prod_4" },
			body: { name: "Small", price: 999, options: { size: "S" } },
			controllers,
		})) as { variant: ProductVariant; status: number };
		expect(result.variant.name).toBe("Small");
		expect(result.status).toBe(201);
	});
});

// ── updateVariant ─────────────────────────────────────────────────────────────

describe("admin PUT /variants/:id/update", () => {
	it("returns 404 when variant not found", async () => {
		const result = (await call(updateVariantHandler, {
			params: { id: "missing" },
			body: { price: 2500 },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Variant not found");
	});

	it("updates variant and returns it", async () => {
		const existing = makeVariant("prod_5", { id: "var_1" });
		const updated = makeVariant("prod_5", { id: "var_1", price: 2500 });
		const controllers = makeControllers({
			product: {
				getById: vi.fn().mockResolvedValue(makeProduct({ id: "prod_5" })),
			},
			variant: {
				getById: vi.fn().mockResolvedValue(existing),
				update: vi.fn().mockResolvedValue(updated),
			},
		});
		const result = (await call(updateVariantHandler, {
			params: { id: "var_1" },
			body: { price: 2500 },
			controllers,
		})) as { variant: ProductVariant };
		expect(result.variant.price).toBe(2500);
	});
});

// ── deleteVariant ─────────────────────────────────────────────────────────────

describe("admin DELETE /variants/:id/delete", () => {
	it("returns 404 when variant not found", async () => {
		const result = (await call(deleteVariantHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("deletes variant and returns success", async () => {
		const existing = makeVariant("prod_6", { id: "var_2" });
		const controllers = makeControllers({
			variant: {
				getById: vi.fn().mockResolvedValue(existing),
				delete: vi.fn().mockResolvedValue(undefined),
			},
		});
		const result = (await call(deleteVariantHandler, {
			params: { id: "var_2" },
			controllers,
		})) as { success: boolean; message: string };
		expect(result.success).toBe(true);
		expect(result.message).toMatch(/deleted/i);
	});
});

// ── createCategory ────────────────────────────────────────────────────────────

describe("admin POST /categories/create", () => {
	it("returns 400 when slug is already taken", async () => {
		const existing = makeCategory({ slug: "electronics" });
		const controllers = makeControllers({
			category: {
				getBySlug: vi.fn().mockResolvedValue(existing),
			},
		});
		const result = (await call(createCategoryHandler, {
			body: { name: "Electronics", slug: "electronics" },
			controllers,
		})) as { error: string; status: number };
		expect(result.status).toBe(400);
		expect(result.error).toMatch(/slug already exists/i);
	});

	it("creates category when slug is unique", async () => {
		const category = makeCategory({ name: "Books", slug: "books" });
		const controllers = makeControllers({
			category: {
				getBySlug: vi.fn().mockResolvedValue(null),
				getById: vi.fn().mockResolvedValue(null),
				create: vi.fn().mockResolvedValue(category),
			},
		});
		const result = (await call(createCategoryHandler, {
			body: { name: "Books", slug: "books" },
			controllers,
		})) as { category: Category; status: number };
		expect(result.category.name).toBe("Books");
		expect(result.status).toBe(201);
	});
});

// ── adminListCategories ───────────────────────────────────────────────────────

describe("admin GET /categories/list", () => {
	it("returns list result from controller", async () => {
		const categories = [makeCategory()];
		const controllers = makeControllers({
			category: {
				list: vi
					.fn()
					.mockResolvedValue({ categories, total: 1, page: 1, limit: 20 }),
			},
		});
		const result = (await call(listCategoriesHandler, { controllers })) as {
			categories: Category[];
		};
		expect(result.categories).toHaveLength(1);
	});

	it("passes query to controller", async () => {
		const controllers = makeControllers();
		await call(listCategoriesHandler, {
			query: { visible: "true" },
			controllers,
		});
		expect(controllers.category.list).toHaveBeenCalled();
	});
});

// ── updateCategory ────────────────────────────────────────────────────────────

describe("admin PUT /categories/:id/update", () => {
	it("returns 404 when category not found", async () => {
		const result = (await call(updateCategoryHandler, {
			params: { id: "missing" },
			body: { name: "Updated" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Category not found");
	});

	it("returns 400 when category is set as its own parent", async () => {
		const existing = makeCategory({ id: "cat_1", slug: "cat-1" });
		const controllers = makeControllers({
			category: {
				getById: vi.fn().mockResolvedValue(existing),
				getBySlug: vi.fn().mockResolvedValue(null),
			},
		});
		const result = (await call(updateCategoryHandler, {
			params: { id: "cat_1" },
			body: { parentId: "cat_1" },
			controllers,
		})) as { error: string; status: number };
		expect(result.status).toBe(400);
		expect(result.error).toMatch(/own parent/i);
	});
});

// ── deleteCategory ────────────────────────────────────────────────────────────

describe("admin DELETE /categories/:id/delete", () => {
	it("returns 404 when category not found", async () => {
		const result = (await call(deleteCategoryHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("deletes category and returns success", async () => {
		const existing = makeCategory({ id: "cat_2" });
		const controllers = makeControllers({
			category: {
				getById: vi.fn().mockResolvedValue(existing),
				delete: vi.fn().mockResolvedValue(undefined),
			},
		});
		const result = (await call(deleteCategoryHandler, {
			params: { id: "cat_2" },
			controllers,
		})) as { success: boolean; message: string };
		expect(result.success).toBe(true);
		expect(result.message).toMatch(/deleted/i);
	});
});

// ── bulkAction ────────────────────────────────────────────────────────────────

describe("admin POST /products/bulk", () => {
	it("returns 400 when updateStatus action is missing status", async () => {
		const result = (await call(bulkActionHandler, {
			body: { action: "updateStatus", ids: ["prod_1"] },
		})) as { error: string; status: number };
		expect(result.status).toBe(400);
		expect(result.error).toMatch(/status is required/i);
	});

	it("calls bulk.updateStatus with ids and status", async () => {
		const controllers = makeControllers({
			bulk: {
				updateStatus: vi.fn().mockResolvedValue({ updated: 3 }),
			},
		});
		const result = (await call(bulkActionHandler, {
			body: {
				action: "updateStatus",
				ids: ["p1", "p2", "p3"],
				status: "archived",
			},
			controllers,
		})) as { updated: number };
		expect(result.updated).toBe(3);
		expect(controllers.bulk.updateStatus).toHaveBeenCalled();
	});
});

// ── importProducts ────────────────────────────────────────────────────────────

describe("admin POST /products/import", () => {
	it("keeps direct spreadsheet mutation contained across retries", async () => {
		const controllers = makeControllers({
			import: {
				importProducts: vi
					.fn()
					.mockResolvedValue({ created: 5, updated: 2, errors: [] }),
			},
		});
		const request = () =>
			call(importProductsHandler, {
				body: { products: [{ name: "Widget A", price: 999 }] },
				controllers,
			});

		await expect(request()).resolves.toEqual({
			code: "PRODUCT_IMPORT_REVIEW_REQUIRED",
			error:
				"Direct Product import is unavailable until the validated draft, Review, and immutable publish pipeline is configured.",
			status: 503,
		});
		await expect(request()).resolves.toMatchObject({
			code: "PRODUCT_IMPORT_REVIEW_REQUIRED",
			status: 503,
		});
		expect(controllers.import.importProducts).not.toHaveBeenCalled();
	});
});

// ── createCollection ──────────────────────────────────────────────────────────

describe("admin POST /products/collections/create", () => {
	it("returns 400 when slug is already taken", async () => {
		const existing = makeCollection({ slug: "summer-sale" });
		const controllers = makeControllers({
			collection: {
				getBySlug: vi.fn().mockResolvedValue(existing),
			},
		});
		const result = (await call(createCollectionHandler, {
			body: { name: "Summer Sale", slug: "summer-sale" },
			controllers,
		})) as { error: string; status: number };
		expect(result.status).toBe(400);
		expect(result.error).toMatch(/slug already exists/i);
	});

	it("creates collection when slug is unique", async () => {
		const collection = makeCollection({
			name: "New Arrivals",
			slug: "new-arrivals",
		});
		const controllers = makeControllers({
			collection: {
				getBySlug: vi.fn().mockResolvedValue(null),
				create: vi.fn().mockResolvedValue(collection),
			},
		});
		const result = (await call(createCollectionHandler, {
			body: { name: "New Arrivals", slug: "new-arrivals" },
			controllers,
		})) as { collection: Collection; status: number };
		expect(result.collection.name).toBe("New Arrivals");
		expect(result.status).toBe(201);
	});
});

// ── adminListCollections ──────────────────────────────────────────────────────

describe("admin GET /products/collections/list", () => {
	it("returns list result from controller", async () => {
		const collections = [makeCollection()];
		const controllers = makeControllers({
			collection: {
				list: vi
					.fn()
					.mockResolvedValue({ collections, total: 1, page: 1, limit: 20 }),
			},
		});
		const result = (await call(listCollectionsHandler, { controllers })) as {
			collections: Collection[];
		};
		expect(result.collections).toHaveLength(1);
	});

	it("passes featured filter to controller", async () => {
		const controllers = makeControllers();
		await call(listCollectionsHandler, {
			query: { featured: "true" },
			controllers,
		});
		expect(controllers.collection.list).toHaveBeenCalled();
	});
});

// ── updateCollection ──────────────────────────────────────────────────────────

describe("admin PUT /products/collections/:id/update", () => {
	it("returns updated collection from controller", async () => {
		const updated = makeCollection({ id: "col_1", name: "Renamed" });
		const controllers = makeControllers({
			collection: {
				update: vi.fn().mockResolvedValue(updated),
			},
		});
		const result = (await call(updateCollectionHandler, {
			params: { id: "col_1" },
			body: { name: "Renamed" },
			controllers,
		})) as { collection: Collection };
		expect(result.collection.name).toBe("Renamed");
		expect(controllers.collection.update).toHaveBeenCalled();
	});

	it("passes id and body to controller", async () => {
		const controllers = makeControllers({
			collection: {
				update: vi.fn().mockResolvedValue(makeCollection()),
			},
		});
		await call(updateCollectionHandler, {
			params: { id: "col_2" },
			body: { isFeatured: true },
			controllers,
		});
		expect(controllers.collection.update).toHaveBeenCalled();
	});
});

// ── deleteCollection ──────────────────────────────────────────────────────────

describe("admin DELETE /products/collections/:id/delete", () => {
	it("calls collection.delete and returns success", async () => {
		const controllers = makeControllers({
			collection: {
				delete: vi.fn().mockResolvedValue({ success: true }),
			},
		});
		const result = (await call(deleteCollectionHandler, {
			params: { id: "col_3" },
			controllers,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(controllers.collection.delete).toHaveBeenCalled();
	});

	it("passes id param to controller", async () => {
		const controllers = makeControllers({
			collection: {
				delete: vi.fn().mockResolvedValue({ success: true }),
			},
		});
		await call(deleteCollectionHandler, {
			params: { id: "col_4" },
			controllers,
		});
		expect(controllers.collection.delete).toHaveBeenCalled();
	});
});

// ── addCollectionProduct ──────────────────────────────────────────────────────

describe("admin POST /products/collections/:id/products", () => {
	it("adds product to collection and returns link with 201", async () => {
		const link = makeCollectionProduct("col_5", "prod_5");
		const controllers = makeControllers({
			collection: {
				addProduct: vi.fn().mockResolvedValue(link),
			},
		});
		const result = (await call(addCollectionProductHandler, {
			params: { id: "col_5" },
			body: { productId: "prod_5" },
			controllers,
		})) as { link: CollectionProduct; status: number };
		expect(result.link.collectionId).toBe("col_5");
		expect(result.link.productId).toBe("prod_5");
		expect(result.status).toBe(201);
	});

	it("passes position to controller", async () => {
		const link = makeCollectionProduct("col_6", "prod_6");
		const controllers = makeControllers({
			collection: {
				addProduct: vi.fn().mockResolvedValue(link),
			},
		});
		await call(addCollectionProductHandler, {
			params: { id: "col_6" },
			body: { productId: "prod_6", position: 3 },
			controllers,
		});
		expect(controllers.collection.addProduct).toHaveBeenCalled();
	});
});

// ── removeCollectionProduct ───────────────────────────────────────────────────

describe("admin DELETE /products/collections/:id/products/:productId/remove", () => {
	it("removes product from collection and returns success", async () => {
		const controllers = makeControllers({
			collection: {
				removeProduct: vi.fn().mockResolvedValue({ success: true }),
			},
		});
		const result = (await call(removeCollectionProductHandler, {
			params: { id: "col_7", productId: "prod_7" },
			controllers,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(controllers.collection.removeProduct).toHaveBeenCalled();
	});

	it("passes both id and productId params to controller", async () => {
		const controllers = makeControllers({
			collection: {
				removeProduct: vi.fn().mockResolvedValue({ success: true }),
			},
		});
		await call(removeCollectionProductHandler, {
			params: { id: "col_8", productId: "prod_8" },
			controllers,
		});
		expect(controllers.collection.removeProduct).toHaveBeenCalled();
	});
});

const catalogDraftBody = {
	operationId: "catalog-draft-0001",
	revisionId: "revision-1",
	content: {
		version: 1,
		currency: "USD",
		categories: [],
		products: [
			{
				id: "product-leash",
				name: "Trail Leash",
				slug: "trail-leash",
				price: 2500,
				status: "active",
				images: [],
				tags: [],
				metadata: {},
				isFeatured: false,
			},
		],
		variants: [],
	},
};

describe("admin Catalog revision writes", () => {
	it("requires the authenticated Store Command transport for draft", async () => {
		const result = (await call(createCatalogRevisionDraftHandler, {
			body: catalogDraftBody,
		})) as { code: string; error: string; status: number };
		expect(result.status).toBe(503);
		expect(result.code).toBe("CATALOG_COMMAND_TRANSPORT_REQUIRED");
	});

	it("requires the authenticated Store Command transport for review", async () => {
		const result = (await call(reviewCatalogRevisionHandler, {
			params: { id: "revision-1" },
			body: {
				operationId: "catalog-review-0001",
				expectedContentDigest: "a".repeat(64),
			},
		})) as { code: string; error: string; status: number };
		expect(result.status).toBe(503);
		expect(result.code).toBe("CATALOG_COMMAND_TRANSPORT_REQUIRED");
	});

	it("requires the authenticated Store Command transport for publish", async () => {
		const result = (await call(publishCatalogRevisionHandler, {
			params: { id: "revision-1" },
			body: {
				operationId: "catalog-publish-0001",
				expectedContentDigest: "a".repeat(64),
			},
		})) as { code: string; error: string; status: number };
		expect(result.status).toBe(503);
		expect(result.code).toBe("CATALOG_COMMAND_TRANSPORT_REQUIRED");
	});
});
