import {
	createMockDataService,
	makeControllerCtx,
} from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type {
	Category,
	Collection,
	CollectionWithProducts,
	Product,
	ProductVariant,
	ProductWithVariants,
} from "../controllers";
import { controllers } from "../controllers";

/**
 * Store endpoint integration tests for the products module.
 *
 * These tests verify the business logic in store-facing endpoints that
 * goes beyond simple controller delegation:
 *
 * 1. ID-or-slug lookup (fallback to slug when ID not found)
 * 2. Visibility/status filtering (only active products, visible categories/collections)
 * 3. Related product retrieval based on shared category/tags
 * 4. Featured product filtering
 * 5. Store search (command palette) combining products, collections, and quick links
 * 6. Category with optional product inclusion
 */

// ── Sample data factories ─────────────────────────────────────────────

function makeProduct(overrides: Partial<Product> = {}): Product {
	const now = new Date();
	return {
		id: "prod_1",
		name: "Test Product",
		slug: "test-product",
		price: 2999,
		inventory: 10,
		trackInventory: true,
		allowBackorder: false,
		status: "active",
		images: [],
		tags: ["test"],
		isFeatured: false,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeVariant(overrides: Partial<ProductVariant> = {}): ProductVariant {
	const now = new Date();
	return {
		id: "var_1",
		productId: "prod_1",
		name: "Default",
		price: 2999,
		inventory: 5,
		options: { size: "M" },
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
		id: "cat_1",
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
		id: "col_1",
		name: "Summer Sale",
		slug: "summer-sale",
		isFeatured: false,
		position: 0,
		isVisible: true,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

// ── Helpers ───────────────────────────────────────────────────────────

type DataService = ReturnType<typeof createMockDataService>;

/**
 * Simulate the store get-product endpoint logic:
 * 1. Try getWithVariants by ID
 * 2. If not found, try getBySlug then getWithVariants
 * 3. If not found or not active, return 404
 */
async function simulateGetProduct(
	data: DataService,
	id: string,
): Promise<
	{ product: ProductWithVariants } | { error: string; status: number }
> {
	const ctx = makeControllerCtx(data, { params: { id } });

	let product = (await controllers.product.getWithVariants(
		ctx,
	)) as ProductWithVariants | null;

	if (!product) {
		const bySlug = (await controllers.product.getBySlug({
			...ctx,
			query: { slug: id },
		})) as Product | null;
		if (bySlug) {
			product = (await controllers.product.getWithVariants({
				...ctx,
				params: { id: bySlug.id },
			})) as ProductWithVariants | null;
		}
	}

	if (!product) {
		return { error: "Product not found", status: 404 };
	}

	if (product.status !== "active") {
		return { error: "Product not found", status: 404 };
	}

	return { product };
}

/**
 * Simulate the store get-category endpoint logic:
 * 1. Try getById
 * 2. If not found, try getBySlug
 * 3. If not found or not visible, return 404
 * 4. Optionally include products
 */
async function simulateGetCategory(
	data: DataService,
	id: string,
	includeProducts = false,
): Promise<
	| { category: Category; products?: unknown[] }
	| { error: string; status: number }
> {
	const ctx = makeControllerCtx(data, { params: { id } });

	let category = (await controllers.category.getById(ctx)) as Category | null;

	if (!category) {
		category = (await controllers.category.getBySlug({
			...ctx,
			query: { slug: id },
		})) as Category | null;
	}

	if (!category) {
		return { error: "Category not found", status: 404 };
	}

	if (!category.isVisible) {
		return { error: "Category not found", status: 404 };
	}

	if (includeProducts) {
		const products = (await controllers.product.getByCategory({
			...ctx,
			params: { categoryId: category.id },
		})) as Product[];
		return { category, products };
	}

	return { category };
}

/**
 * Simulate the store get-collection endpoint logic:
 * 1. Try getWithProducts by ID
 * 2. If not found, try getBySlug then getWithProducts
 * 3. If not found or not visible, return 404
 */
async function simulateGetCollection(
	data: DataService,
	id: string,
): Promise<
	{ collection: CollectionWithProducts } | { error: string; status: number }
> {
	const ctx = makeControllerCtx(data, { params: { id } });

	let collection = (await controllers.collection.getWithProducts(
		ctx,
	)) as CollectionWithProducts | null;

	if (!collection) {
		const bySlug = (await controllers.collection.getBySlug({
			...ctx,
			query: { slug: id },
		})) as Collection | null;
		if (bySlug) {
			collection = (await controllers.collection.getWithProducts({
				...ctx,
				params: { id: bySlug.id },
			})) as CollectionWithProducts | null;
		}
	}

	if (!collection) {
		return { error: "Collection not found", status: 404 };
	}

	if (!collection.isVisible) {
		return { error: "Collection not found", status: 404 };
	}

	return { collection };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("store endpoint: get product", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns product when found by ID", async () => {
		const product = makeProduct();
		await data.upsert("product", product.id, product);

		const result = await simulateGetProduct(data, "prod_1");
		expect("product" in result).toBe(true);
		if (!("product" in result)) {
			throw new Error("expected 'product' in result");
		}
		expect(result.product.id).toBe("prod_1");
		expect(result.product.name).toBe("Test Product");
	});

	it("falls back to slug when ID is not found", async () => {
		const product = makeProduct({ id: "prod_abc", slug: "my-widget" });
		await data.upsert("product", product.id, product);

		const result = await simulateGetProduct(data, "my-widget");
		expect("product" in result).toBe(true);
		if (!("product" in result)) {
			throw new Error("expected 'product' in result");
		}
		expect(result.product.id).toBe("prod_abc");
		expect(result.product.slug).toBe("my-widget");
	});

	it("returns 404 when neither ID nor slug matches", async () => {
		const result = await simulateGetProduct(data, "nonexistent");
		expect(result).toEqual({ error: "Product not found", status: 404 });
	});

	it("returns 404 for draft products", async () => {
		const product = makeProduct({ status: "draft" });
		await data.upsert("product", product.id, product);

		const result = await simulateGetProduct(data, "prod_1");
		expect(result).toEqual({ error: "Product not found", status: 404 });
	});

	it("returns 404 for archived products", async () => {
		const product = makeProduct({ status: "archived" });
		await data.upsert("product", product.id, product);

		const result = await simulateGetProduct(data, "prod_1");
		expect(result).toEqual({ error: "Product not found", status: 404 });
	});

	it("returns 404 for draft products found by slug", async () => {
		const product = makeProduct({
			id: "prod_draft",
			slug: "draft-item",
			status: "draft",
		});
		await data.upsert("product", product.id, product);

		const result = await simulateGetProduct(data, "draft-item");
		expect(result).toEqual({ error: "Product not found", status: 404 });
	});

	it("includes variants when product is found", async () => {
		const product = makeProduct();
		const variant = makeVariant({ id: "var_sm", name: "Small", price: 1999 });
		await data.upsert("product", product.id, product);
		await data.upsert("productVariant", variant.id, variant);

		const result = await simulateGetProduct(data, "prod_1");
		expect("product" in result).toBe(true);
		if (!("product" in result)) {
			throw new Error("expected 'product' in result");
		}
		expect(result.product.variants).toBeDefined();
		expect(result.product.variants).toHaveLength(1);
		expect(result.product.variants[0].name).toBe("Small");
	});

	it("prefers ID match over slug match", async () => {
		const productA = makeProduct({ id: "widget", slug: "product-a" });
		const productB = makeProduct({
			id: "prod_b",
			slug: "widget",
			name: "Widget By Slug",
		});
		await data.upsert("product", productA.id, productA);
		await data.upsert("product", productB.id, productB);

		const result = await simulateGetProduct(data, "widget");
		expect("product" in result).toBe(true);
		if (!("product" in result)) {
			throw new Error("expected 'product' in result");
		}
		// Should find productA by ID, not productB by slug
		expect(result.product.id).toBe("widget");
	});
});

describe("store endpoint: get category", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns category when found by ID", async () => {
		const category = makeCategory();
		await data.upsert("category", category.id, category);

		const result = await simulateGetCategory(data, "cat_1");
		expect("category" in result).toBe(true);
		if (!("category" in result)) {
			throw new Error("expected 'category' in result");
		}
		expect(result.category.name).toBe("Electronics");
	});

	it("falls back to slug when ID is not found", async () => {
		const category = makeCategory({ id: "cat_xyz", slug: "clothing" });
		await data.upsert("category", category.id, category);

		const result = await simulateGetCategory(data, "clothing");
		expect("category" in result).toBe(true);
		if (!("category" in result)) {
			throw new Error("expected 'category' in result");
		}
		expect(result.category.id).toBe("cat_xyz");
	});

	it("returns 404 when category not found", async () => {
		const result = await simulateGetCategory(data, "nonexistent");
		expect(result).toEqual({ error: "Category not found", status: 404 });
	});

	it("returns 404 for hidden categories", async () => {
		const category = makeCategory({ isVisible: false });
		await data.upsert("category", category.id, category);

		const result = await simulateGetCategory(data, "cat_1");
		expect(result).toEqual({ error: "Category not found", status: 404 });
	});

	it("returns 404 for hidden categories found by slug", async () => {
		const category = makeCategory({
			id: "cat_hidden",
			slug: "hidden-cat",
			isVisible: false,
		});
		await data.upsert("category", category.id, category);

		const result = await simulateGetCategory(data, "hidden-cat");
		expect(result).toEqual({ error: "Category not found", status: 404 });
	});

	it("does not include products by default", async () => {
		const category = makeCategory();
		await data.upsert("category", category.id, category);

		const result = await simulateGetCategory(data, "cat_1", false);
		expect("category" in result).toBe(true);
		if (!("category" in result)) {
			throw new Error("expected 'category' in result");
		}
		expect(result.products).toBeUndefined();
	});

	it("includes products when requested", async () => {
		const category = makeCategory();
		const product = makeProduct({ categoryId: "cat_1" });
		await data.upsert("category", category.id, category);
		await data.upsert("product", product.id, product);

		const result = await simulateGetCategory(data, "cat_1", true);
		expect("category" in result).toBe(true);
		if (!("category" in result)) {
			throw new Error("expected 'category' in result");
		}
		expect(result.products).toBeDefined();
		expect(result.products).toHaveLength(1);
	});
});

