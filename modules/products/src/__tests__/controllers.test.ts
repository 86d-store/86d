import {
	createMockDataService,
	makeControllerCtx,
} from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type {
	Category,
	Collection,
	CollectionProduct,
	CollectionWithProducts,
	ImportProductRow,
	ImportResult,
	Product,
	ProductVariant,
} from "../controllers";
import { controllers } from "../controllers";

/** Test helper: typed controller result that allows nested property access */
type R = {
	products: Product[];
	variants: ProductVariant[];
	categories: Category[];
	collections: (Collection & { products: Product[] })[];
	[key: string]: unknown;
};

// ── Sample data ────────────────────────────────────────────────────────────

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

// ── Tests ──────────────────────────────────────────────────────────────────

describe("product controllers", () => {
	let data: ReturnType<typeof createMockDataService>;

	beforeEach(() => {
		data = createMockDataService();
	});

	describe("getById", () => {
		it("returns product when found", async () => {
			const product = makeProduct();
			await data.upsert("product", product.id, product);

			const result = await controllers.product.getById(
				makeControllerCtx(data, { params: { id: "prod_1" } }),
			);
			expect(result).toMatchObject({ id: "prod_1", name: "Test Product" });
		});

		it("returns null when not found", async () => {
			const result = await controllers.product.getById(
				makeControllerCtx(data, { params: { id: "missing" } }),
			);
			expect(result).toBeNull();
		});
	});

	describe("getBySlug", () => {
		it("returns product matching slug", async () => {
			const product = makeProduct();
			await data.upsert("product", product.id, product);

			const result = await controllers.product.getBySlug(
				makeControllerCtx(data, { query: { slug: "test-product" } }),
			);
			expect(result).toMatchObject({ slug: "test-product" });
		});

		it("returns null when slug not found", async () => {
			const result = await controllers.product.getBySlug(
				makeControllerCtx(data, { query: { slug: "no-match" } }),
			);
			expect(result).toBeNull();
		});
	});

	describe("getWithVariants", () => {
		it("returns product with empty variants array when none exist", async () => {
			const product = makeProduct();
			await data.upsert("product", product.id, product);

			const result = (await controllers.product.getWithVariants(
				makeControllerCtx(data, { params: { id: "prod_1" } }),
			)) as R;
			expect(result).toMatchObject({ id: "prod_1" });
			expect(result.variants).toEqual([]);
			expect(result.category).toBeUndefined();
		});

		it("returns product with variants", async () => {
			const product = makeProduct();
			const variant = makeVariant();
			await data.upsert("product", product.id, product);
			await data.upsert("productVariant", variant.id, variant);

			const result = (await controllers.product.getWithVariants(
				makeControllerCtx(data, { params: { id: "prod_1" } }),
			)) as R;
			expect(result.variants).toHaveLength(1);
			expect(result.variants[0]).toMatchObject({ id: "var_1" });
		});

		it("returns product with category when categoryId is set", async () => {
			const category = makeCategory();
			const product = makeProduct({ categoryId: "cat_1" });
			await data.upsert("category", category.id, category);
			await data.upsert("product", product.id, product);

			const result = (await controllers.product.getWithVariants(
				makeControllerCtx(data, { params: { id: "prod_1" } }),
			)) as R;
			expect(result.category).toMatchObject({
				id: "cat_1",
				name: "Electronics",
			});
		});

		it("returns null when product not found", async () => {
			const result = await controllers.product.getWithVariants(
				makeControllerCtx(data, { params: { id: "missing" } }),
			);
			expect(result).toBeNull();
		});
	});

	describe("list", () => {
		it("returns products with default pagination", async () => {
			const product = makeProduct();
			await data.upsert("product", product.id, product);

			const result = (await controllers.product.list(
				makeControllerCtx(data),
			)) as R;
			expect(result.products).toHaveLength(1);
			expect(result.page).toBe(1);
			expect(result.limit).toBe(20);
		});

		it("filters by status", async () => {
			await data.upsert(
				"product",
				"p1",
				makeProduct({ id: "p1", status: "active" }),
			);
			await data.upsert(
				"product",
				"p2",
				makeProduct({ id: "p2", slug: "draft", status: "draft" }),
			);

			const result = (await controllers.product.list(
				makeControllerCtx(data, { query: { status: "draft" } }),
			)) as R;
			expect(result.products).toHaveLength(1);
			expect(result.products[0].status).toBe("draft");
		});

		it("filters by featured", async () => {
			await data.upsert(
				"product",
				"p1",
				makeProduct({ id: "p1", isFeatured: true }),
			);
			await data.upsert(
				"product",
				"p2",
				makeProduct({ id: "p2", slug: "p2", isFeatured: false }),
			);

			const result = (await controllers.product.list(
				makeControllerCtx(data, { query: { featured: "true" } }),
			)) as R;
			expect(result.products).toHaveLength(1);
			expect(result.products[0].isFeatured).toBe(true);
		});

		it("returns total count of matching products", async () => {
			for (let i = 1; i <= 5; i++) {
				await data.upsert(
					"product",
					`p${i}`,
					makeProduct({
						id: `p${i}`,
						slug: `product-${i}`,
						name: `Product ${i}`,
					}),
				);
			}

			const result = (await controllers.product.list(
				makeControllerCtx(data, { query: { limit: "2" } }),
			)) as R;
			expect(result.products).toHaveLength(2);
			expect(result.total).toBe(5);
		});

		it("filters by minPrice", async () => {
			await data.upsert(
				"product",
				"p1",
				makeProduct({ id: "p1", slug: "cheap", price: 1000 }),
			);
			await data.upsert(
				"product",
				"p2",
				makeProduct({ id: "p2", slug: "expensive", price: 5000 }),
			);

			const result = (await controllers.product.list(
				makeControllerCtx(data, { query: { minPrice: "3000" } }),
			)) as R;
			expect(result.products).toHaveLength(1);
			expect(result.products[0].price).toBe(5000);
			expect(result.total).toBe(1);
		});

		it("filters by maxPrice", async () => {
			await data.upsert(
				"product",
				"p1",
				makeProduct({ id: "p1", slug: "cheap", price: 1000 }),
			);
			await data.upsert(
				"product",
				"p2",
				makeProduct({ id: "p2", slug: "expensive", price: 5000 }),
			);

			const result = (await controllers.product.list(
				makeControllerCtx(data, { query: { maxPrice: "2000" } }),
			)) as R;
			expect(result.products).toHaveLength(1);
			expect(result.products[0].price).toBe(1000);
			expect(result.total).toBe(1);
		});

		it("filters by price range (min and max)", async () => {
			await data.upsert(
				"product",
				"p1",
				makeProduct({ id: "p1", slug: "cheap", price: 500 }),
			);
			await data.upsert(
				"product",
				"p2",
				makeProduct({ id: "p2", slug: "mid", price: 2500 }),
			);
			await data.upsert(
				"product",
				"p3",
				makeProduct({ id: "p3", slug: "expensive", price: 9999 }),
			);

			const result = (await controllers.product.list(
				makeControllerCtx(data, {
					query: { minPrice: "1000", maxPrice: "5000" },
				}),
			)) as R;
			expect(result.products).toHaveLength(1);
			expect(result.products[0].id).toBe("p2");
			expect(result.total).toBe(1);
		});

		it("filters by inStock", async () => {
			await data.upsert(
				"product",
				"p1",
				makeProduct({ id: "p1", slug: "in-stock", inventory: 10 }),
			);
			await data.upsert(
				"product",
				"p2",
				makeProduct({ id: "p2", slug: "out-of-stock", inventory: 0 }),
			);

			const result = (await controllers.product.list(
				makeControllerCtx(data, { query: { inStock: "true" } }),
			)) as R;
			expect(result.products).toHaveLength(1);
			expect(result.products[0].inventory).toBeGreaterThan(0);
			expect(result.total).toBe(1);
		});

		it("filters by tag", async () => {
			await data.upsert(
				"product",
				"p1",
				makeProduct({ id: "p1", slug: "sale-item", tags: ["sale", "new"] }),
			);
			await data.upsert(
				"product",
				"p2",
				makeProduct({
					id: "p2",
					slug: "regular-item",
					tags: ["featured"],
				}),
			);

			const result = (await controllers.product.list(
				makeControllerCtx(data, { query: { tag: "sale" } }),
			)) as R;
			expect(result.products).toHaveLength(1);
			expect(result.products[0].id).toBe("p1");
			expect(result.total).toBe(1);
		});

		it("tag filter is case-insensitive", async () => {
			await data.upsert(
				"product",
				"p1",
				makeProduct({ id: "p1", slug: "item", tags: ["Sale"] }),
			);

			const result = (await controllers.product.list(
				makeControllerCtx(data, { query: { tag: "sale" } }),
			)) as R;
			expect(result.products).toHaveLength(1);
		});

		it("filters by search text in name and description", async () => {
			await data.upsert(
				"product",
				"p1",
				makeProduct({
					id: "p1",
					slug: "p1",
					name: "Blue Widget",
					status: "active",
				}),
			);
			await data.upsert(
				"product",
				"p2",
				makeProduct({
					id: "p2",
					slug: "p2",
					name: "Red Gadget",
					description: "A blue-tinted gadget",
					status: "active",
				}),
			);
			await data.upsert(
				"product",
				"p3",
				makeProduct({
					id: "p3",
					slug: "p3",
					name: "Green Thing",
					status: "active",
				}),
			);

			const result = (await controllers.product.list(
				makeControllerCtx(data, { query: { search: "blue" } }),
			)) as R;
			expect(result.products).toHaveLength(2);
			expect(result.total).toBe(2);
		});

		it("combines multiple filters", async () => {
			await data.upsert(
				"product",
				"p1",
				makeProduct({
					id: "p1",
					slug: "cheap-in-stock",
					price: 1000,
					inventory: 5,
					tags: ["sale"],
				}),
			);
			await data.upsert(
				"product",
				"p2",
				makeProduct({
					id: "p2",
					slug: "expensive-in-stock",
					price: 9000,
					inventory: 3,
					tags: ["sale"],
				}),
			);
			await data.upsert(
				"product",
				"p3",
				makeProduct({
					id: "p3",
					slug: "cheap-out-of-stock",
					price: 1000,
					inventory: 0,
					tags: ["sale"],
				}),
			);

			const result = (await controllers.product.list(
				makeControllerCtx(data, {
					query: { maxPrice: "5000", inStock: "true", tag: "sale" },
				}),
			)) as R;
			expect(result.products).toHaveLength(1);
			expect(result.products[0].id).toBe("p1");
			expect(result.total).toBe(1);
		});
	});

	describe("search", () => {
		it("matches by name", async () => {
			await data.upsert(
				"product",
				"p1",
				makeProduct({ id: "p1", name: "Blue Widget", status: "active" }),
			);
			await data.upsert(
				"product",
				"p2",
				makeProduct({
					id: "p2",
					slug: "p2",
					name: "Red Gadget",
					status: "active",
				}),
			);

			const result = (await controllers.product.search(
				makeControllerCtx(data, { query: { q: "blue" } }),
			)) as Product[];
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Blue Widget");
		});

		it("matches by tag", async () => {
			await data.upsert(
				"product",
				"p1",
				makeProduct({ id: "p1", tags: ["sale", "featured"], status: "active" }),
			);
			await data.upsert(
				"product",
				"p2",
				makeProduct({ id: "p2", slug: "p2", tags: [], status: "active" }),
			);

			const result = (await controllers.product.search(
				makeControllerCtx(data, { query: { q: "sale" } }),
			)) as Product[];
			expect(result).toHaveLength(1);
		});

		it("limits results", async () => {
			for (let i = 1; i <= 5; i++) {
				await data.upsert(
					"product",
					`p${i}`,
					makeProduct({
						id: `p${i}`,
						slug: `widget-${i}`,
						name: `Widget ${i}`,
						status: "active",
					}),
				);
			}

			const result = (await controllers.product.search(
				makeControllerCtx(data, { query: { q: "widget", limit: "3" } }),
			)) as Product[];
			expect(result).toHaveLength(3);
		});
	});

	describe("getFeatured", () => {
		it("returns only featured active products", async () => {
			await data.upsert(
				"product",
				"p1",
				makeProduct({ id: "p1", isFeatured: true, status: "active" }),
			);
			await data.upsert(
				"product",
				"p2",
				makeProduct({
					id: "p2",
					slug: "p2",
					isFeatured: false,
					status: "active",
				}),
			);
			await data.upsert(
				"product",
				"p3",
				makeProduct({
					id: "p3",
					slug: "p3",
					isFeatured: true,
					status: "draft",
				}),
			);

			const result = (await controllers.product.getFeatured(
				makeControllerCtx(data),
			)) as Product[];
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe("p1");
		});
	});

	describe("getRelated", () => {
		it("returns products from the same category first", async () => {
			await data.upsert(
				"product",
				"target",
				makeProduct({
					id: "target",
					slug: "target",
					categoryId: "cat_1",
					tags: [],
					status: "active",
				}),
			);
			await data.upsert(
				"product",
				"same-cat",
				makeProduct({
					id: "same-cat",
					slug: "same-cat",
					categoryId: "cat_1",
					tags: [],
					status: "active",
				}),
			);
			await data.upsert(
				"product",
				"diff-cat",
				makeProduct({
					id: "diff-cat",
					slug: "diff-cat",
					categoryId: "cat_2",
					tags: [],
					status: "active",
				}),
			);

			const result = (await controllers.product.getRelated(
				makeControllerCtx(data, { params: { id: "target" } }),
			)) as R;
			expect(result.products).toHaveLength(2);
			expect(result.products[0].id).toBe("same-cat");
		});

		it("returns products with shared tags", async () => {
			await data.upsert(
				"product",
				"target",
				makeProduct({
					id: "target",
					slug: "target",
					tags: ["electronics", "sale"],
					status: "active",
				}),
			);
			await data.upsert(
				"product",
				"shared-2",
				makeProduct({
					id: "shared-2",
					slug: "shared-2",
					tags: ["electronics", "sale"],
					status: "active",
				}),
			);
			await data.upsert(
				"product",
				"shared-1",
				makeProduct({
					id: "shared-1",
					slug: "shared-1",
					tags: ["electronics"],
					status: "active",
				}),
			);
			await data.upsert(
				"product",
				"no-tags",
				makeProduct({
					id: "no-tags",
					slug: "no-tags",
					tags: [],
					status: "active",
				}),
			);

			const result = (await controllers.product.getRelated(
				makeControllerCtx(data, { params: { id: "target" } }),
			)) as R;
			expect(result.products).toHaveLength(3);
			// shared-2 has 2 shared tags, shared-1 has 1
			expect(result.products[0].id).toBe("shared-2");
			expect(result.products[1].id).toBe("shared-1");
		});

		it("excludes the current product from results", async () => {
			await data.upsert(
				"product",
				"target",
				makeProduct({
					id: "target",
					slug: "target",
					tags: ["sale"],
					status: "active",
				}),
			);

			const result = (await controllers.product.getRelated(
				makeControllerCtx(data, { params: { id: "target" } }),
			)) as R;
			expect(result.products).toHaveLength(0);
		});

		it("respects the limit parameter", async () => {
			await data.upsert(
				"product",
				"target",
				makeProduct({
					id: "target",
					slug: "target",
					categoryId: "cat_1",
					status: "active",
				}),
			);
			for (let i = 1; i <= 6; i++) {
				await data.upsert(
					"product",
					`rel${i}`,
					makeProduct({
						id: `rel${i}`,
						slug: `rel-${i}`,
						categoryId: "cat_1",
						status: "active",
					}),
				);
			}

			const result = (await controllers.product.getRelated(
				makeControllerCtx(data, {
					params: { id: "target" },
					query: { limit: "2" },
				}),
			)) as R;
			expect(result.products).toHaveLength(2);
		});

		it("returns empty products when product not found", async () => {
			const result = (await controllers.product.getRelated(
				makeControllerCtx(data, { params: { id: "missing" } }),
			)) as R;
			expect(result.products).toEqual([]);
		});

		it("only returns active products", async () => {
			await data.upsert(
				"product",
				"target",
				makeProduct({
					id: "target",
					slug: "target",
					categoryId: "cat_1",
					status: "active",
				}),
			);
			await data.upsert(
				"product",
				"draft",
				makeProduct({
					id: "draft",
					slug: "draft",
					categoryId: "cat_1",
					status: "draft",
				}),
			);
			await data.upsert(
				"product",
				"active",
				makeProduct({
					id: "active",
					slug: "active",
					categoryId: "cat_1",
					status: "active",
				}),
			);

			const result = (await controllers.product.getRelated(
				makeControllerCtx(data, { params: { id: "target" } }),
			)) as R;
			expect(result.products).toHaveLength(1);
			expect(result.products[0].id).toBe("active");
		});
	});

	describe("create", () => {
		it("creates a new product with defaults", async () => {
			const result = (await controllers.product.create(
				makeControllerCtx(data, {
					body: { name: "New Product", slug: "new-product", price: 1999 },
				}),
			)) as Product;

			expect(result.name).toBe("New Product");
			expect(result.slug).toBe("new-product");
			expect(result.price).toBe(1999);
			expect(result.status).toBe("draft");
			expect(result.inventory).toBe(0);
			expect(result.isFeatured).toBe(false);
			expect(result.images).toEqual([]);
		});

		it("stores the product in the data service", async () => {
			const result = (await controllers.product.create(
				makeControllerCtx(data, {
					body: { name: "Stored Product", slug: "stored", price: 999 },
				}),
			)) as Product;

			const stored = await data.get("product", result.id);
			expect(stored).toMatchObject({ name: "Stored Product" });
		});
	});

	describe("update", () => {
		it("updates an existing product", async () => {
			const product = makeProduct();
			await data.upsert("product", product.id, product);

			const result = (await controllers.product.update(
				makeControllerCtx(data, {
					params: { id: "prod_1" },
					body: { price: 3999, status: "active" },
				}),
			)) as Product;

			expect(result.price).toBe(3999);
			expect(result.status).toBe("active");
			expect(result.name).toBe("Test Product"); // unchanged
		});

		it("throws when product not found", async () => {
			await expect(
				controllers.product.update(
					makeControllerCtx(data, {
						params: { id: "missing" },
						body: { price: 100 },
					}),
				),
			).rejects.toThrow("Product missing not found");
		});
	});

	describe("delete", () => {
		it("deletes product and its variants", async () => {
			const product = makeProduct();
			const variant = makeVariant();
			await data.upsert("product", product.id, product);
			await data.upsert("productVariant", variant.id, variant);

			const result = (await controllers.product.delete(
				makeControllerCtx(data, { params: { id: "prod_1" } }),
			)) as R;
			expect(result.success).toBe(true);
			expect(await data.get("product", "prod_1")).toBeNull();
			expect(await data.get("productVariant", "var_1")).toBeNull();
		});
	});

	describe("checkAvailability", () => {
		it("returns available when inventory is sufficient", async () => {
			await data.upsert(
				"product",
				"p1",
				makeProduct({ id: "p1", inventory: 10, trackInventory: true }),
			);

			const result = (await controllers.product.checkAvailability(
				makeControllerCtx(data, {
					query: { productId: "p1", quantity: "3" },
				}),
			)) as R;
			expect(result.available).toBe(true);
			expect(result.inventory).toBe(10);
		});

		it("returns not available when inventory is too low", async () => {
			await data.upsert(
				"product",
				"p1",
				makeProduct({ id: "p1", inventory: 2, trackInventory: true }),
			);

			const result = (await controllers.product.checkAvailability(
				makeControllerCtx(data, {
					query: { productId: "p1", quantity: "5" },
				}),
			)) as R;
			expect(result.available).toBe(false);
		});

		it("always available when trackInventory is false", async () => {
			await data.upsert(
				"product",
				"p1",
				makeProduct({ id: "p1", inventory: 0, trackInventory: false }),
			);

			const result = (await controllers.product.checkAvailability(
				makeControllerCtx(data, {
					query: { productId: "p1", quantity: "100" },
				}),
			)) as R;
			expect(result.available).toBe(true);
		});

		it("available when backorder is allowed", async () => {
			await data.upsert(
				"product",
				"p1",
				makeProduct({
					id: "p1",
					inventory: 0,
					trackInventory: true,
					allowBackorder: true,
				}),
			);

			const result = (await controllers.product.checkAvailability(
				makeControllerCtx(data, {
					query: { productId: "p1", quantity: "5" },
				}),
			)) as R;
			expect(result.available).toBe(true);
		});

		it("checks variant inventory", async () => {
			await data.upsert("product", "p1", makeProduct({ id: "p1" }));
			await data.upsert(
				"productVariant",
				"var_1",
				makeVariant({ id: "var_1", inventory: 3 }),
			);

			const result = (await controllers.product.checkAvailability(
				makeControllerCtx(data, {
					query: { productId: "p1", variantId: "var_1", quantity: "2" },
				}),
			)) as R;
			expect(result.available).toBe(true);
			expect(result.inventory).toBe(3);
		});
	});

	describe("decrementInventory", () => {
		it("decrements product inventory", async () => {
			await data.upsert(
				"product",
				"p1",
				makeProduct({ id: "p1", inventory: 10 }),
			);

			await controllers.product.decrementInventory(
				makeControllerCtx(data, {
					params: { productId: "p1" },
					body: { quantity: 3 },
				}),
			);

			const updated = (await data.get("product", "p1")) as Product;
			expect(updated.inventory).toBe(7);
		});

		it("decrements variant inventory", async () => {
			await data.upsert("product", "p1", makeProduct({ id: "p1" }));
			await data.upsert(
				"productVariant",
				"var_1",
				makeVariant({ id: "var_1", inventory: 8 }),
			);

			await controllers.product.decrementInventory(
				makeControllerCtx(data, {
					params: { productId: "p1", variantId: "var_1" },
					body: { quantity: 2 },
				}),
			);

			const updated = (await data.get(
				"productVariant",
				"var_1",
			)) as ProductVariant;
			expect(updated.inventory).toBe(6);
		});
	});

	describe("incrementInventory", () => {
		it("increments product inventory", async () => {
			await data.upsert(
				"product",
				"p1",
				makeProduct({ id: "p1", inventory: 5 }),
			);

			await controllers.product.incrementInventory(
				makeControllerCtx(data, {
					params: { productId: "p1" },
					body: { quantity: 10 },
				}),
			);

			const updated = (await data.get("product", "p1")) as Product;
			expect(updated.inventory).toBe(15);
		});
	});
});

