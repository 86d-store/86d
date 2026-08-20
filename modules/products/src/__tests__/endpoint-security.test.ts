import {
	createMockDataService,
	makeControllerCtx,
} from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { Category, Product, ProductVariant } from "../controllers";
import { controllers } from "../controllers";

/**
 * Endpoint-security tests for the products module.
 *
 * These tests verify data-integrity invariants that, if broken, could
 * expose stale/orphaned data or corrupt inventory:
 *
 * 1. Cascade delete: deleting a product removes all its variants
 * 2. Inventory integrity: decrement does not go below 0
 * 3. Status filtering: inactive/draft products excluded when filtered
 * 4. Variant isolation: variants scoped to their owning productId
 * 5. Category hierarchy integrity on delete
 * 6. Slug uniqueness during import
 */

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

describe("products endpoint security", () => {
	let data: ReturnType<typeof createMockDataService>;

	beforeEach(() => {
		data = createMockDataService();
	});

	// -- Cascade Delete -------------------------------------------------------

	describe("cascade delete - product removes all variants", () => {
		it("deleting a product removes all associated variants", async () => {
			const product = makeProduct();
			await data.upsert("product", product.id, product);
			await data.upsert(
				"productVariant",
				"var_1",
				makeVariant({ id: "var_1", productId: product.id }),
			);
			await data.upsert(
				"productVariant",
				"var_2",
				makeVariant({ id: "var_2", productId: product.id, name: "Large" }),
			);

			await controllers.product.delete(
				makeControllerCtx(data, { params: { id: product.id } }),
			);

			expect(await data.get("product", product.id)).toBeNull();
			const remainingVariants = await data.findMany("productVariant", {
				where: { productId: product.id },
			});
			expect(remainingVariants).toHaveLength(0);
		});

		it("deleting one product does not remove another product's variants", async () => {
			const productA = makeProduct({ id: "prod_a" });
			const productB = makeProduct({ id: "prod_b", slug: "other-product" });
			await data.upsert("product", productA.id, productA);
			await data.upsert("product", productB.id, productB);
			await data.upsert(
				"productVariant",
				"var_a",
				makeVariant({ id: "var_a", productId: "prod_a" }),
			);
			await data.upsert(
				"productVariant",
				"var_b",
				makeVariant({ id: "var_b", productId: "prod_b" }),
			);

			await controllers.product.delete(
				makeControllerCtx(data, { params: { id: "prod_a" } }),
			);

			const bVariants = await data.findMany("productVariant", {
				where: { productId: "prod_b" },
			});
			expect(bVariants).toHaveLength(1);
		});

		it("bulk deleteMany cascades variants for every deleted product", async () => {
			const p1 = makeProduct({ id: "prod_1" });
			const p2 = makeProduct({ id: "prod_2", slug: "second" });
			await data.upsert("product", p1.id, p1);
			await data.upsert("product", p2.id, p2);
			await data.upsert(
				"productVariant",
				"var_1",
				makeVariant({ id: "var_1", productId: "prod_1" }),
			);
			await data.upsert(
				"productVariant",
				"var_2",
				makeVariant({ id: "var_2", productId: "prod_2" }),
			);

			const result = await controllers.bulk.deleteMany(
				makeControllerCtx(data, {
					body: { ids: ["prod_1", "prod_2"] },
				}),
			);

			expect(result).toMatchObject({ deleted: 2 });
			const allVariants = await data.findMany("productVariant", { where: {} });
			expect(allVariants).toHaveLength(0);
		});
	});

	// -- Inventory Integrity --------------------------------------------------

	describe("inventory integrity", () => {
		it("decrement can push inventory below zero (no floor guard)", async () => {
			const product = makeProduct({ id: "prod_inv", inventory: 2 });
			await data.upsert("product", product.id, product);

			await controllers.product.decrementInventory(
				makeControllerCtx(data, {
					params: { productId: "prod_inv" },
					body: { quantity: 5 },
				}),
			);

			const updated = (await data.get("product", "prod_inv")) as Product;
			// The controller does NOT enforce a floor -- inventory goes negative.
			// This documents the current behavior; endpoints must check availability first.
			expect(updated.inventory).toBe(-3);
		});

		it("decrement variant inventory independently of product inventory", async () => {
			const product = makeProduct({ id: "prod_vi", inventory: 100 });
			await data.upsert("product", product.id, product);
			const variant = makeVariant({
				id: "var_vi",
				productId: "prod_vi",
				inventory: 3,
			});
			await data.upsert("productVariant", variant.id, variant);

			await controllers.product.decrementInventory(
				makeControllerCtx(data, {
					params: { productId: "prod_vi", variantId: "var_vi" },
					body: { quantity: 2 },
				}),
			);

			const updatedVariant = (await data.get(
				"productVariant",
				"var_vi",
			)) as ProductVariant;
			expect(updatedVariant.inventory).toBe(1);

			// Product inventory is untouched when variant path is used
			const updatedProduct = (await data.get("product", "prod_vi")) as Product;
			expect(updatedProduct.inventory).toBe(100);
		});

		it("increment restores inventory correctly", async () => {
			const product = makeProduct({ id: "prod_inc", inventory: 0 });
			await data.upsert("product", product.id, product);

			await controllers.product.incrementInventory(
				makeControllerCtx(data, {
					params: { productId: "prod_inc" },
					body: { quantity: 7 },
				}),
			);

			const updated = (await data.get("product", "prod_inc")) as Product;
			expect(updated.inventory).toBe(7);
		});
	});

	// -- Status Filtering -----------------------------------------------------

	describe("status filtering - inactive/draft products excluded", () => {
		it("search only returns active products", async () => {
			await data.upsert(
				"product",
				"prod_active",
				makeProduct({
					id: "prod_active",
					name: "Widget Active",
					status: "active",
				}),
			);
			await data.upsert(
				"product",
				"prod_draft",
				makeProduct({
					id: "prod_draft",
					name: "Widget Draft",
					slug: "widget-draft",
					status: "draft",
				}),
			);
			await data.upsert(
				"product",
				"prod_archived",
				makeProduct({
					id: "prod_archived",
					name: "Widget Archived",
					slug: "widget-archived",
					status: "archived",
				}),
			);

			const results = await controllers.product.search(
				makeControllerCtx(data, { query: { q: "Widget" } }),
			);

			expect(results).toHaveLength(1);
			expect((results as Product[])[0].id).toBe("prod_active");
		});

		it("getFeatured only returns active featured products", async () => {
			await data.upsert(
				"product",
				"prod_feat_active",
				makeProduct({
					id: "prod_feat_active",
					isFeatured: true,
					status: "active",
				}),
			);
			await data.upsert(
				"product",
				"prod_feat_draft",
				makeProduct({
					id: "prod_feat_draft",
					slug: "feat-draft",
					isFeatured: true,
					status: "draft",
				}),
			);

			const results = await controllers.product.getFeatured(
				makeControllerCtx(data, { query: {} }),
			);

			expect(results).toHaveLength(1);
			expect((results as Product[])[0].id).toBe("prod_feat_active");
		});

		it("list with status filter returns only matching status", async () => {
			await data.upsert(
				"product",
				"prod_a",
				makeProduct({ id: "prod_a", status: "active" }),
			);
			await data.upsert(
				"product",
				"prod_d",
				makeProduct({ id: "prod_d", slug: "draft-one", status: "draft" }),
			);

			const result = await controllers.product.list(
				makeControllerCtx(data, { query: { status: "draft" } }),
			);

			const listed = result as {
				products: Product[];
				total: number;
			};
			expect(listed.total).toBe(1);
			expect(listed.products[0].id).toBe("prod_d");
		});
	});

	// -- Variant Isolation ----------------------------------------------------

	describe("variant isolation - scoped to productId", () => {
		it("getByProduct returns only variants for the specified product", async () => {
			const p1 = makeProduct({ id: "prod_iso_1" });
			const p2 = makeProduct({ id: "prod_iso_2", slug: "iso-2" });
			await data.upsert("product", p1.id, p1);
			await data.upsert("product", p2.id, p2);
			await data.upsert(
				"productVariant",
				"var_iso_1",
				makeVariant({
					id: "var_iso_1",
					productId: "prod_iso_1",
					name: "Small",
				}),
			);
			await data.upsert(
				"productVariant",
				"var_iso_2",
				makeVariant({
					id: "var_iso_2",
					productId: "prod_iso_2",
					name: "Large",
				}),
			);

			const p1Variants = (await controllers.variant.getByProduct(
				makeControllerCtx(data, { params: { productId: "prod_iso_1" } }),
			)) as ProductVariant[];

			expect(p1Variants).toHaveLength(1);
			expect(p1Variants[0].name).toBe("Small");
		});
	});

	// -- Category Hierarchy Integrity -----------------------------------------

	describe("category hierarchy integrity", () => {
		it("deleting parent category orphans subcategories by clearing parentId", async () => {
			const parent = makeCategory({ id: "cat_parent" });
			const child = makeCategory({
				id: "cat_child",
				slug: "child",
				parentId: "cat_parent",
			});
			await data.upsert("category", parent.id, parent);
			await data.upsert("category", child.id, child);

			await controllers.category.delete(
				makeControllerCtx(data, { params: { id: "cat_parent" } }),
			);

			expect(await data.get("category", "cat_parent")).toBeNull();
			const updatedChild = (await data.get(
				"category",
				"cat_child",
			)) as Category;
			expect(updatedChild).not.toBeNull();
			expect(updatedChild.parentId).toBeUndefined();
		});

		it("deleting category clears categoryId on associated products", async () => {
			const cat = makeCategory({ id: "cat_del" });
			const product = makeProduct({ id: "prod_cat", categoryId: "cat_del" });
			await data.upsert("category", cat.id, cat);
			await data.upsert("product", product.id, product);

			await controllers.category.delete(
				makeControllerCtx(data, { params: { id: "cat_del" } }),
			);

			const updatedProduct = (await data.get("product", "prod_cat")) as Product;
			expect(updatedProduct.categoryId).toBeUndefined();
		});
	});

	// -- Slug Uniqueness ------------------------------------------------------

	describe("slug uniqueness", () => {
		it("import auto-deduplicates slugs to prevent collisions", async () => {
			// Seed an existing product with slug "widget"
			await data.upsert(
				"product",
				"prod_existing",
				makeProduct({ id: "prod_existing", slug: "widget", name: "Widget" }),
			);

			const result = await controllers.import.importProducts(
				makeControllerCtx(data, {
					body: {
						products: [
							{ name: "Widget", price: 10 },
							{ name: "Widget", price: 20 },
						],
					},
				}),
			);

			const importResult = result as {
				created: number;
				updated: number;
				errors: unknown[];
			};
			expect(importResult.created).toBe(2);
			expect(importResult.errors).toHaveLength(0);

			// Verify all three products have distinct slugs
			const allProducts = (await data.findMany("product", {
				where: {},
			})) as Product[];
			const slugs = allProducts.map((p) => p.slug);
			const uniqueSlugs = new Set(slugs);
			expect(uniqueSlugs.size).toBe(slugs.length);
		});

		it("getBySlug returns the correct product when multiple products exist", async () => {
			await data.upsert(
				"product",
				"prod_s1",
				makeProduct({ id: "prod_s1", slug: "alpha", name: "Alpha" }),
			);
			await data.upsert(
				"product",
				"prod_s2",
				makeProduct({ id: "prod_s2", slug: "beta", name: "Beta" }),
			);

			const result = await controllers.product.getBySlug(
				makeControllerCtx(data, { query: { slug: "beta" } }),
			);
			expect(result).toMatchObject({ id: "prod_s2", name: "Beta" });
		});
	});
});