describe("store endpoint: get collection", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns collection when found by ID", async () => {
		const collection = makeCollection();
		await data.upsert("collection", collection.id, collection);

		const result = await simulateGetCollection(data, "col_1");
		expect("collection" in result).toBe(true);
		if (!("collection" in result)) {
			throw new Error("expected 'collection' in result");
		}
		expect(result.collection.name).toBe("Summer Sale");
	});

	it("falls back to slug when ID is not found", async () => {
		const collection = makeCollection({
			id: "col_xyz",
			slug: "winter-deals",
		});
		await data.upsert("collection", collection.id, collection);

		const result = await simulateGetCollection(data, "winter-deals");
		expect("collection" in result).toBe(true);
		if (!("collection" in result)) {
			throw new Error("expected 'collection' in result");
		}
		expect(result.collection.id).toBe("col_xyz");
	});

	it("returns 404 when collection not found", async () => {
		const result = await simulateGetCollection(data, "nonexistent");
		expect(result).toEqual({ error: "Collection not found", status: 404 });
	});

	it("returns 404 for hidden collections", async () => {
		const collection = makeCollection({ isVisible: false });
		await data.upsert("collection", collection.id, collection);

		const result = await simulateGetCollection(data, "col_1");
		expect(result).toEqual({ error: "Collection not found", status: 404 });
	});

	it("returns 404 for hidden collections found by slug", async () => {
		const collection = makeCollection({
			id: "col_hidden",
			slug: "secret-collection",
			isVisible: false,
		});
		await data.upsert("collection", collection.id, collection);

		const result = await simulateGetCollection(data, "secret-collection");
		expect(result).toEqual({ error: "Collection not found", status: 404 });
	});

	it("includes products in collection response", async () => {
		const collection = makeCollection();
		const product = makeProduct();
		await data.upsert("collection", collection.id, collection);
		await data.upsert("product", product.id, product);
		await data.upsert("collection_product", "cp_1", {
			id: "cp_1",
			collectionId: "col_1",
			productId: "prod_1",
			position: 0,
		});

		const result = await simulateGetCollection(data, "col_1");
		expect("collection" in result).toBe(true);
		if (!("collection" in result)) {
			throw new Error("expected 'collection' in result");
		}
		expect(result.collection.products).toBeDefined();
	});
});