// ── Variant controllers ────────────────────────────────────────────────────

describe("variant controllers", () => {
	let data: ReturnType<typeof createMockDataService>;

	beforeEach(() => {
		data = createMockDataService();
	});

	describe("getById", () => {
		it("returns variant when found", async () => {
			const variant = makeVariant();
			await data.upsert("productVariant", variant.id, variant);

			const result = await controllers.variant.getById(
				makeControllerCtx(data, { params: { id: "var_1" } }),
			);
			expect(result).toMatchObject({ id: "var_1" });
		});

		it("returns null when not found", async () => {
			const result = await controllers.variant.getById(
				makeControllerCtx(data, { params: { id: "missing" } }),
			);
			expect(result).toBeNull();
		});
	});

	describe("getByProduct", () => {
		it("returns variants sorted by position", async () => {
			await data.upsert(
				"productVariant",
				"v1",
				makeVariant({ id: "v1", position: 2 }),
			);
			await data.upsert(
				"productVariant",
				"v2",
				makeVariant({ id: "v2", position: 0 }),
			);
			await data.upsert(
				"productVariant",
				"v3",
				makeVariant({ id: "v3", position: 1 }),
			);

			const result = (await controllers.variant.getByProduct(
				makeControllerCtx(data, { params: { productId: "prod_1" } }),
			)) as ProductVariant[];
			expect(result.map((v) => v.position)).toEqual([0, 1, 2]);
		});
	});

	describe("create", () => {
		it("creates a variant with defaults", async () => {
			const product = makeProduct();
			await data.upsert("product", product.id, product);

			const result = (await controllers.variant.create(
				makeControllerCtx(data, {
					params: { productId: "prod_1" },
					body: { name: "Large", price: 3499, options: { size: "L" } },
				}),
			)) as ProductVariant;

			expect(result.productId).toBe("prod_1");
			expect(result.name).toBe("Large");
			expect(result.inventory).toBe(0);
			expect(result.position).toBe(0);
		});
	});

	describe("update", () => {
		it("updates variant and product timestamp", async () => {
			const product = makeProduct();
			const variant = makeVariant();
			await data.upsert("product", product.id, product);
			await data.upsert("productVariant", variant.id, variant);

			const result = (await controllers.variant.update(
				makeControllerCtx(data, {
					params: { id: "var_1" },
					body: { price: 5999 },
				}),
			)) as ProductVariant;

			expect(result.price).toBe(5999);
			expect(result.name).toBe("Default"); // unchanged
		});

		it("throws when variant not found", async () => {
			await expect(
				controllers.variant.update(
					makeControllerCtx(data, {
						params: { id: "missing" },
						body: { price: 100 },
					}),
				),
			).rejects.toThrow("Variant missing not found");
		});
	});

	describe("delete", () => {
		it("deletes variant and updates product timestamp", async () => {
			const product = makeProduct();
			const variant = makeVariant();
			await data.upsert("product", product.id, product);
			await data.upsert("productVariant", variant.id, variant);

			const result = (await controllers.variant.delete(
				makeControllerCtx(data, { params: { id: "var_1" } }),
			)) as R;
			expect(result.success).toBe(true);
			expect(await data.get("productVariant", "var_1")).toBeNull();
		});
	});
});

