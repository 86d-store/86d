import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createProductController } from "../service-impl";

describe("createProductController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createProductController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createProductController(mockData);
	});

	// ── Helpers ──

	async function createTestProduct(
		overrides: Partial<Parameters<typeof controller.createProduct>[0]> = {},
	) {
		return controller.createProduct({
			name: "Test Product",
			slug: "test-product",
			price: 2999,
			...overrides,
		});
	}

	async function createTestCategory(
		overrides: Partial<Parameters<typeof controller.createCategory>[0]> = {},
	) {
		return controller.createCategory({
			name: "Test Category",
			slug: "test-category",
			...overrides,
		});
	}

	async function createTestCollection(
		overrides: Partial<Parameters<typeof controller.createCollection>[0]> = {},
	) {
		return controller.createCollection({
			name: "Test Collection",
			slug: "test-collection",
			...overrides,
		});
	}

	// ── createProduct ──

	describe("createProduct", () => {
		it("creates a product with required fields", async () => {
			const product = await createTestProduct();
			expect(product.id).toBeDefined();
			expect(product.name).toBe("Test Product");
			expect(product.slug).toBe("test-product");
			expect(product.price).toBe(2999);
			expect(product.createdAt).toBeInstanceOf(Date);
			expect(product.updatedAt).toBeInstanceOf(Date);
		});

		it("applies default values", async () => {
			const product = await createTestProduct();
			expect(product.inventory).toBe(0);
			expect(product.trackInventory).toBe(true);
			expect(product.allowBackorder).toBe(false);
			expect(product.status).toBe("draft");
			expect(product.images).toEqual([]);
			expect(product.tags).toEqual([]);
			expect(product.isFeatured).toBe(false);
			expect(product.weightUnit).toBe("kg");
		});

		it("creates a product with all optional fields", async () => {
			const product = await createTestProduct({
				description: "A great product",
				shortDescription: "Great",
				compareAtPrice: 3999,
				costPrice: 1500,
				sku: "SKU-001",
				barcode: "1234567890",
				inventory: 50,
				trackInventory: false,
				allowBackorder: true,
				status: "active",
				categoryId: "cat_123",
				images: ["img1.jpg", "img2.jpg"],
				tags: ["sale", "new"],
				metadata: { color: "red" },
				weight: 1.5,
				weightUnit: "lb",
				isFeatured: true,
			});
			expect(product.description).toBe("A great product");
			expect(product.shortDescription).toBe("Great");
			expect(product.compareAtPrice).toBe(3999);
			expect(product.costPrice).toBe(1500);
			expect(product.sku).toBe("SKU-001");
			expect(product.barcode).toBe("1234567890");
			expect(product.inventory).toBe(50);
			expect(product.trackInventory).toBe(false);
			expect(product.allowBackorder).toBe(true);
			expect(product.status).toBe("active");
			expect(product.categoryId).toBe("cat_123");
			expect(product.images).toEqual(["img1.jpg", "img2.jpg"]);
			expect(product.tags).toEqual(["sale", "new"]);
			expect(product.metadata).toEqual({ color: "red" });
			expect(product.weight).toBe(1.5);
			expect(product.weightUnit).toBe("lb");
			expect(product.isFeatured).toBe(true);
		});

		it("generates unique IDs", async () => {
			const p1 = await createTestProduct({ slug: "product-1" });
			const p2 = await createTestProduct({ slug: "product-2" });
			expect(p1.id).not.toBe(p2.id);
		});

		it("persists product to data store", async () => {
			const product = await createTestProduct();
			const stored = await mockData.get("product", product.id);
			expect(stored).not.toBeNull();
		});
	});

	// ── getProduct ──

	describe("getProduct", () => {
		it("returns product by ID", async () => {
			const created = await createTestProduct();
			const found = await controller.getProduct(created.id);
			expect(found?.name).toBe("Test Product");
		});

		it("returns null for non-existent ID", async () => {
			const found = await controller.getProduct("non-existent");
			expect(found).toBeNull();
		});
	});

	// ── getProductBySlug ──

	describe("getProductBySlug", () => {
		it("returns product by slug", async () => {
			await createTestProduct();
			const found = await controller.getProductBySlug("test-product");
			expect(found?.name).toBe("Test Product");
		});

		it("returns null for non-existent slug", async () => {
			const found = await controller.getProductBySlug("non-existent");
			expect(found).toBeNull();
		});
	});

	// ── getProductWithVariants ──

	describe("getProductWithVariants", () => {
		it("returns product with empty variants when none exist", async () => {
			const product = await createTestProduct();
			const result = await controller.getProductWithVariants(product.id);
			expect(result?.id).toBe(product.id);
			expect(result?.variants).toEqual([]);
			expect(result?.category).toBeUndefined();
		});

		it("includes variants", async () => {
			const product = await createTestProduct();
			await controller.createVariant({
				productId: product.id,
				name: "Small",
				price: 2999,
				options: { size: "S" },
			});
			await controller.createVariant({
				productId: product.id,
				name: "Large",
				price: 3499,
				options: { size: "L" },
			});

			const result = await controller.getProductWithVariants(product.id);
			expect(result?.variants).toHaveLength(2);
		});

		it("includes category when assigned", async () => {
			const category = await createTestCategory();
			const product = await createTestProduct({ categoryId: category.id });
			const result = await controller.getProductWithVariants(product.id);
			expect(result?.category?.name).toBe("Test Category");
		});

		it("returns null for non-existent product", async () => {
			const result = await controller.getProductWithVariants("missing");
			expect(result).toBeNull();
		});
	});

	// ── updateProduct ──

	describe("updateProduct", () => {
		it("updates basic fields", async () => {
			const created = await createTestProduct();
			const updated = await controller.updateProduct(created.id, {
				name: "Updated Product",
				price: 3999,
			});
			expect(updated.name).toBe("Updated Product");
			expect(updated.price).toBe(3999);
		});

		it("preserves fields not in update", async () => {
			const created = await createTestProduct({
				description: "Original",
				tags: ["tag1"],
			});
			const updated = await controller.updateProduct(created.id, {
				name: "New Name",
			});
			expect(updated.description).toBe("Original");
			expect(updated.tags).toEqual(["tag1"]);
		});

		it("updates the updatedAt timestamp", async () => {
			const created = await createTestProduct();
			const updated = await controller.updateProduct(created.id, {
				name: "Updated",
			});
			expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
				created.updatedAt.getTime(),
			);
		});

		it("throws for non-existent product", async () => {
			await expect(
				controller.updateProduct("missing", { name: "X" }),
			).rejects.toThrow("Product missing not found");
		});

		it("preserves createdAt", async () => {
			const created = await createTestProduct();
			const updated = await controller.updateProduct(created.id, {
				name: "Updated",
			});
			expect(updated.createdAt.getTime()).toBe(created.createdAt.getTime());
		});
	});

	// ── deleteProduct ──

	describe("deleteProduct", () => {
		it("deletes a product", async () => {
			const product = await createTestProduct();
			await controller.deleteProduct(product.id);
			const found = await controller.getProduct(product.id);
			expect(found).toBeNull();
		});

		it("cascade-deletes all variants", async () => {
			const product = await createTestProduct();
			await controller.createVariant({
				productId: product.id,
				name: "V1",
				price: 100,
				options: { size: "S" },
			});
			await controller.createVariant({
				productId: product.id,
				name: "V2",
				price: 200,
				options: { size: "M" },
			});

			await controller.deleteProduct(product.id);

			const variants = await controller.getVariantsByProduct(product.id);
			expect(variants).toHaveLength(0);
		});
	});

	// ── listProducts ──

	describe("listProducts", () => {
		it("returns empty list when no products exist", async () => {
			const result = await controller.listProducts();
			expect(result.products).toHaveLength(0);
			expect(result.total).toBe(0);
			expect(result.page).toBe(1);
			expect(result.limit).toBe(20);
		});

		it("paginates results", async () => {
			for (let i = 0; i < 5; i++) {
				await createTestProduct({ slug: `product-${i}` });
			}

			const page1 = await controller.listProducts({ page: 1, limit: 2 });
			expect(page1.products).toHaveLength(2);
			expect(page1.total).toBe(5);

			const page3 = await controller.listProducts({ page: 3, limit: 2 });
			expect(page3.products).toHaveLength(1);
		});

		it("filters by status", async () => {
			await createTestProduct({ slug: "active-1", status: "active" });
			await createTestProduct({ slug: "draft-1", status: "draft" });

			const result = await controller.listProducts({ status: "active" });
			expect(result.products).toHaveLength(1);
			expect(result.products[0].status).toBe("active");
		});

		it("filters by featured", async () => {
			await createTestProduct({ slug: "featured", isFeatured: true });
			await createTestProduct({ slug: "normal", isFeatured: false });

			const result = await controller.listProducts({ featured: true });
			expect(result.products).toHaveLength(1);
			expect(result.products[0].isFeatured).toBe(true);
		});

		it("filters by price range", async () => {
			await createTestProduct({ slug: "cheap", price: 1000 });
			await createTestProduct({ slug: "mid", price: 3000 });
			await createTestProduct({ slug: "expensive", price: 5000 });

			const result = await controller.listProducts({
				minPrice: 2000,
				maxPrice: 4000,
			});
			expect(result.products).toHaveLength(1);
			expect(result.products[0].slug).toBe("mid");
		});

		it("filters by in-stock", async () => {
			await createTestProduct({ slug: "in-stock", inventory: 10 });
			await createTestProduct({ slug: "out-of-stock", inventory: 0 });

			const result = await controller.listProducts({ inStock: true });
			expect(result.products).toHaveLength(1);
			expect(result.products[0].slug).toBe("in-stock");
		});

		it("filters by tag", async () => {
			await createTestProduct({ slug: "tagged", tags: ["Sale", "New"] });
			await createTestProduct({ slug: "untagged", tags: [] });

			const result = await controller.listProducts({ tag: "sale" });
			expect(result.products).toHaveLength(1);
			expect(result.products[0].slug).toBe("tagged");
		});

		it("filters by search query", async () => {
			await createTestProduct({
				name: "Blue Widget",
				slug: "blue-widget",
			});
			await createTestProduct({
				name: "Red Gadget",
				slug: "red-gadget",
			});

			const result = await controller.listProducts({ search: "widget" });
			expect(result.products).toHaveLength(1);
			expect(result.products[0].name).toBe("Blue Widget");
		});

		it("filters by category", async () => {
			const cat = await createTestCategory();
			await createTestProduct({ slug: "in-cat", categoryId: cat.id });
			await createTestProduct({ slug: "no-cat" });

			const result = await controller.listProducts({ category: cat.id });
			expect(result.products).toHaveLength(1);
			expect(result.products[0].slug).toBe("in-cat");
		});

		it("includes variants in results", async () => {
			const product = await createTestProduct();
			await controller.createVariant({
				productId: product.id,
				name: "V1",
				price: 100,
				options: { size: "S" },
			});

			const result = await controller.listProducts();
			expect(result.products[0].variants).toHaveLength(1);
		});
	});

	// ── searchProducts ──

	describe("searchProducts", () => {
		it("searches active products by name", async () => {
			await createTestProduct({
				name: "Blue Widget",
				slug: "blue-widget",
				status: "active",
			});
			await createTestProduct({
				name: "Red Gadget",
				slug: "red-gadget",
				status: "active",
			});

			const results = await controller.searchProducts("widget");
			expect(results).toHaveLength(1);
			expect(results[0].name).toBe("Blue Widget");
		});

		it("excludes non-active products", async () => {
			await createTestProduct({
				name: "Draft Widget",
				slug: "draft-widget",
				status: "draft",
			});

			const results = await controller.searchProducts("widget");
			expect(results).toHaveLength(0);
		});

		it("searches by description", async () => {
			await createTestProduct({
				slug: "p1",
				status: "active",
				description: "A wonderful ceramic vase",
			});

			const results = await controller.searchProducts("ceramic");
			expect(results).toHaveLength(1);
		});

		it("searches by tags", async () => {
			await createTestProduct({
				slug: "p1",
				status: "active",
				tags: ["handmade", "artisan"],
			});

			const results = await controller.searchProducts("artisan");
			expect(results).toHaveLength(1);
		});

		it("is case-insensitive", async () => {
			await createTestProduct({
				name: "BLUE Widget",
				slug: "blue-widget",
				status: "active",
			});

			const results = await controller.searchProducts("blue widget");
			expect(results).toHaveLength(1);
		});

		it("respects limit", async () => {
			for (let i = 0; i < 5; i++) {
				await createTestProduct({
					name: `Widget ${i}`,
					slug: `widget-${i}`,
					status: "active",
				});
			}

			const results = await controller.searchProducts("Widget", 2);
			expect(results).toHaveLength(2);
		});
	});

	// ── getFeaturedProducts ──

	describe("getFeaturedProducts", () => {
		it("returns only active featured products", async () => {
			await createTestProduct({
				slug: "featured-active",
				isFeatured: true,
				status: "active",
			});
			await createTestProduct({
				slug: "featured-draft",
				isFeatured: true,
				status: "draft",
			});
			await createTestProduct({
				slug: "not-featured",
				isFeatured: false,
				status: "active",
			});

			const results = await controller.getFeaturedProducts();
			expect(results).toHaveLength(1);
			expect(results[0].slug).toBe("featured-active");
		});

		it("respects limit", async () => {
			for (let i = 0; i < 5; i++) {
				await createTestProduct({
					slug: `featured-${i}`,
					isFeatured: true,
					status: "active",
				});
			}

			const results = await controller.getFeaturedProducts(3);
			expect(results).toHaveLength(3);
		});

		it("returns empty array when no featured products", async () => {
			await createTestProduct({ isFeatured: false, status: "active" });
			const results = await controller.getFeaturedProducts();
			expect(results).toHaveLength(0);
		});
	});

	// ── getProductsByCategory ──

	describe("getProductsByCategory", () => {
		it("returns active products in a category", async () => {
			const cat = await createTestCategory();
			await createTestProduct({
				slug: "active",
				categoryId: cat.id,
				status: "active",
			});
			await createTestProduct({
				slug: "draft",
				categoryId: cat.id,
				status: "draft",
			});

			const results = await controller.getProductsByCategory(cat.id);
			expect(results).toHaveLength(1);
			expect(results[0].slug).toBe("active");
		});

		it("returns empty for category with no products", async () => {
			const results = await controller.getProductsByCategory("empty-cat");
			expect(results).toHaveLength(0);
		});
	});

	// ── getRelatedProducts ──

	describe("getRelatedProducts", () => {
		it("scores higher for same category", async () => {
			const cat = await createTestCategory();
			const product = await createTestProduct({
				slug: "main",
				categoryId: cat.id,
				status: "active",
			});
			await createTestProduct({
				slug: "same-cat",
				categoryId: cat.id,
				status: "active",
			});
			await createTestProduct({
				slug: "diff-cat",
				status: "active",
			});

			const result = await controller.getRelatedProducts(product.id);
			expect(result.products[0].slug).toBe("same-cat");
		});

		it("scores higher for shared tags", async () => {
			const product = await createTestProduct({
				slug: "main",
				tags: ["electronics", "sale"],
				status: "active",
			});
			await createTestProduct({
				slug: "two-tags",
				tags: ["electronics", "sale"],
				status: "active",
			});
			await createTestProduct({
				slug: "one-tag",
				tags: ["electronics"],
				status: "active",
			});

			const result = await controller.getRelatedProducts(product.id);
			expect(result.products[0].slug).toBe("two-tags");
		});

		it("excludes the product itself", async () => {
			const product = await createTestProduct({
				slug: "main",
				status: "active",
			});

			const result = await controller.getRelatedProducts(product.id);
			expect(result.products.find((p) => p.id === product.id)).toBeUndefined();
		});

		it("returns empty for non-existent product", async () => {
			const result = await controller.getRelatedProducts("missing");
			expect(result.products).toHaveLength(0);
		});

		it("respects limit", async () => {
			const product = await createTestProduct({
				slug: "main",
				status: "active",
			});
			for (let i = 0; i < 5; i++) {
				await createTestProduct({ slug: `related-${i}`, status: "active" });
			}

			const result = await controller.getRelatedProducts(product.id, 2);
			expect(result.products).toHaveLength(2);
		});
	});

	// ── Inventory ──

	describe("checkAvailability", () => {
		it("returns available when inventory sufficient", async () => {
			const product = await createTestProduct({ inventory: 10 });
			const result = await controller.checkAvailability(product.id);
			expect(result.available).toBe(true);
			expect(result.inventory).toBe(10);
		});

		it("returns unavailable when inventory insufficient", async () => {
			const product = await createTestProduct({ inventory: 2 });
			const result = await controller.checkAvailability(
				product.id,
				undefined,
				5,
			);
			expect(result.available).toBe(false);
		});

		it("returns available when backorder allowed", async () => {
			const product = await createTestProduct({
				inventory: 0,
				allowBackorder: true,
			});
			const result = await controller.checkAvailability(product.id);
			expect(result.available).toBe(true);
			expect(result.allowBackorder).toBe(true);
		});

		it("always available when trackInventory is false", async () => {
			const product = await createTestProduct({
				inventory: 0,
				trackInventory: false,
			});
			const result = await controller.checkAvailability(product.id);
			expect(result.available).toBe(true);
		});

		it("checks variant inventory", async () => {
			const product = await createTestProduct();
			const variant = await controller.createVariant({
				productId: product.id,
				name: "Small",
				price: 100,
				options: { size: "S" },
				inventory: 5,
			});

			const result = await controller.checkAvailability(product.id, variant.id);
			expect(result.available).toBe(true);
			expect(result.inventory).toBe(5);
		});

		it("returns unavailable for missing product", async () => {
			const result = await controller.checkAvailability("missing");
			expect(result.available).toBe(false);
			expect(result.inventory).toBe(0);
		});

		it("returns unavailable for missing variant", async () => {
			const product = await createTestProduct();
			const result = await controller.checkAvailability(
				product.id,
				"missing-variant",
			);
			expect(result.available).toBe(false);
		});
	});

	describe("decrementInventory", () => {
		it("decrements product inventory", async () => {
			const product = await createTestProduct({ inventory: 10 });
			await controller.decrementInventory(product.id, 3);

			const updated = await controller.getProduct(product.id);
			expect(updated?.inventory).toBe(7);
		});

		it("allows inventory to go negative (no floor)", async () => {
			const product = await createTestProduct({ inventory: 2 });
			await controller.decrementInventory(product.id, 5);

			const updated = await controller.getProduct(product.id);
			expect(updated?.inventory).toBe(-3);
		});

		it("skips untracked products", async () => {
			const product = await createTestProduct({
				inventory: 10,
				trackInventory: false,
			});
			await controller.decrementInventory(product.id, 3);

			const updated = await controller.getProduct(product.id);
			expect(updated?.inventory).toBe(10);
		});

		it("decrements variant inventory", async () => {
			const product = await createTestProduct();
			const variant = await controller.createVariant({
				productId: product.id,
				name: "Small",
				price: 100,
				options: { size: "S" },
				inventory: 10,
			});

			await controller.decrementInventory(product.id, 4, variant.id);

			const updated = await controller.getVariant(variant.id);
			expect(updated?.inventory).toBe(6);
		});
	});

	describe("incrementInventory", () => {
		it("increments product inventory", async () => {
			const product = await createTestProduct({ inventory: 5 });
			await controller.incrementInventory(product.id, 10);

			const updated = await controller.getProduct(product.id);
			expect(updated?.inventory).toBe(15);
		});

		it("skips untracked products", async () => {
			const product = await createTestProduct({
				inventory: 5,
				trackInventory: false,
			});
			await controller.incrementInventory(product.id, 10);

			const updated = await controller.getProduct(product.id);
			expect(updated?.inventory).toBe(5);
		});

		it("increments variant inventory", async () => {
			const product = await createTestProduct();
			const variant = await controller.createVariant({
				productId: product.id,
				name: "Small",
				price: 100,
				options: { size: "S" },
				inventory: 5,
			});

			await controller.incrementInventory(product.id, 10, variant.id);

			const updated = await controller.getVariant(variant.id);
			expect(updated?.inventory).toBe(15);
		});
	});

	// ── Variants ──

	describe("createVariant", () => {
		it("creates a variant with required fields", async () => {
			const product = await createTestProduct();
			const variant = await controller.createVariant({
				productId: product.id,
				name: "Small Blue",
				price: 2999,
				options: { size: "S", color: "blue" },
			});

			expect(variant.id).toBeDefined();
			expect(variant.productId).toBe(product.id);
			expect(variant.name).toBe("Small Blue");
			expect(variant.price).toBe(2999);
			expect(variant.options).toEqual({ size: "S", color: "blue" });
			expect(variant.inventory).toBe(0);
			expect(variant.position).toBe(0);
		});

		it("updates parent product updatedAt", async () => {
			const product = await createTestProduct();
			const originalUpdatedAt = product.updatedAt;

			await controller.createVariant({
				productId: product.id,
				name: "Small",
				price: 100,
				options: { size: "S" },
			});

			const updatedProduct = await controller.getProduct(product.id);
			expect(updatedProduct?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				originalUpdatedAt.getTime(),
			);
		});

		it("applies defaults for optional fields", async () => {
			const product = await createTestProduct();
			const variant = await controller.createVariant({
				productId: product.id,
				name: "Default",
				price: 100,
				options: {},
			});

			expect(variant.inventory).toBe(0);
			expect(variant.images).toEqual([]);
			expect(variant.position).toBe(0);
		});
	});

	describe("getVariant", () => {
		it("returns variant by ID", async () => {
			const product = await createTestProduct();
			const variant = await controller.createVariant({
				productId: product.id,
				name: "Small",
				price: 100,
				options: { size: "S" },
			});

			const found = await controller.getVariant(variant.id);
			expect(found?.name).toBe("Small");
		});

		it("returns null for non-existent variant", async () => {
			const found = await controller.getVariant("missing");
			expect(found).toBeNull();
		});
	});

	describe("getVariantsByProduct", () => {
		it("returns variants sorted by position", async () => {
			const product = await createTestProduct();
			await controller.createVariant({
				productId: product.id,
				name: "Second",
				price: 200,
				options: { size: "L" },
				position: 2,
			});
			await controller.createVariant({
				productId: product.id,
				name: "First",
				price: 100,
				options: { size: "S" },
				position: 1,
			});

			const variants = await controller.getVariantsByProduct(product.id);
			expect(variants).toHaveLength(2);
			expect(variants[0].name).toBe("First");
			expect(variants[1].name).toBe("Second");
		});

		it("returns empty for product with no variants", async () => {
			const product = await createTestProduct();
			const variants = await controller.getVariantsByProduct(product.id);
			expect(variants).toHaveLength(0);
		});

		it("isolates variants per product", async () => {
			const p1 = await createTestProduct({ slug: "p1" });
			const p2 = await createTestProduct({ slug: "p2" });

			await controller.createVariant({
				productId: p1.id,
				name: "P1 Var",
				price: 100,
				options: {},
			});
			await controller.createVariant({
				productId: p2.id,
				name: "P2 Var",
				price: 200,
				options: {},
			});

			const p1Variants = await controller.getVariantsByProduct(p1.id);
			expect(p1Variants).toHaveLength(1);
			expect(p1Variants[0].name).toBe("P1 Var");
		});
	});

	describe("updateVariant", () => {
		it("updates variant fields", async () => {
			const product = await createTestProduct();
			const variant = await controller.createVariant({
				productId: product.id,
				name: "Small",
				price: 100,
				options: { size: "S" },
			});

			const updated = await controller.updateVariant(variant.id, {
				name: "Medium",
				price: 200,
			});
			expect(updated.name).toBe("Medium");
			expect(updated.price).toBe(200);
		});

		it("updates parent product updatedAt", async () => {
			const product = await createTestProduct();
			const variant = await controller.createVariant({
				productId: product.id,
				name: "Small",
				price: 100,
				options: { size: "S" },
			});

			await controller.updateVariant(variant.id, { price: 150 });

			const updatedProduct = await controller.getProduct(product.id);
			expect(updatedProduct?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				product.updatedAt.getTime(),
			);
		});

		it("throws for non-existent variant", async () => {
			await expect(
				controller.updateVariant("missing", { name: "X" }),
			).rejects.toThrow("Variant missing not found");
		});
	});

	describe("deleteVariant", () => {
		it("deletes a variant", async () => {
			const product = await createTestProduct();
			const variant = await controller.createVariant({
				productId: product.id,
				name: "Small",
				price: 100,
				options: { size: "S" },
			});

			await controller.deleteVariant(variant.id);
			const found = await controller.getVariant(variant.id);
			expect(found).toBeNull();
		});

		it("updates parent product updatedAt", async () => {
			const product = await createTestProduct();
			const variant = await controller.createVariant({
				productId: product.id,
				name: "Small",
				price: 100,
				options: { size: "S" },
			});

			await controller.deleteVariant(variant.id);

			const updatedProduct = await controller.getProduct(product.id);
			expect(updatedProduct?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				product.updatedAt.getTime(),
			);
		});
	});

	// ── Categories ──

	describe("createCategory", () => {
		it("creates a category with defaults", async () => {
			const cat = await createTestCategory();
			expect(cat.id).toBeDefined();
			expect(cat.name).toBe("Test Category");
			expect(cat.slug).toBe("test-category");
			expect(cat.position).toBe(0);
			expect(cat.isVisible).toBe(true);
			expect(cat.createdAt).toBeInstanceOf(Date);
		});

		it("creates with all optional fields", async () => {
			const cat = await createTestCategory({
				description: "A category",
				parentId: "parent-1",
				image: "cat.jpg",
				position: 5,
				isVisible: false,
				metadata: { key: "value" },
			});
			expect(cat.description).toBe("A category");
			expect(cat.parentId).toBe("parent-1");
			expect(cat.image).toBe("cat.jpg");
			expect(cat.position).toBe(5);
			expect(cat.isVisible).toBe(false);
		});
	});

	describe("getCategory", () => {
		it("returns category by ID", async () => {
			const cat = await createTestCategory();
			const found = await controller.getCategory(cat.id);
			expect(found?.name).toBe("Test Category");
		});

		it("returns null for missing category", async () => {
			const found = await controller.getCategory("missing");
			expect(found).toBeNull();
		});
	});

	describe("getCategoryBySlug", () => {
		it("returns category by slug", async () => {
			await createTestCategory();
			const found = await controller.getCategoryBySlug("test-category");
			expect(found?.name).toBe("Test Category");
		});

		it("returns null for missing slug", async () => {
			const found = await controller.getCategoryBySlug("missing");
			expect(found).toBeNull();
		});
	});

	describe("listCategories", () => {
		it("returns categories sorted by position", async () => {
			await createTestCategory({ slug: "second", position: 2 });
			await createTestCategory({ slug: "first", position: 1 });

			const result = await controller.listCategories();
			expect(result.categories[0].slug).toBe("first");
			expect(result.categories[1].slug).toBe("second");
		});

		it("filters by parentId", async () => {
			const parent = await createTestCategory({ slug: "parent" });
			await createTestCategory({ slug: "child", parentId: parent.id });
			await createTestCategory({ slug: "orphan" });

			const result = await controller.listCategories({
				parentId: parent.id,
			});
			expect(result.categories).toHaveLength(1);
			expect(result.categories[0].slug).toBe("child");
		});

		it("filters by visible", async () => {
			await createTestCategory({ slug: "visible", isVisible: true });
			await createTestCategory({ slug: "hidden", isVisible: false });

			const result = await controller.listCategories({ visible: true });
			expect(result.categories).toHaveLength(1);
			expect(result.categories[0].slug).toBe("visible");
		});
	});

	describe("getCategoryTree", () => {
		it("builds hierarchical tree", async () => {
			const parent = await createTestCategory({
				slug: "parent",
				isVisible: true,
			});
			await createTestCategory({
				slug: "child-1",
				parentId: parent.id,
				isVisible: true,
				position: 1,
			});
			await createTestCategory({
				slug: "child-2",
				parentId: parent.id,
				isVisible: true,
				position: 2,
			});

			const tree = await controller.getCategoryTree();
			expect(tree).toHaveLength(1);
			expect(tree[0].slug).toBe("parent");
			expect(tree[0].children).toHaveLength(2);
			expect(tree[0].children[0].slug).toBe("child-1");
		});

		it("excludes invisible categories", async () => {
			await createTestCategory({ slug: "visible", isVisible: true });
			await createTestCategory({ slug: "hidden", isVisible: false });

			const tree = await controller.getCategoryTree();
			expect(tree).toHaveLength(1);
		});

		it("promotes orphans to root when parent is not visible", async () => {
			const parent = await createTestCategory({
				slug: "hidden-parent",
				isVisible: false,
			});
			await createTestCategory({
				slug: "orphan-child",
				parentId: parent.id,
				isVisible: true,
			});

			const tree = await controller.getCategoryTree();
			expect(tree).toHaveLength(1);
			expect(tree[0].slug).toBe("orphan-child");
		});
	});

	describe("updateCategory", () => {
		it("updates category fields", async () => {
			const cat = await createTestCategory();
			const updated = await controller.updateCategory(cat.id, {
				name: "Updated Category",
			});
			expect(updated.name).toBe("Updated Category");
		});

		it("throws for non-existent category", async () => {
			await expect(
				controller.updateCategory("missing", { name: "X" }),
			).rejects.toThrow("Category missing not found");
		});

		it("preserves createdAt", async () => {
			const cat = await createTestCategory();
			const updated = await controller.updateCategory(cat.id, {
				name: "Updated",
			});
			expect(updated.createdAt.getTime()).toBe(cat.createdAt.getTime());
		});
	});

	describe("deleteCategory", () => {
		it("deletes a category", async () => {
			const cat = await createTestCategory();
			await controller.deleteCategory(cat.id);
			const found = await controller.getCategory(cat.id);
			expect(found).toBeNull();
		});

		it("orphans products in the category", async () => {
			const cat = await createTestCategory();
			const product = await createTestProduct({ categoryId: cat.id });

			await controller.deleteCategory(cat.id);

			const updated = await controller.getProduct(product.id);
			expect(updated?.categoryId).toBeUndefined();
		});

		it("orphans subcategories", async () => {
			const parent = await createTestCategory({ slug: "parent" });
			const child = await createTestCategory({
				slug: "child",
				parentId: parent.id,
			});

			await controller.deleteCategory(parent.id);

			const updated = await controller.getCategory(child.id);
			expect(updated?.parentId).toBeUndefined();
		});
	});

	// ── Bulk ──

	describe("bulkUpdateStatus", () => {
		it("updates status of multiple products", async () => {
			const p1 = await createTestProduct({ slug: "p1" });
			const p2 = await createTestProduct({ slug: "p2" });

			const result = await controller.bulkUpdateStatus(
				[p1.id, p2.id],
				"active",
			);
			expect(result.updated).toBe(2);

			const u1 = await controller.getProduct(p1.id);
			const u2 = await controller.getProduct(p2.id);
			expect(u1?.status).toBe("active");
			expect(u2?.status).toBe("active");
		});

		it("skips non-existent products", async () => {
			const p1 = await createTestProduct({ slug: "p1" });
			const result = await controller.bulkUpdateStatus(
				[p1.id, "missing"],
				"active",
			);
			expect(result.updated).toBe(1);
		});

		it("returns 0 for empty ids", async () => {
			const result = await controller.bulkUpdateStatus([], "active");
			expect(result.updated).toBe(0);
		});
	});

	describe("bulkDelete", () => {
		it("deletes multiple products with their variants", async () => {
			const p1 = await createTestProduct({ slug: "p1" });
			const p2 = await createTestProduct({ slug: "p2" });
			await controller.createVariant({
				productId: p1.id,
				name: "V1",
				price: 100,
				options: {},
			});

			const result = await controller.bulkDelete([p1.id, p2.id]);
			expect(result.deleted).toBe(2);

			expect(await controller.getProduct(p1.id)).toBeNull();
			expect(await controller.getProduct(p2.id)).toBeNull();
			expect(await controller.getVariantsByProduct(p1.id)).toHaveLength(0);
		});

		it("skips non-existent products", async () => {
			const result = await controller.bulkDelete(["missing"]);
			expect(result.deleted).toBe(0);
		});

		it("returns 0 for empty ids", async () => {
			const result = await controller.bulkDelete([]);
			expect(result.deleted).toBe(0);
		});
	});

	// ── Import ──

	describe("importProducts", () => {
		it("creates new products from import rows", async () => {
			const result = await controller.importProducts([
				{ name: "Widget A", price: 19.99 },
				{ name: "Widget B", price: 29.99 },
			]);
			expect(result.created).toBe(2);
			expect(result.updated).toBe(0);
			expect(result.errors).toHaveLength(0);
		});

		it("updates existing products by SKU", async () => {
			await createTestProduct({ sku: "SKU-001", price: 1000 });

			const result = await controller.importProducts([
				{ name: "Updated Widget", price: 20.0, sku: "SKU-001" },
			]);
			expect(result.updated).toBe(1);
			expect(result.created).toBe(0);
		});

		it("reports errors for missing name", async () => {
			const result = await controller.importProducts([{ name: "", price: 10 }]);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0].field).toBe("name");
		});

		it("reports errors for missing price", async () => {
			const result = await controller.importProducts([
				{ name: "Widget", price: undefined as unknown as number },
			]);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0].field).toBe("price");
		});

		it("reports errors for invalid price", async () => {
			const result = await controller.importProducts([
				{ name: "Widget", price: -10 },
			]);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0].field).toBe("price");
		});

		it("auto-generates slugs from name", async () => {
			const result = await controller.importProducts([
				{ name: "My Cool Widget", price: 10 },
			]);
			expect(result.created).toBe(1);

			const products = (await controller.listProducts()).products;
			expect(products[0].slug).toBe("my-cool-widget");
		});

		it("deduplicates slugs", async () => {
			await createTestProduct({ slug: "widget" });

			const result = await controller.importProducts([
				{ name: "Widget", price: 10 },
			]);
			expect(result.created).toBe(1);

			const allProducts = (await controller.listProducts({ limit: 100 }))
				.products;
			const slugs = allProducts.map((p) => p.slug);
			expect(new Set(slugs).size).toBe(slugs.length);
		});

		it("resolves category by name", async () => {
			const cat = await createTestCategory({ name: "Electronics" });

			const result = await controller.importProducts([
				{ name: "Widget", price: 10, category: "electronics" },
			]);
			expect(result.created).toBe(1);

			const products = (await controller.listProducts()).products;
			expect(products[0].categoryId).toBe(cat.id);
		});

		it("converts prices to cents", async () => {
			const result = await controller.importProducts([
				{ name: "Widget", price: "29.99" },
			]);
			expect(result.created).toBe(1);

			const products = (await controller.listProducts()).products;
			expect(products[0].price).toBe(2999);
		});
	});

	// ── Collections ──

	describe("createCollection", () => {
		it("creates a collection with defaults", async () => {
			const col = await createTestCollection();
			expect(col.id).toBeDefined();
			expect(col.name).toBe("Test Collection");
			expect(col.slug).toBe("test-collection");
			expect(col.isFeatured).toBe(false);
			expect(col.isVisible).toBe(true);
			expect(col.position).toBe(0);
		});

		it("creates with all optional fields", async () => {
			const col = await createTestCollection({
				description: "A collection",
				image: "col.jpg",
				isFeatured: true,
				isVisible: false,
				position: 3,
				metadata: { key: "val" },
			});
			expect(col.description).toBe("A collection");
			expect(col.image).toBe("col.jpg");
			expect(col.isFeatured).toBe(true);
			expect(col.isVisible).toBe(false);
			expect(col.position).toBe(3);
		});
	});

	describe("getCollection", () => {
		it("returns collection by ID", async () => {
			const col = await createTestCollection();
			const found = await controller.getCollection(col.id);
			expect(found?.name).toBe("Test Collection");
		});

		it("returns null for missing collection", async () => {
			const found = await controller.getCollection("missing");
			expect(found).toBeNull();
		});
	});

	describe("getCollectionBySlug", () => {
		it("returns collection by slug", async () => {
			await createTestCollection();
			const found = await controller.getCollectionBySlug("test-collection");
			expect(found?.name).toBe("Test Collection");
		});

		it("returns null for missing slug", async () => {
			const found = await controller.getCollectionBySlug("missing");
			expect(found).toBeNull();
		});
	});

	describe("listCollections", () => {
		it("returns collections sorted by position", async () => {
			await createTestCollection({ slug: "second", position: 2 });
			await createTestCollection({ slug: "first", position: 1 });

			const result = await controller.listCollections();
			expect(result.collections[0].slug).toBe("first");
		});

		it("filters by featured", async () => {
			await createTestCollection({ slug: "featured", isFeatured: true });
			await createTestCollection({ slug: "normal", isFeatured: false });

			const result = await controller.listCollections({ featured: true });
			expect(result.collections).toHaveLength(1);
		});

		it("filters by visible", async () => {
			await createTestCollection({ slug: "visible", isVisible: true });
			await createTestCollection({ slug: "hidden", isVisible: false });

			const result = await controller.listCollections({ visible: true });
			expect(result.collections).toHaveLength(1);
		});
	});

	describe("searchCollections", () => {
		it("searches by name", async () => {
			await createTestCollection({
				name: "Summer Sale",
				slug: "summer-sale",
				isVisible: true,
			});
			await createTestCollection({
				name: "Winter Collection",
				slug: "winter",
				isVisible: true,
			});

			const results = await controller.searchCollections("summer");
			expect(results).toHaveLength(1);
			expect(results[0].name).toBe("Summer Sale");
		});

		it("excludes non-visible collections", async () => {
			await createTestCollection({
				name: "Hidden Sale",
				slug: "hidden",
				isVisible: false,
			});

			const results = await controller.searchCollections("sale");
			expect(results).toHaveLength(0);
		});

		it("respects limit", async () => {
			for (let i = 0; i < 5; i++) {
				await createTestCollection({
					name: `Sale ${i}`,
					slug: `sale-${i}`,
					isVisible: true,
				});
			}

			const results = await controller.searchCollections("Sale", 2);
			expect(results).toHaveLength(2);
		});
	});

	describe("updateCollection", () => {
		it("updates collection fields", async () => {
			const col = await createTestCollection();
			const updated = await controller.updateCollection(col.id, {
				name: "Updated Collection",
			});
			expect(updated.name).toBe("Updated Collection");
		});

		it("throws for non-existent collection", async () => {
			await expect(
				controller.updateCollection("missing", { name: "X" }),
			).rejects.toThrow("Collection missing not found");
		});
	});

	describe("deleteCollection", () => {
		it("deletes collection and its product links", async () => {
			const col = await createTestCollection();
			const product = await createTestProduct({ status: "active" });
			await controller.addProductToCollection(col.id, product.id);

			await controller.deleteCollection(col.id);

			expect(await controller.getCollection(col.id)).toBeNull();
			const links = await controller.listCollectionProducts(col.id);
			expect(links.products).toHaveLength(0);
		});
	});

	describe("addProductToCollection", () => {
		it("adds a product to a collection", async () => {
			const col = await createTestCollection();
			const product = await createTestProduct();

			const link = await controller.addProductToCollection(col.id, product.id);
			expect(link.collectionId).toBe(col.id);
			expect(link.productId).toBe(product.id);
		});

		it("returns existing link for duplicate", async () => {
			const col = await createTestCollection();
			const product = await createTestProduct();

			const first = await controller.addProductToCollection(col.id, product.id);
			const second = await controller.addProductToCollection(
				col.id,
				product.id,
			);
			expect(first.id).toBe(second.id);
		});

		it("throws for non-existent collection", async () => {
			await expect(
				controller.addProductToCollection("missing", "prod-1"),
			).rejects.toThrow("Collection missing not found");
		});

		it("updates collection updatedAt", async () => {
			const col = await createTestCollection();
			const product = await createTestProduct();

			await controller.addProductToCollection(col.id, product.id);

			const updated = await controller.getCollection(col.id);
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				col.updatedAt.getTime(),
			);
		});
	});

	describe("removeProductFromCollection", () => {
		it("removes a product from a collection", async () => {
			const col = await createTestCollection();
			const product = await createTestProduct();
			await controller.addProductToCollection(col.id, product.id);

			await controller.removeProductFromCollection(col.id, product.id);

			const links = await controller.listCollectionProducts(col.id);
			expect(links.products).toHaveLength(0);
		});
	});

	describe("getCollectionWithProducts", () => {
		it("returns collection with active products", async () => {
			const col = await createTestCollection();
			const activeProduct = await createTestProduct({
				slug: "active",
				status: "active",
			});
			const draftProduct = await createTestProduct({
				slug: "draft",
				status: "draft",
			});

			await controller.addProductToCollection(col.id, activeProduct.id);
			await controller.addProductToCollection(col.id, draftProduct.id);

			const result = await controller.getCollectionWithProducts(col.id);
			expect(result?.products).toHaveLength(1);
			expect(result?.products[0].slug).toBe("active");
		});

		it("returns null for missing collection", async () => {
			const result = await controller.getCollectionWithProducts("missing");
			expect(result).toBeNull();
		});
	});

	describe("listCollectionProducts", () => {
		it("returns all products regardless of status", async () => {
			const col = await createTestCollection();
			const active = await createTestProduct({
				slug: "active",
				status: "active",
			});
			const draft = await createTestProduct({
				slug: "draft",
				status: "draft",
			});

			await controller.addProductToCollection(col.id, active.id);
			await controller.addProductToCollection(col.id, draft.id);

			const result = await controller.listCollectionProducts(col.id);
			expect(result.products).toHaveLength(2);
		});

		it("returns empty for non-existent collection", async () => {
			const result = await controller.listCollectionProducts("missing");
			expect(result.products).toHaveLength(0);
		});
	});

	// ── Integration ──

	describe("integration", () => {
		it("full product lifecycle: create → add variants → update → delete", async () => {
			// Create
			const product = await controller.createProduct({
				name: "Lifecycle Product",
				slug: "lifecycle",
				price: 2999,
				status: "active",
				tags: ["test"],
			});
			expect(product.id).toBeDefined();

			// Add variants
			const v1 = await controller.createVariant({
				productId: product.id,
				name: "Small",
				price: 2999,
				options: { size: "S" },
				inventory: 10,
			});
			const v2 = await controller.createVariant({
				productId: product.id,
				name: "Large",
				price: 3499,
				options: { size: "L" },
				inventory: 5,
			});

			// Verify with variants
			const withVariants = await controller.getProductWithVariants(product.id);
			expect(withVariants?.variants).toHaveLength(2);

			// Check availability
			const avail = await controller.checkAvailability(product.id, v1.id);
			expect(avail.available).toBe(true);
			expect(avail.inventory).toBe(10);

			// Decrement inventory
			await controller.decrementInventory(product.id, 7, v1.id);
			const afterDecrement = await controller.getVariant(v1.id);
			expect(afterDecrement?.inventory).toBe(3);

			// Update product
			await controller.updateProduct(product.id, {
				name: "Updated Lifecycle",
			});
			const updated = await controller.getProduct(product.id);
			expect(updated?.name).toBe("Updated Lifecycle");

			// Search should find it
			const searchResults = await controller.searchProducts("lifecycle");
			expect(searchResults).toHaveLength(1);

			// Delete cascades variants
			await controller.deleteProduct(product.id);
			expect(await controller.getProduct(product.id)).toBeNull();
			expect(await controller.getVariant(v1.id)).toBeNull();
			expect(await controller.getVariant(v2.id)).toBeNull();
		});

		it("category hierarchy with products", async () => {
			const parent = await controller.createCategory({
				name: "Electronics",
				slug: "electronics",
				isVisible: true,
			});
			const child = await controller.createCategory({
				name: "Phones",
				slug: "phones",
				parentId: parent.id,
				isVisible: true,
			});

			const product = await controller.createProduct({
				name: "iPhone",
				slug: "iphone",
				price: 99900,
				status: "active",
				categoryId: child.id,
			});

			// Tree should show hierarchy
			const tree = await controller.getCategoryTree();
			expect(tree).toHaveLength(1);
			expect(tree[0].children).toHaveLength(1);

			// Deleting parent orphans child
			await controller.deleteCategory(parent.id);
			const updatedChild = await controller.getCategory(child.id);
			expect(updatedChild?.parentId).toBeUndefined();

			// Product still exists
			const foundProduct = await controller.getProduct(product.id);
			expect(foundProduct?.categoryId).toBe(child.id);
		});

		it("collection with multiple products", async () => {
			const col = await controller.createCollection({
				name: "Summer Sale",
				slug: "summer-sale",
			});

			const p1 = await createTestProduct({
				slug: "p1",
				status: "active",
			});
			const p2 = await createTestProduct({
				slug: "p2",
				status: "active",
			});
			const p3 = await createTestProduct({
				slug: "p3",
				status: "draft",
			});

			await controller.addProductToCollection(col.id, p1.id, 1);
			await controller.addProductToCollection(col.id, p2.id, 2);
			await controller.addProductToCollection(col.id, p3.id, 3);

			// getWithProducts filters to active only
			const withProducts = await controller.getCollectionWithProducts(col.id);
			expect(withProducts?.products).toHaveLength(2);

			// listCollectionProducts includes all statuses
			const allProducts = await controller.listCollectionProducts(col.id);
			expect(allProducts.products).toHaveLength(3);

			// Remove one product
			await controller.removeProductFromCollection(col.id, p1.id);
			const afterRemove = await controller.listCollectionProducts(col.id);
			expect(afterRemove.products).toHaveLength(2);

			// Delete collection cleans up links
			await controller.deleteCollection(col.id);
			expect(await controller.getCollection(col.id)).toBeNull();
		});

		it("import with mixed create and update", async () => {
			// Seed existing product
			await createTestProduct({ slug: "existing", sku: "EXISTING-SKU" });

			// Seed category
			await createTestCategory({ name: "Widgets" });

			const result = await controller.importProducts([
				// New product
				{ name: "New Widget", price: 15.0, category: "widgets" },
				// Update by SKU
				{
					name: "Updated Product",
					price: 25.0,
					sku: "EXISTING-SKU",
					description: "Updated via import",
				},
				// Invalid: missing name
				{ name: "", price: 10 },
			]);

			expect(result.created).toBe(1);
			expect(result.updated).toBe(1);
			expect(result.errors).toHaveLength(1);
		});
	});
});