describe("store endpoint: list products", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns all active products with pagination", async () => {
		for (let i = 1; i <= 5; i++) {
			await data.upsert(
				"product",
				`prod_${i}`,
				makeProduct({
					id: `prod_${i}`,
					name: `Widget ${i}`,
					slug: `widget-${i}`,
					status: "active",
				}),
			);
		}
		const ctx = makeControllerCtx(data, { query: { page: "1", limit: "3" } });
		const result = (await controllers.product.list(ctx)) as {
			products: unknown[];
			total: number;
			page: number;
			limit: number;
		};
		expect(result.products).toHaveLength(3);
		expect(result.total).toBe(5);
		expect(result.page).toBe(1);
		expect(result.limit).toBe(3);
	});

	it("filters by featured=true", async () => {
		await data.upsert(
			"product",
			"featured_1",
			makeProduct({
				id: "featured_1",
				name: "Featured",
				slug: "featured",
				isFeatured: true,
			}),
		);
		await data.upsert(
			"product",
			"normal_1",
			makeProduct({
				id: "normal_1",
				name: "Normal",
				slug: "normal",
				isFeatured: false,
			}),
		);

		const ctx = makeControllerCtx(data, { query: { featured: "true" } });
		const result = (await controllers.product.list(ctx)) as {
			products: unknown[];
			total: number;
		};
		expect(result.total).toBe(1);
	});

	it("filters by price range", async () => {
		await data.upsert(
			"product",
			"cheap",
			makeProduct({ id: "cheap", name: "Cheap", slug: "cheap", price: 500 }),
		);
		await data.upsert(
			"product",
			"mid",
			makeProduct({ id: "mid", name: "Mid", slug: "mid", price: 2000 }),
		);
		await data.upsert(
			"product",
			"expensive",
			makeProduct({
				id: "expensive",
				name: "Expensive",
				slug: "expensive",
				price: 9999,
			}),
		);

		const ctx = makeControllerCtx(data, {
			query: { minPrice: "1000", maxPrice: "5000" },
		});
		const result = (await controllers.product.list(ctx)) as {
			products: unknown[];
			total: number;
		};
		expect(result.total).toBe(1);
	});

	it("filters by search term", async () => {
		await data.upsert(
			"product",
			"match",
			makeProduct({
				id: "match",
				name: "Blue Widget",
				slug: "blue-widget",
				tags: ["blue"],
			}),
		);
		await data.upsert(
			"product",
			"nomatch",
			makeProduct({
				id: "nomatch",
				name: "Red Gadget",
				slug: "red-gadget",
				tags: ["red"],
			}),
		);

		const ctx = makeControllerCtx(data, { query: { search: "blue" } });
		const result = (await controllers.product.list(ctx)) as {
			products: unknown[];
			total: number;
		};
		expect(result.total).toBe(1);
	});

	it("filters by tag", async () => {
		await data.upsert(
			"product",
			"tagged",
			makeProduct({
				id: "tagged",
				name: "Tagged",
				slug: "tagged",
				tags: ["sale"],
			}),
		);
		await data.upsert(
			"product",
			"untagged",
			makeProduct({
				id: "untagged",
				name: "Untagged",
				slug: "untagged",
				tags: [],
			}),
		);

		const ctx = makeControllerCtx(data, { query: { tag: "sale" } });
		const result = (await controllers.product.list(ctx)) as {
			products: unknown[];
			total: number;
		};
		expect(result.total).toBe(1);
	});

	it("returns empty list when no products exist", async () => {
		const ctx = makeControllerCtx(data, {});
		const result = (await controllers.product.list(ctx)) as {
			products: unknown[];
			total: number;
		};
		expect(result.products).toHaveLength(0);
		expect(result.total).toBe(0);
	});
});