// ── Category controllers ───────────────────────────────────────────────────

describe("category controllers", () => {
	let data: ReturnType<typeof createMockDataService>;

	beforeEach(() => {
		data = createMockDataService();
	});

	describe("getById", () => {
		it("returns category when found", async () => {
			const category = makeCategory();
			await data.upsert("category", category.id, category);

			const result = await controllers.category.getById(
				makeControllerCtx(data, { params: { id: "cat_1" } }),
			);
			expect(result).toMatchObject({ id: "cat_1", name: "Electronics" });
		});
	});

	describe("getBySlug", () => {
		it("returns category matching slug", async () => {
			const category = makeCategory();
			await data.upsert("category", category.id, category);

			const result = await controllers.category.getBySlug(
				makeControllerCtx(data, { query: { slug: "electronics" } }),
			);
			expect(result).toMatchObject({ slug: "electronics" });
		});

		it("returns null when not found", async () => {
			const result = await controllers.category.getBySlug(
				makeControllerCtx(data, { query: { slug: "missing" } }),
			);
			expect(result).toBeNull();
		});
	});

	describe("list", () => {
		it("returns categories sorted by position", async () => {
			await data.upsert(
				"category",
				"c1",
				makeCategory({ id: "c1", position: 2 }),
			);
			await data.upsert(
				"category",
				"c2",
				makeCategory({ id: "c2", slug: "c2", position: 0 }),
			);
			await data.upsert(
				"category",
				"c3",
				makeCategory({ id: "c3", slug: "c3", position: 1 }),
			);

			const result = (await controllers.category.list(
				makeControllerCtx(data),
			)) as R;
			expect(result.categories.map((c: Category) => c.position)).toEqual([
				0, 1, 2,
			]);
		});
	});

	describe("getTree", () => {
		it("builds tree structure from flat categories", async () => {
			await data.upsert(
				"category",
				"root",
				makeCategory({ id: "root", isVisible: true }),
			);
			await data.upsert(
				"category",
				"child",
				makeCategory({
					id: "child",
					slug: "child",
					parentId: "root",
					isVisible: true,
				}),
			);

			const tree = (await controllers.category.getTree(
				makeControllerCtx(data),
			)) as (Category & { children: Category[] })[];
			expect(tree).toHaveLength(1);
			expect(tree[0].id).toBe("root");
			expect(tree[0].children).toHaveLength(1);
			expect(tree[0].children[0].id).toBe("child");
		});

		it("only includes visible categories", async () => {
			await data.upsert(
				"category",
				"c1",
				makeCategory({ id: "c1", isVisible: true }),
			);
			await data.upsert(
				"category",
				"c2",
				makeCategory({ id: "c2", slug: "c2", isVisible: false }),
			);

			const tree = (await controllers.category.getTree(
				makeControllerCtx(data),
			)) as (Category & { children: Category[] })[];
			expect(tree).toHaveLength(1);
		});
	});

	describe("create", () => {
		it("creates a category with defaults", async () => {
			const result = (await controllers.category.create(
				makeControllerCtx(data, {
					body: { name: "New Category", slug: "new-cat" },
				}),
			)) as Category;

			expect(result.name).toBe("New Category");
			expect(result.slug).toBe("new-cat");
			expect(result.position).toBe(0);
			expect(result.isVisible).toBe(true);
		});
	});

	describe("update", () => {
		it("updates a category", async () => {
			const category = makeCategory();
			await data.upsert("category", category.id, category);

			const result = (await controllers.category.update(
				makeControllerCtx(data, {
					params: { id: "cat_1" },
					body: { name: "Updated Name" },
				}),
			)) as Category;

			expect(result.name).toBe("Updated Name");
			expect(result.slug).toBe("electronics"); // unchanged
		});

		it("throws when category not found", async () => {
			await expect(
				controllers.category.update(
					makeControllerCtx(data, {
						params: { id: "missing" },
						body: { name: "X" },
					}),
				),
			).rejects.toThrow("Category missing not found");
		});
	});

	describe("delete", () => {
		it("unlinks products before deleting category", async () => {
			const category = makeCategory();
			const product = makeProduct({ categoryId: "cat_1" });
			await data.upsert("category", category.id, category);
			await data.upsert("product", product.id, product);

			const result = (await controllers.category.delete(
				makeControllerCtx(data, { params: { id: "cat_1" } }),
			)) as R;
			expect(result.success).toBe(true);

			const updatedProduct = (await data.get("product", "prod_1")) as Product;
			expect(updatedProduct.categoryId).toBeUndefined();
			expect(await data.get("category", "cat_1")).toBeNull();
		});

		it("unlinks subcategories before deleting", async () => {
			const parent = makeCategory({ id: "parent" });
			const child = makeCategory({
				id: "child",
				slug: "child",
				parentId: "parent",
			});
			await data.upsert("category", parent.id, parent);
			await data.upsert("category", child.id, child);

			await controllers.category.delete(
				makeControllerCtx(data, { params: { id: "parent" } }),
			);

			const updatedChild = (await data.get("category", "child")) as Category;
			expect(updatedChild.parentId).toBeUndefined();
		});
	});
});