describe("store endpoint: get featured products", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns only featured active products", async () => {
		await data.upsert(
			"product",
			"f1",
			makeProduct({ id: "f1", slug: "f1", isFeatured: true, status: "active" }),
		);
		await data.upsert(
			"product",
			"f2",
			makeProduct({
				id: "f2",
				slug: "f2",
				isFeatured: false,
				status: "active",
			}),
		);
		await data.upsert(
			"product",
			"f3",
			makeProduct({ id: "f3", slug: "f3", isFeatured: true, status: "draft" }),
		);

		const ctx = makeControllerCtx(data, {});
		const products = (await controllers.product.getFeatured(ctx)) as unknown[];
		expect(products).toHaveLength(1);
		expect((products[0] as { id: string }).id).toBe("f1");
	});

	it("respects limit query parameter", async () => {
		for (let i = 1; i <= 10; i++) {
			await data.upsert(
				"product",
				`fp${i}`,
				makeProduct({
					id: `fp${i}`,
					slug: `fp${i}`,
					isFeatured: true,
					status: "active",
				}),
			);
		}

		const ctx = makeControllerCtx(data, { query: { limit: "3" } });
		const products = (await controllers.product.getFeatured(ctx)) as unknown[];
		expect(products).toHaveLength(3);
	});

	it("returns empty array when no featured products exist", async () => {
		await data.upsert(
			"product",
			"nfp",
			makeProduct({ id: "nfp", slug: "nfp", isFeatured: false }),
		);
		const ctx = makeControllerCtx(data, {});
		const products = (await controllers.product.getFeatured(ctx)) as unknown[];
		expect(products).toHaveLength(0);
	});
});

describe("store endpoint: get related products", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 0 products for nonexistent product", async () => {
		const ctx = makeControllerCtx(data, { params: { id: "nonexistent" } });
		const result = (await controllers.product.getRelated(ctx)) as {
			products: unknown[];
		};
		expect(result.products).toHaveLength(0);
	});

	it("prefers products in the same category", async () => {
		await data.upsert(
			"product",
			"p_main",
			makeProduct({
				id: "p_main",
				slug: "p-main",
				categoryId: "cat_1",
				tags: [],
			}),
		);
		await data.upsert(
			"product",
			"p_same_cat",
			makeProduct({
				id: "p_same_cat",
				slug: "p-same-cat",
				categoryId: "cat_1",
				tags: [],
			}),
		);
		await data.upsert(
			"product",
			"p_diff_cat",
			makeProduct({
				id: "p_diff_cat",
				slug: "p-diff-cat",
				categoryId: "cat_2",
				tags: [],
			}),
		);

		const ctx = makeControllerCtx(data, { params: { id: "p_main" } });
		const result = (await controllers.product.getRelated(ctx)) as {
			products: Array<{ id: string }>;
		};

		// Same-category product should score higher and appear first
		expect(result.products[0].id).toBe("p_same_cat");
	});

	it("excludes the source product from related results", async () => {
		await data.upsert(
			"product",
			"p_a",
			makeProduct({ id: "p_a", slug: "p-a", tags: ["blue"] }),
		);
		await data.upsert(
			"product",
			"p_b",
			makeProduct({ id: "p_b", slug: "p-b", tags: ["blue"] }),
		);

		const ctx = makeControllerCtx(data, { params: { id: "p_a" } });
		const result = (await controllers.product.getRelated(ctx)) as {
			products: Array<{ id: string }>;
		};
		expect(result.products.every((p) => p.id !== "p_a")).toBe(true);
	});

	it("respects limit query parameter", async () => {
		for (let i = 1; i <= 8; i++) {
			await data.upsert(
				"product",
				`rp${i}`,
				makeProduct({ id: `rp${i}`, slug: `rp${i}`, categoryId: "cat_1" }),
			);
		}

		const ctx = makeControllerCtx(data, {
			params: { id: "rp1" },
			query: { limit: "2" },
		});
		const result = (await controllers.product.getRelated(ctx)) as {
			products: unknown[];
		};
		expect(result.products).toHaveLength(2);
	});
});

describe("store endpoint: search products", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns products matching the search term by name", async () => {
		await data.upsert(
			"product",
			"sp1",
			makeProduct({
				id: "sp1",
				slug: "sp1",
				name: "Blue Widget",
				status: "active",
				tags: [],
			}),
		);
		await data.upsert(
			"product",
			"sp2",
			makeProduct({
				id: "sp2",
				slug: "sp2",
				name: "Red Gadget",
				status: "active",
				tags: [],
			}),
		);

		const ctx = makeControllerCtx(data, { query: { q: "widget" } });
		const results = (await controllers.product.search(ctx)) as unknown[];
		expect(results).toHaveLength(1);
		expect((results[0] as { id: string }).id).toBe("sp1");
	});

	it("searches by tag", async () => {
		await data.upsert(
			"product",
			"tagged",
			makeProduct({
				id: "tagged",
				slug: "tagged",
				name: "Generic",
				status: "active",
				tags: ["summer"],
			}),
		);
		await data.upsert(
			"product",
			"untagged",
			makeProduct({
				id: "untagged",
				slug: "untagged",
				name: "Generic",
				status: "active",
				tags: [],
			}),
		);

		const ctx = makeControllerCtx(data, { query: { q: "summer" } });
		const results = (await controllers.product.search(ctx)) as unknown[];
		expect(results).toHaveLength(1);
	});

	it("only returns active products", async () => {
		await data.upsert(
			"product",
			"active_p",
			makeProduct({
				id: "active_p",
				slug: "active-p",
				name: "Active Widget",
				status: "active",
				tags: [],
			}),
		);
		await data.upsert(
			"product",
			"draft_p",
			makeProduct({
				id: "draft_p",
				slug: "draft-p",
				name: "Draft Widget",
				status: "draft",
				tags: [],
			}),
		);

		const ctx = makeControllerCtx(data, { query: { q: "widget" } });
		const results = (await controllers.product.search(ctx)) as unknown[];
		expect(results).toHaveLength(1);
		expect((results[0] as { id: string }).id).toBe("active_p");
	});

	it("returns empty array when no products match", async () => {
		await data.upsert(
			"product",
			"no_match",
			makeProduct({
				id: "no_match",
				slug: "no-match",
				name: "Unrelated",
				status: "active",
				tags: [],
			}),
		);

		const ctx = makeControllerCtx(data, { query: { q: "xyznotfound" } });
		const results = (await controllers.product.search(ctx)) as unknown[];
		expect(results).toHaveLength(0);
	});
});