// ── Collection controllers ──────────────────────────────────────────────

function makeCollection(overrides: Partial<Collection> = {}): Collection {
	const now = new Date();
	return {
		id: "col_1",
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

describe("collection controllers", () => {
	let data: ReturnType<typeof createMockDataService>;

	beforeEach(() => {
		data = createMockDataService();
	});

	describe("getById", () => {
		it("returns collection when found", async () => {
			const col = makeCollection();
			await data.upsert("collection", col.id, col);

			const result = await controllers.collection.getById(
				makeControllerCtx(data, { params: { id: "col_1" } }),
			);
			expect(result).toMatchObject({ id: "col_1", name: "Summer Sale" });
		});

		it("returns null when not found", async () => {
			const result = await controllers.collection.getById(
				makeControllerCtx(data, { params: { id: "missing" } }),
			);
			expect(result).toBeNull();
		});
	});

	describe("getBySlug", () => {
		it("returns collection matching slug", async () => {
			const col = makeCollection();
			await data.upsert("collection", col.id, col);

			const result = await controllers.collection.getBySlug(
				makeControllerCtx(data, { query: { slug: "summer-sale" } }),
			);
			expect(result).toMatchObject({ slug: "summer-sale" });
		});

		it("returns null when slug not found", async () => {
			const result = await controllers.collection.getBySlug(
				makeControllerCtx(data, { query: { slug: "missing" } }),
			);
			expect(result).toBeNull();
		});
	});

	describe("list", () => {
		it("returns collections sorted by position", async () => {
			await data.upsert(
				"collection",
				"c1",
				makeCollection({ id: "c1", position: 2 }),
			);
			await data.upsert(
				"collection",
				"c2",
				makeCollection({ id: "c2", slug: "c2", position: 0 }),
			);
			await data.upsert(
				"collection",
				"c3",
				makeCollection({ id: "c3", slug: "c3", position: 1 }),
			);

			const result = (await controllers.collection.list(
				makeControllerCtx(data),
			)) as R;
			expect(result.collections).toHaveLength(3);
			expect(result.collections.map((c: Collection) => c.position)).toEqual([
				0, 1, 2,
			]);
		});

		it("filters by featured", async () => {
			await data.upsert(
				"collection",
				"c1",
				makeCollection({ id: "c1", isFeatured: true }),
			);
			await data.upsert(
				"collection",
				"c2",
				makeCollection({ id: "c2", slug: "c2", isFeatured: false }),
			);

			const result = (await controllers.collection.list(
				makeControllerCtx(data, { query: { featured: "true" } }),
			)) as R;
			expect(result.collections).toHaveLength(1);
			expect(result.collections[0].isFeatured).toBe(true);
		});

		it("filters by visible", async () => {
			await data.upsert(
				"collection",
				"c1",
				makeCollection({ id: "c1", isVisible: true }),
			);
			await data.upsert(
				"collection",
				"c2",
				makeCollection({ id: "c2", slug: "c2", isVisible: false }),
			);

			const result = (await controllers.collection.list(
				makeControllerCtx(data, { query: { visible: "true" } }),
			)) as R;
			expect(result.collections).toHaveLength(1);
			expect(result.collections[0].isVisible).toBe(true);
		});
	});

	describe("getWithProducts", () => {
		it("returns collection with linked active products", async () => {
			const col = makeCollection();
			await data.upsert("collection", col.id, col);

			const p1 = makeProduct({ id: "p1", status: "active" });
			const p2 = makeProduct({
				id: "p2",
				slug: "p2",
				status: "active",
			});
			await data.upsert("product", p1.id, p1);
			await data.upsert("product", p2.id, p2);

			const link1: CollectionProduct = {
				id: "cp_1",
				collectionId: "col_1",
				productId: "p1",
				position: 1,
				createdAt: new Date(),
			};
			const link2: CollectionProduct = {
				id: "cp_2",
				collectionId: "col_1",
				productId: "p2",
				position: 0,
				createdAt: new Date(),
			};
			await data.upsert("collectionProduct", link1.id, link1);
			await data.upsert("collectionProduct", link2.id, link2);

			const result = (await controllers.collection.getWithProducts(
				makeControllerCtx(data, { params: { id: "col_1" } }),
			)) as CollectionWithProducts;

			expect(result.name).toBe("Summer Sale");
			expect(result.products).toHaveLength(2);
			// Sorted by link position: p2 (pos 0) before p1 (pos 1)
			expect(result.products[0].id).toBe("p2");
			expect(result.products[1].id).toBe("p1");
		});

		it("excludes non-active products", async () => {
			const col = makeCollection();
			await data.upsert("collection", col.id, col);

			const p1 = makeProduct({ id: "p1", status: "active" });
			const p2 = makeProduct({ id: "p2", slug: "p2", status: "draft" });
			await data.upsert("product", p1.id, p1);
			await data.upsert("product", p2.id, p2);

			await data.upsert("collectionProduct", "cp_1", {
				id: "cp_1",
				collectionId: "col_1",
				productId: "p1",
				position: 0,
				createdAt: new Date(),
			});
			await data.upsert("collectionProduct", "cp_2", {
				id: "cp_2",
				collectionId: "col_1",
				productId: "p2",
				position: 1,
				createdAt: new Date(),
			});

			const result = (await controllers.collection.getWithProducts(
				makeControllerCtx(data, { params: { id: "col_1" } }),
			)) as CollectionWithProducts;
			expect(result.products).toHaveLength(1);
			expect(result.products[0].id).toBe("p1");
		});

		it("returns null when collection not found", async () => {
			const result = await controllers.collection.getWithProducts(
				makeControllerCtx(data, { params: { id: "missing" } }),
			);
			expect(result).toBeNull();
		});
	});

	describe("create", () => {
		it("creates a collection with defaults", async () => {
			const result = (await controllers.collection.create(
				makeControllerCtx(data, {
					body: { name: "New Arrivals", slug: "new-arrivals" },
				}),
			)) as Collection;

			expect(result.name).toBe("New Arrivals");
			expect(result.slug).toBe("new-arrivals");
			expect(result.isFeatured).toBe(false);
			expect(result.isVisible).toBe(true);
			expect(result.position).toBe(0);
		});

		it("stores the collection in the data service", async () => {
			const result = (await controllers.collection.create(
				makeControllerCtx(data, {
					body: { name: "Stored", slug: "stored" },
				}),
			)) as Collection;

			const stored = await data.get("collection", result.id);
			expect(stored).toMatchObject({ name: "Stored" });
		});
	});

	describe("update", () => {
		it("updates an existing collection", async () => {
			const col = makeCollection();
			await data.upsert("collection", col.id, col);

			const result = (await controllers.collection.update(
				makeControllerCtx(data, {
					params: { id: "col_1" },
					body: { name: "Winter Sale", isFeatured: true },
				}),
			)) as Collection;

			expect(result.name).toBe("Winter Sale");
			expect(result.isFeatured).toBe(true);
			expect(result.slug).toBe("summer-sale"); // unchanged
		});

		it("throws when collection not found", async () => {
			await expect(
				controllers.collection.update(
					makeControllerCtx(data, {
						params: { id: "missing" },
						body: { name: "X" },
					}),
				),
			).rejects.toThrow("Collection missing not found");
		});
	});

	describe("delete", () => {
		it("deletes collection and its product links", async () => {
			const col = makeCollection();
			await data.upsert("collection", col.id, col);

			await data.upsert("collectionProduct", "cp_1", {
				id: "cp_1",
				collectionId: "col_1",
				productId: "p1",
				position: 0,
				createdAt: new Date(),
			});

			const result = (await controllers.collection.delete(
				makeControllerCtx(data, { params: { id: "col_1" } }),
			)) as R;
			expect(result.success).toBe(true);
			expect(await data.get("collection", "col_1")).toBeNull();
			expect(await data.get("collectionProduct", "cp_1")).toBeNull();
		});
	});

	describe("addProduct", () => {
		it("adds a product to a collection", async () => {
			const col = makeCollection();
			await data.upsert("collection", col.id, col);

			const link = (await controllers.collection.addProduct(
				makeControllerCtx(data, {
					params: { id: "col_1" },
					body: { productId: "p1", position: 5 },
				}),
			)) as CollectionProduct;

			expect(link.collectionId).toBe("col_1");
			expect(link.productId).toBe("p1");
			expect(link.position).toBe(5);
		});

		it("returns existing link if product already in collection", async () => {
			const col = makeCollection();
			await data.upsert("collection", col.id, col);

			await data.upsert("collectionProduct", "cp_1", {
				id: "cp_1",
				collectionId: "col_1",
				productId: "p1",
				position: 0,
				createdAt: new Date(),
			});

			const result = (await controllers.collection.addProduct(
				makeControllerCtx(data, {
					params: { id: "col_1" },
					body: { productId: "p1" },
				}),
			)) as CollectionProduct;

			expect(result.id).toBe("cp_1");
		});

		it("throws when collection not found", async () => {
			await expect(
				controllers.collection.addProduct(
					makeControllerCtx(data, {
						params: { id: "missing" },
						body: { productId: "p1" },
					}),
				),
			).rejects.toThrow("Collection missing not found");
		});
	});

	describe("removeProduct", () => {
		it("removes a product from a collection", async () => {
			const col = makeCollection();
			await data.upsert("collection", col.id, col);

			await data.upsert("collectionProduct", "cp_1", {
				id: "cp_1",
				collectionId: "col_1",
				productId: "p1",
				position: 0,
				createdAt: new Date(),
			});

			const result = (await controllers.collection.removeProduct(
				makeControllerCtx(data, {
					params: { id: "col_1", productId: "p1" },
				}),
			)) as R;
			expect(result.success).toBe(true);
			expect(await data.get("collectionProduct", "cp_1")).toBeNull();
		});
	});

	describe("listProducts", () => {
		it("returns products in a collection sorted by position", async () => {
			const col = makeCollection();
			await data.upsert("collection", col.id, col);

			const p1 = makeProduct({ id: "p1" });
			const p2 = makeProduct({ id: "p2", slug: "p2" });
			await data.upsert("product", p1.id, p1);
			await data.upsert("product", p2.id, p2);

			await data.upsert("collectionProduct", "cp_1", {
				id: "cp_1",
				collectionId: "col_1",
				productId: "p1",
				position: 1,
				createdAt: new Date(),
			});
			await data.upsert("collectionProduct", "cp_2", {
				id: "cp_2",
				collectionId: "col_1",
				productId: "p2",
				position: 0,
				createdAt: new Date(),
			});

			const result = (await controllers.collection.listProducts(
				makeControllerCtx(data, { params: { id: "col_1" } }),
			)) as R;
			expect(result.products).toHaveLength(2);
			expect(result.products[0].id).toBe("p2");
			expect(result.products[1].id).toBe("p1");
		});

		it("returns empty products when collection not found", async () => {
			const result = (await controllers.collection.listProducts(
				makeControllerCtx(data, { params: { id: "missing" } }),
			)) as R;
			expect(result.products).toEqual([]);
		});
	});
});

// ── Import controllers ────────────────────────────────────────────────────

describe("import controllers", () => {
	let data: ReturnType<typeof createMockDataService>;

	beforeEach(() => {
		data = createMockDataService();
	});

	describe("importProducts", () => {
		it("creates products from valid import rows", async () => {
			const result = (await controllers.import.importProducts(
				makeControllerCtx(data, {
					body: {
						products: [
							{ name: "Widget A", price: "19.99" },
							{ name: "Widget B", price: "29.99", sku: "WB-001" },
						],
					},
				}),
			)) as ImportResult;

			expect(result.created).toBe(2);
			expect(result.updated).toBe(0);
			expect(result.errors).toHaveLength(0);

			// Verify products are actually stored
			const stored = await data.findMany("product", { where: {} });
			expect(stored).toHaveLength(2);
		});

		it("converts price from dollars to cents", async () => {
			const result = (await controllers.import.importProducts(
				makeControllerCtx(data, {
					body: {
						products: [{ name: "Dollar Test", price: "49.99" }],
					},
				}),
			)) as ImportResult;

			expect(result.created).toBe(1);

			const stored = (await data.findMany("product", {
				where: {},
			})) as Product[];
			expect(stored[0].price).toBe(4999);
		});

		it("generates slug from product name", async () => {
			const result = (await controllers.import.importProducts(
				makeControllerCtx(data, {
					body: {
						products: [{ name: "My Great Product!", price: "10" }],
					},
				}),
			)) as ImportResult;

			expect(result.created).toBe(1);

			const stored = (await data.findMany("product", {
				where: {},
			})) as Product[];
			expect(stored[0].slug).toBe("my-great-product");
		});

		it("uses provided slug when available", async () => {
			const result = (await controllers.import.importProducts(
				makeControllerCtx(data, {
					body: {
						products: [
							{ name: "My Product", slug: "custom-slug", price: "10" },
						],
					},
				}),
			)) as ImportResult;

			expect(result.created).toBe(1);

			const stored = (await data.findMany("product", {
				where: {},
			})) as Product[];
			expect(stored[0].slug).toBe("custom-slug");
		});

		it("deduplicates slugs within a batch", async () => {
			const result = (await controllers.import.importProducts(
				makeControllerCtx(data, {
					body: {
						products: [
							{ name: "Same Name", price: "10" },
							{ name: "Same Name", price: "20" },
						],
					},
				}),
			)) as ImportResult;

			expect(result.created).toBe(2);

			const stored = (await data.findMany("product", {
				where: {},
			})) as Product[];
			const slugs = stored.map((p) => p.slug).sort();
			expect(slugs).toContain("same-name");
			expect(slugs).toContain("same-name-1");
		});

		it("deduplicates slugs against existing products", async () => {
			const existing = makeProduct({ id: "exist_1", slug: "widget" });
			await data.upsert("product", existing.id, existing);

			const result = (await controllers.import.importProducts(
				makeControllerCtx(data, {
					body: {
						products: [{ name: "Widget", price: "10" }],
					},
				}),
			)) as ImportResult;

			expect(result.created).toBe(1);

			const stored = (await data.findMany("product", {
				where: {},
			})) as Product[];
			const newProduct = stored.find((p) => p.id !== "exist_1");
			expect(newProduct?.slug).toBe("widget-1");
		});

		it("updates existing products when SKU matches", async () => {
			const existing = makeProduct({
				id: "exist_1",
				name: "Old Name",
				sku: "SKU-001",
				price: 1000,
			});
			await data.upsert("product", existing.id, existing);

			const result = (await controllers.import.importProducts(
				makeControllerCtx(data, {
					body: {
						products: [
							{
								name: "New Name",
								price: "25.99",
								sku: "SKU-001",
								status: "active",
							},
						],
					},
				}),
			)) as ImportResult;

			expect(result.created).toBe(0);
			expect(result.updated).toBe(1);

			const stored = (await data.get("product", "exist_1")) as Product;
			expect(stored.name).toBe("New Name");
			expect(stored.price).toBe(2599);
			expect(stored.status).toBe("active");
		});

		it("resolves category name to category ID", async () => {
			const cat = makeCategory({ id: "cat_elec", name: "Electronics" });
			await data.upsert("category", cat.id, cat);

			const result = (await controllers.import.importProducts(
				makeControllerCtx(data, {
					body: {
						products: [
							{ name: "Gadget", price: "50", category: "Electronics" },
						],
					},
				}),
			)) as ImportResult;

			expect(result.created).toBe(1);

			const stored = (await data.findMany("product", {
				where: {},
			})) as Product[];
			expect(stored[0].categoryId).toBe("cat_elec");
		});

		it("handles case-insensitive category matching", async () => {
			const cat = makeCategory({ id: "cat_1", name: "Clothing" });
			await data.upsert("category", cat.id, cat);

			const result = (await controllers.import.importProducts(
				makeControllerCtx(data, {
					body: {
						products: [{ name: "Shirt", price: "30", category: "clothing" }],
					},
				}),
			)) as ImportResult;

			expect(result.created).toBe(1);

			const stored = (await data.findMany("product", {
				where: {},
			})) as Product[];
			expect(stored[0].categoryId).toBe("cat_1");
		});

		it("sets default values for optional fields", async () => {
			const result = (await controllers.import.importProducts(
				makeControllerCtx(data, {
					body: {
						products: [{ name: "Basic Product", price: "15" }],
					},
				}),
			)) as ImportResult;

			expect(result.created).toBe(1);

			const stored = (await data.findMany("product", {
				where: {},
			})) as Product[];
			expect(stored[0].status).toBe("draft");
			expect(stored[0].inventory).toBe(0);
			expect(stored[0].trackInventory).toBe(true);
			expect(stored[0].allowBackorder).toBe(false);
			expect(stored[0].isFeatured).toBe(false);
			expect(stored[0].images).toEqual([]);
			expect(stored[0].tags).toEqual([]);
		});

		it("imports optional fields when provided", async () => {
			const result = (await controllers.import.importProducts(
				makeControllerCtx(data, {
					body: {
						products: [
							{
								name: "Full Product",
								price: "99.99",
								sku: "FP-001",
								barcode: "123456789",
								description: "A detailed description",
								shortDescription: "Short desc",
								compareAtPrice: "149.99",
								costPrice: "50",
								inventory: "25",
								status: "active",
								tags: ["premium", "sale"],
								weight: "2.5",
								weightUnit: "kg",
								featured: true,
								trackInventory: true,
								allowBackorder: true,
							},
						],
					},
				}),
			)) as ImportResult;

			expect(result.created).toBe(1);

			const stored = (await data.findMany("product", {
				where: {},
			})) as Product[];
			const p = stored[0];
			expect(p.sku).toBe("FP-001");
			expect(p.barcode).toBe("123456789");
			expect(p.description).toBe("A detailed description");
			expect(p.shortDescription).toBe("Short desc");
			expect(p.compareAtPrice).toBe(14999);
			expect(p.costPrice).toBe(5000);
			expect(p.inventory).toBe(25);
			expect(p.status).toBe("active");
			expect(p.tags).toEqual(["premium", "sale"]);
			expect(p.weight).toBe(2.5);
			expect(p.weightUnit).toBe("kg");
			expect(p.isFeatured).toBe(true);
			expect(p.trackInventory).toBe(true);
			expect(p.allowBackorder).toBe(true);
		});

		it("returns errors for rows missing name", async () => {
			const result = (await controllers.import.importProducts(
				makeControllerCtx(data, {
					body: {
						products: [
							{ name: "", price: "10" },
							{ name: "Valid", price: "20" },
						],
					},
				}),
			)) as ImportResult;

			expect(result.created).toBe(1);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0].row).toBe(1);
			expect(result.errors[0].field).toBe("name");
		});

		it("returns errors for rows missing price", async () => {
			const result = (await controllers.import.importProducts(
				makeControllerCtx(data, {
					body: {
						products: [{ name: "No Price" } as unknown as ImportProductRow],
					},
				}),
			)) as ImportResult;

			expect(result.created).toBe(0);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0].field).toBe("price");
		});

		it("returns errors for invalid price values", async () => {
			const result = (await controllers.import.importProducts(
				makeControllerCtx(data, {
					body: {
						products: [
							{ name: "Bad Price", price: "abc" },
							{ name: "Negative Price", price: "-5" },
						],
					},
				}),
			)) as ImportResult;

			expect(result.created).toBe(0);
			expect(result.errors).toHaveLength(2);
			expect(result.errors[0].field).toBe("price");
			expect(result.errors[1].field).toBe("price");
		});

		it("handles mixed valid and invalid rows", async () => {
			const result = (await controllers.import.importProducts(
				makeControllerCtx(data, {
					body: {
						products: [
							{ name: "Good One", price: "10" },
							{ name: "", price: "20" },
							{ name: "Good Two", price: "30" },
							{ name: "Bad Price", price: "nope" },
							{ name: "Good Three", price: "40" },
						],
					},
				}),
			)) as ImportResult;

			expect(result.created).toBe(3);
			expect(result.errors).toHaveLength(2);
			expect(result.errors[0].row).toBe(2);
			expect(result.errors[1].row).toBe(4);
		});

		it("handles empty products array gracefully", async () => {
			const result = (await controllers.import.importProducts(
				makeControllerCtx(data, {
					body: {
						products: [],
					},
				}),
			)) as ImportResult;

			expect(result.created).toBe(0);
			expect(result.updated).toBe(0);
			expect(result.errors).toHaveLength(0);
		});
	});

	describe("bulk.updateStatus", () => {
		it("updates status for multiple products", async () => {
			const p1 = makeProduct({ id: "prod_1", status: "draft" });
			const p2 = makeProduct({ id: "prod_2", status: "draft" });
			const p3 = makeProduct({ id: "prod_3", status: "active" });
			data._store.set("product:prod_1", p1);
			data._store.set("product:prod_2", p2);
			data._store.set("product:prod_3", p3);

			const result = (await controllers.bulk.updateStatus(
				makeControllerCtx(data, {
					body: { ids: ["prod_1", "prod_2", "prod_3"], status: "active" },
				}),
			)) as { updated: number };

			expect(result.updated).toBe(3);

			const updated1 = data._store.get("product:prod_1") as Product;
			const updated2 = data._store.get("product:prod_2") as Product;
			const updated3 = data._store.get("product:prod_3") as Product;
			expect(updated1.status).toBe("active");
			expect(updated2.status).toBe("active");
			expect(updated3.status).toBe("active");
		});

		it("skips non-existent products", async () => {
			const p1 = makeProduct({ id: "prod_1", status: "draft" });
			data._store.set("product:prod_1", p1);

			const result = (await controllers.bulk.updateStatus(
				makeControllerCtx(data, {
					body: {
						ids: ["prod_1", "prod_nonexistent"],
						status: "archived",
					},
				}),
			)) as { updated: number };

			expect(result.updated).toBe(1);
			const updated = data._store.get("product:prod_1") as Product;
			expect(updated.status).toBe("archived");
		});

		it("returns zero for empty ids array", async () => {
			const result = (await controllers.bulk.updateStatus(
				makeControllerCtx(data, {
					body: { ids: [], status: "active" },
				}),
			)) as { updated: number };

			expect(result.updated).toBe(0);
		});

		it("sets updatedAt to current time", async () => {
			const oldDate = new Date("2020-01-01");
			const p1 = makeProduct({ id: "prod_1", updatedAt: oldDate });
			data._store.set("product:prod_1", p1);

			await controllers.bulk.updateStatus(
				makeControllerCtx(data, {
					body: { ids: ["prod_1"], status: "draft" },
				}),
			);

			const updated = data._store.get("product:prod_1") as Product;
			expect(updated.updatedAt.getTime()).toBeGreaterThan(oldDate.getTime());
		});
	});

	describe("bulk.deleteMany", () => {
		it("deletes multiple products", async () => {
			const p1 = makeProduct({ id: "prod_1" });
			const p2 = makeProduct({ id: "prod_2" });
			data._store.set("product:prod_1", p1);
			data._store.set("product:prod_2", p2);

			const result = (await controllers.bulk.deleteMany(
				makeControllerCtx(data, {
					body: { ids: ["prod_1", "prod_2"] },
				}),
			)) as { deleted: number };

			expect(result.deleted).toBe(2);
			expect(data._store.has("product:prod_1")).toBe(false);
			expect(data._store.has("product:prod_2")).toBe(false);
		});

		it("also deletes associated variants", async () => {
			const p1 = makeProduct({ id: "prod_1" });
			const v1 = makeVariant({ id: "var_1", productId: "prod_1" });
			const v2 = makeVariant({ id: "var_2", productId: "prod_1" });
			data._store.set("product:prod_1", p1);
			data._store.set("productVariant:var_1", v1);
			data._store.set("productVariant:var_2", v2);

			const result = (await controllers.bulk.deleteMany(
				makeControllerCtx(data, {
					body: { ids: ["prod_1"] },
				}),
			)) as { deleted: number };

			expect(result.deleted).toBe(1);
			expect(data._store.has("product:prod_1")).toBe(false);
			expect(data._store.has("productVariant:var_1")).toBe(false);
			expect(data._store.has("productVariant:var_2")).toBe(false);
		});

		it("skips non-existent products", async () => {
			const p1 = makeProduct({ id: "prod_1" });
			data._store.set("product:prod_1", p1);

			const result = (await controllers.bulk.deleteMany(
				makeControllerCtx(data, {
					body: { ids: ["prod_1", "prod_nonexistent"] },
				}),
			)) as { deleted: number };

			expect(result.deleted).toBe(1);
		});

		it("returns zero for empty ids array", async () => {
			const result = (await controllers.bulk.deleteMany(
				makeControllerCtx(data, {
					body: { ids: [] },
				}),
			)) as { deleted: number };

			expect(result.deleted).toBe(0);
		});

		it("does not affect other products", async () => {
			const p1 = makeProduct({ id: "prod_1" });
			const p2 = makeProduct({ id: "prod_2" });
			const p3 = makeProduct({ id: "prod_3" });
			data._store.set("product:prod_1", p1);
			data._store.set("product:prod_2", p2);
			data._store.set("product:prod_3", p3);

			await controllers.bulk.deleteMany(
				makeControllerCtx(data, {
					body: { ids: ["prod_1", "prod_3"] },
				}),
			);

			expect(data._store.has("product:prod_1")).toBe(false);
			expect(data._store.has("product:prod_2")).toBe(true);
			expect(data._store.has("product:prod_3")).toBe(false);
		});
	});
});