describe("store endpoint: list categories (category tree)", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns only visible categories in tree format", async () => {
		await data.upsert(
			"category",
			"cat_v",
			makeCategory({ id: "cat_v", slug: "visible", isVisible: true }),
		);
		await data.upsert(
			"category",
			"cat_h",
			makeCategory({ id: "cat_h", slug: "hidden", isVisible: false }),
		);

		const ctx = makeControllerCtx(data, {});
		const categories = (await controllers.category.getTree(ctx)) as unknown[];
		// Only visible category should appear
		expect(categories).toHaveLength(1);
		expect((categories[0] as { id: string }).id).toBe("cat_v");
	});

	it("returns empty array when no categories exist", async () => {
		const ctx = makeControllerCtx(data, {});
		const categories = (await controllers.category.getTree(ctx)) as unknown[];
		expect(categories).toHaveLength(0);
	});

	it("nests children under parent category", async () => {
		await data.upsert(
			"category",
			"parent",
			makeCategory({ id: "parent", slug: "parent", isVisible: true }),
		);
		await data.upsert(
			"category",
			"child",
			makeCategory({
				id: "child",
				slug: "child",
				parentId: "parent",
				isVisible: true,
			}),
		);

		const ctx = makeControllerCtx(data, {});
		const tree = (await controllers.category.getTree(ctx)) as Array<{
			id: string;
			children: unknown[];
		}>;
		expect(tree).toHaveLength(1);
		expect(tree[0].id).toBe("parent");
		expect(tree[0].children).toHaveLength(1);
		expect((tree[0].children[0] as { id: string }).id).toBe("child");
	});
});

describe("store endpoint: list collections", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns only visible collections", async () => {
		await data.upsert(
			"collection",
			"col_v",
			makeCollection({ id: "col_v", slug: "visible", isVisible: true }),
		);
		await data.upsert(
			"collection",
			"col_h",
			makeCollection({ id: "col_h", slug: "hidden", isVisible: false }),
		);

		const ctx = makeControllerCtx(data, { query: { visible: "true" } });
		const result = (await controllers.collection.list(ctx)) as {
			collections: unknown[];
		};
		expect(result.collections).toHaveLength(1);
		expect((result.collections[0] as { id: string }).id).toBe("col_v");
	});

	it("filters by featured=true", async () => {
		await data.upsert(
			"collection",
			"col_f",
			makeCollection({
				id: "col_f",
				slug: "featured",
				isFeatured: true,
				isVisible: true,
			}),
		);
		await data.upsert(
			"collection",
			"col_n",
			makeCollection({
				id: "col_n",
				slug: "normal",
				isFeatured: false,
				isVisible: true,
			}),
		);

		const ctx = makeControllerCtx(data, { query: { featured: "true" } });
		const result = (await controllers.collection.list(ctx)) as {
			collections: unknown[];
		};
		expect(result.collections).toHaveLength(1);
		expect((result.collections[0] as { id: string }).id).toBe("col_f");
	});

	it("returns empty list when no collections exist", async () => {
		const ctx = makeControllerCtx(data, {});
		const result = (await controllers.collection.list(ctx)) as {
			collections: unknown[];
		};
		expect(result.collections).toHaveLength(0);
	});

	it("paginates correctly", async () => {
		for (let i = 1; i <= 5; i++) {
			await data.upsert(
				"collection",
				`col${i}`,
				makeCollection({ id: `col${i}`, slug: `col${i}` }),
			);
		}
		const ctx = makeControllerCtx(data, { query: { page: "1", limit: "2" } });
		const result = (await controllers.collection.list(ctx)) as {
			collections: unknown[];
			page: number;
			limit: number;
		};
		expect(result.collections).toHaveLength(2);
		expect(result.page).toBe(1);
		expect(result.limit).toBe(2);
	});
});

describe("store endpoint: admin create product slug uniqueness", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	/**
	 * Simulates the admin create-product endpoint logic:
	 * check slug uniqueness before creating.
	 */
	async function simulateCreateProduct(
		ds: DataService,
		body: { name: string; slug: string; price: number },
	): Promise<
		{ product: Product; status: number } | { error: string; status: number }
	> {
		const ctx = makeControllerCtx(ds, { body, query: { slug: body.slug } });

		const existing = await controllers.product.getBySlug({
			...ctx,
			query: { slug: body.slug },
		});
		if (existing) {
			return { error: "A product with this slug already exists", status: 400 };
		}

		const product = await controllers.product.create(ctx);
		return { product: product as Product, status: 201 };
	}

	it("creates product when slug is unique", async () => {
		const result = await simulateCreateProduct(data, {
			name: "New Widget",
			slug: "new-widget",
			price: 1999,
		});
		expect(result.status).toBe(201);
		expect("product" in result).toBe(true);
	});

	it("rejects duplicate slug", async () => {
		const existing = makeProduct({ slug: "taken-slug" });
		await data.upsert("product", existing.id, existing);

		const result = await simulateCreateProduct(data, {
			name: "Another Widget",
			slug: "taken-slug",
			price: 2999,
		});
		expect(result.status).toBe(400);
		expect("error" in result && result.error).toContain("slug already exists");
	});

	it("allows different slugs for different products", async () => {
		const first = await simulateCreateProduct(data, {
			name: "Widget A",
			slug: "widget-a",
			price: 1000,
		});
		expect(first.status).toBe(201);

		const second = await simulateCreateProduct(data, {
			name: "Widget B",
			slug: "widget-b",
			price: 2000,
		});
		expect(second.status).toBe(201);
	});
});

describe("store endpoint: admin update product", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	/**
	 * Simulates the admin update-product endpoint logic:
	 * check existence, then slug uniqueness if slug changed.
	 */
	async function simulateUpdateProduct(
		ds: DataService,
		id: string,
		body: { name?: string; slug?: string; price?: number },
	): Promise<{ product: Product } | { error: string; status: number }> {
		const ctx = makeControllerCtx(ds, { params: { id }, body });

		const existing = (await controllers.product.getById(ctx)) as Product | null;
		if (!existing) {
			return { error: "Product not found", status: 404 };
		}

		if (body.slug && body.slug !== existing.slug) {
			const productWithSlug = await controllers.product.getBySlug({
				...ctx,
				query: { slug: body.slug },
			});
			if (productWithSlug) {
				return {
					error: "A product with this slug already exists",
					status: 400,
				};
			}
		}

		const product = (await controllers.product.update(ctx)) as Product;
		return { product };
	}

	it("updates product successfully", async () => {
		const product = makeProduct();
		await data.upsert("product", product.id, product);

		const result = await simulateUpdateProduct(data, "prod_1", {
			name: "Updated Name",
		});
		expect("product" in result).toBe(true);
		if (!("product" in result)) {
			throw new Error("expected 'product' in result");
		}
		expect(result.product.name).toBe("Updated Name");
	});

	it("returns 404 when product does not exist", async () => {
		const result = await simulateUpdateProduct(data, "nonexistent", {
			name: "Nope",
		});
		expect(result).toEqual({ error: "Product not found", status: 404 });
	});

	it("allows keeping the same slug", async () => {
		const product = makeProduct({ slug: "my-product" });
		await data.upsert("product", product.id, product);

		const result = await simulateUpdateProduct(data, "prod_1", {
			slug: "my-product",
		});
		expect("product" in result).toBe(true);
	});

	it("rejects changing to an existing slug", async () => {
		const productA = makeProduct({ id: "prod_a", slug: "slug-a" });
		const productB = makeProduct({ id: "prod_b", slug: "slug-b" });
		await data.upsert("product", productA.id, productA);
		await data.upsert("product", productB.id, productB);

		const result = await simulateUpdateProduct(data, "prod_b", {
			slug: "slug-a",
		});
		expect(result).toEqual({
			error: "A product with this slug already exists",
			status: 400,
		});
	});

	it("allows changing to a novel slug", async () => {
		const product = makeProduct({ slug: "old-slug" });
		await data.upsert("product", product.id, product);

		const result = await simulateUpdateProduct(data, "prod_1", {
			slug: "new-slug",
		});
		expect("product" in result).toBe(true);
		if (!("product" in result)) {
			throw new Error("expected 'product' in result");
		}
		expect(result.product.slug).toBe("new-slug");
	});
});

describe("store endpoint: admin delete product", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	/**
	 * Simulates the admin delete-product endpoint logic:
	 * check existence before deleting.
	 */
	async function simulateDeleteProduct(
		ds: DataService,
		id: string,
	): Promise<{ success: boolean } | { error: string; status: number }> {
		const ctx = makeControllerCtx(ds, { params: { id } });

		const existing = await controllers.product.getById(ctx);
		if (!existing) {
			return { error: "Product not found", status: 404 };
		}

		await controllers.product.delete(ctx);
		return { success: true };
	}

	it("deletes existing product", async () => {
		const product = makeProduct();
		await data.upsert("product", product.id, product);

		const result = await simulateDeleteProduct(data, "prod_1");
		expect(result).toEqual({ success: true });

		const ctx = makeControllerCtx(data, { params: { id: "prod_1" } });
		const deleted = await controllers.product.getById(ctx);
		expect(deleted).toBeNull();
	});

	it("returns 404 for nonexistent product", async () => {
		const result = await simulateDeleteProduct(data, "missing");
		expect(result).toEqual({ error: "Product not found", status: 404 });
	});
});

describe("store endpoint: admin bulk action", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	/**
	 * Simulates the admin bulk-action endpoint validation:
	 * updateStatus requires a status parameter.
	 */
	function simulateBulkActionValidation(body: {
		action: string;
		ids: string[];
		status?: string;
	}): { error: string; status: number } | null {
		if (body.action === "updateStatus" && !body.status) {
			return {
				error: "Status is required for updateStatus action",
				status: 400,
			};
		}
		if (body.action !== "updateStatus" && body.action !== "delete") {
			return { error: "Unknown action", status: 400 };
		}
		return null;
	}

	it("rejects updateStatus without status parameter", () => {
		const result = simulateBulkActionValidation({
			action: "updateStatus",
			ids: ["prod_1"],
		});
		expect(result).toEqual({
			error: "Status is required for updateStatus action",
			status: 400,
		});
	});

	it("accepts updateStatus with status parameter", () => {
		const result = simulateBulkActionValidation({
			action: "updateStatus",
			ids: ["prod_1"],
			status: "active",
		});
		expect(result).toBeNull();
	});

	it("accepts delete action without status", () => {
		const result = simulateBulkActionValidation({
			action: "delete",
			ids: ["prod_1"],
		});
		expect(result).toBeNull();
	});

	it("rejects unknown actions", () => {
		const result = simulateBulkActionValidation({
			action: "duplicate",
			ids: ["prod_1"],
		});
		expect(result).toEqual({ error: "Unknown action", status: 400 });
	});

	it("bulk updateStatus changes product statuses", async () => {
		const p1 = makeProduct({ id: "prod_1", status: "draft" });
		const p2 = makeProduct({ id: "prod_2", status: "draft" });
		await data.upsert("product", p1.id, p1);
		await data.upsert("product", p2.id, p2);

		const ctx = makeControllerCtx(data, {
			body: { ids: ["prod_1", "prod_2"], status: "active" },
		});
		await controllers.bulk.updateStatus(ctx);

		const updated1 = (await controllers.product.getById(
			makeControllerCtx(data, { params: { id: "prod_1" } }),
		)) as Product;
		const updated2 = (await controllers.product.getById(
			makeControllerCtx(data, { params: { id: "prod_2" } }),
		)) as Product;
		expect(updated1.status).toBe("active");
		expect(updated2.status).toBe("active");
	});

	it("bulk delete removes products", async () => {
		const p1 = makeProduct({ id: "prod_1" });
		const p2 = makeProduct({ id: "prod_2" });
		await data.upsert("product", p1.id, p1);
		await data.upsert("product", p2.id, p2);

		const ctx = makeControllerCtx(data, {
			body: { ids: ["prod_1", "prod_2"] },
		});
		await controllers.bulk.deleteMany(ctx);

		const gone1 = await controllers.product.getById(
			makeControllerCtx(data, { params: { id: "prod_1" } }),
		);
		const gone2 = await controllers.product.getById(
			makeControllerCtx(data, { params: { id: "prod_2" } }),
		);
		expect(gone1).toBeNull();
		expect(gone2).toBeNull();
	});
});
