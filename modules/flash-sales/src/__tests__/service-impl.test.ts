import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createFlashSaleController } from "../service-impl";

describe("createFlashSaleController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createFlashSaleController>;

	const past = new Date(Date.now() - 86400000);
	const future = new Date(Date.now() + 86400000);
	const farFuture = new Date(Date.now() + 172800000);

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createFlashSaleController(mockData);
	});

	async function createTestSale(
		overrides: Partial<Parameters<typeof controller.createFlashSale>[0]> = {},
	) {
		return controller.createFlashSale({
			name: "Summer Blowout",
			slug: "summer-blowout",
			startsAt: past,
			endsAt: future,
			...overrides,
		});
	}

	async function addTestProduct(
		flashSaleId: string,
		overrides: Partial<Parameters<typeof controller.addProduct>[0]> = {},
	) {
		return controller.addProduct({
			flashSaleId,
			productId: "product-1",
			salePrice: 29.99,
			originalPrice: 59.99,
			...overrides,
		});
	}

	// ── createFlashSale ──

	describe("createFlashSale", () => {
		it("creates a flash sale with required fields", async () => {
			const sale = await createTestSale();
			expect(sale.id).toBeDefined();
			expect(sale.name).toBe("Summer Blowout");
			expect(sale.slug).toBe("summer-blowout");
			expect(sale.status).toBe("draft");
			expect(sale.startsAt).toEqual(past);
			expect(sale.endsAt).toEqual(future);
			expect(sale.createdAt).toBeInstanceOf(Date);
			expect(sale.updatedAt).toBeInstanceOf(Date);
		});

		it("creates a flash sale with all optional fields", async () => {
			const sale = await createTestSale({
				description: "Huge summer savings!",
				status: "scheduled",
			});
			expect(sale.description).toBe("Huge summer savings!");
			expect(sale.status).toBe("scheduled");
		});

		it("assigns unique IDs to each flash sale", async () => {
			const s1 = await createTestSale({ slug: "a" });
			const s2 = await createTestSale({ slug: "b" });
			expect(s1.id).not.toBe(s2.id);
		});

		it("defaults status to draft", async () => {
			const sale = await createTestSale();
			expect(sale.status).toBe("draft");
		});
	});

	// ── getFlashSale ──

	describe("getFlashSale", () => {
		it("returns an existing flash sale by ID", async () => {
			const created = await createTestSale();
			const fetched = await controller.getFlashSale(created.id);
			expect(fetched).not.toBeNull();
			expect(fetched?.name).toBe("Summer Blowout");
		});

		it("returns null for non-existent ID", async () => {
			const result = await controller.getFlashSale("missing");
			expect(result).toBeNull();
		});
	});

	// ── getFlashSaleBySlug ──

	describe("getFlashSaleBySlug", () => {
		it("returns a flash sale by slug", async () => {
			await createTestSale({ slug: "flash-friday" });
			const result = await controller.getFlashSaleBySlug("flash-friday");
			expect(result).not.toBeNull();
			expect(result?.slug).toBe("flash-friday");
		});

		it("returns null for non-existent slug", async () => {
			const result = await controller.getFlashSaleBySlug("nope");
			expect(result).toBeNull();
		});
	});

	// ── updateFlashSale ──

	describe("updateFlashSale", () => {
		it("updates name and slug", async () => {
			const created = await createTestSale();
			const updated = await controller.updateFlashSale(created.id, {
				name: "Winter Sale",
				slug: "winter-sale",
			});
			expect(updated).not.toBeNull();
			expect(updated?.name).toBe("Winter Sale");
			expect(updated?.slug).toBe("winter-sale");
		});

		it("updates status", async () => {
			const created = await createTestSale({ status: "draft" });
			const updated = await controller.updateFlashSale(created.id, {
				status: "active",
			});
			expect(updated?.status).toBe("active");
		});

		it("updates dates", async () => {
			const created = await createTestSale();
			const newStart = new Date("2026-07-01");
			const newEnd = new Date("2026-07-31");
			const updated = await controller.updateFlashSale(created.id, {
				startsAt: newStart,
				endsAt: newEnd,
			});
			expect(updated?.startsAt).toEqual(newStart);
			expect(updated?.endsAt).toEqual(newEnd);
		});

		it("clears description with null", async () => {
			const created = await createTestSale({
				description: "Old description",
			});
			const updated = await controller.updateFlashSale(created.id, {
				description: null,
			});
			expect(updated?.description).toBeUndefined();
		});

		it("preserves fields not included in update", async () => {
			const created = await createTestSale({
				description: "Keep me",
				status: "scheduled",
			});
			const updated = await controller.updateFlashSale(created.id, {
				name: "New Name",
			});
			expect(updated?.description).toBe("Keep me");
			expect(updated?.status).toBe("scheduled");
		});

		it("returns null for non-existent ID", async () => {
			const result = await controller.updateFlashSale("missing", {
				name: "X",
			});
			expect(result).toBeNull();
		});

		it("updates the updatedAt timestamp", async () => {
			const created = await createTestSale();
			const updated = await controller.updateFlashSale(created.id, {
				name: "Updated",
			});
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				created.updatedAt.getTime(),
			);
		});
	});

	// ── deleteFlashSale ──

	describe("deleteFlashSale", () => {
		it("deletes a flash sale and its products", async () => {
			const sale = await createTestSale();
			await addTestProduct(sale.id, { productId: "p1" });
			await addTestProduct(sale.id, { productId: "p2" });

			const deleted = await controller.deleteFlashSale(sale.id);
			expect(deleted).toBe(true);

			const fetched = await controller.getFlashSale(sale.id);
			expect(fetched).toBeNull();

			const products = await controller.listProducts(sale.id);
			expect(products).toHaveLength(0);
		});

		it("returns false for non-existent ID", async () => {
			const result = await controller.deleteFlashSale("missing");
			expect(result).toBe(false);
		});
	});

	// ── listFlashSales ──

	describe("listFlashSales", () => {
		it("returns all flash sales", async () => {
			await createTestSale({ slug: "a" });
			await createTestSale({ slug: "b" });
			await createTestSale({ slug: "c" });

			const results = await controller.listFlashSales();
			expect(results).toHaveLength(3);
		});

		it("filters by status", async () => {
			await createTestSale({ slug: "a", status: "draft" });
			await createTestSale({ slug: "b", status: "active" });
			await createTestSale({ slug: "c", status: "active" });

			const active = await controller.listFlashSales({
				status: "active",
			});
			expect(active).toHaveLength(2);

			const draft = await controller.listFlashSales({ status: "draft" });
			expect(draft).toHaveLength(1);
		});

		it("supports pagination", async () => {
			await createTestSale({ slug: "a" });
			await createTestSale({ slug: "b" });
			await createTestSale({ slug: "c" });

			const page = await controller.listFlashSales({
				take: 2,
				skip: 0,
			});
			expect(page).toHaveLength(2);
		});
	});

	// ── countFlashSales ──

	describe("countFlashSales", () => {
		it("counts all flash sales", async () => {
			await createTestSale({ slug: "a" });
			await createTestSale({ slug: "b" });

			const count = await controller.countFlashSales();
			expect(count).toBe(2);
		});

		it("counts filtered flash sales", async () => {
			await createTestSale({ slug: "a", status: "draft" });
			await createTestSale({ slug: "b", status: "active" });

			const count = await controller.countFlashSales({
				status: "active",
			});
			expect(count).toBe(1);
		});
	});

	// ── addProduct ──

	describe("addProduct", () => {
		it("adds a product to a flash sale", async () => {
			const sale = await createTestSale();
			const product = await addTestProduct(sale.id);
			expect(product.id).toBeDefined();
			expect(product.flashSaleId).toBe(sale.id);
			expect(product.productId).toBe("product-1");
			expect(product.salePrice).toBe(29.99);
			expect(product.originalPrice).toBe(59.99);
			expect(product.stockSold).toBe(0);
			expect(product.sortOrder).toBe(0);
			expect(product.createdAt).toBeInstanceOf(Date);
		});

		it("adds a product with stock limit", async () => {
			const sale = await createTestSale();
			const product = await addTestProduct(sale.id, {
				stockLimit: 50,
			});
			expect(product.stockLimit).toBe(50);
		});

		it("adds a product with custom sort order", async () => {
			const sale = await createTestSale();
			const product = await addTestProduct(sale.id, {
				sortOrder: 5,
			});
			expect(product.sortOrder).toBe(5);
		});

		it("upserts: updates existing product entry", async () => {
			const sale = await createTestSale();
			const first = await addTestProduct(sale.id, { salePrice: 30 });
			const second = await addTestProduct(sale.id, { salePrice: 25 });

			expect(second.id).toBe(first.id);
			expect(second.salePrice).toBe(25);
		});

		it("preserves stockSold on upsert", async () => {
			const sale = await createTestSale({ status: "active" });
			await addTestProduct(sale.id, { stockLimit: 100 });
			await controller.recordSale(sale.id, "product-1", 10);

			const updated = await addTestProduct(sale.id, { salePrice: 20 });
			expect(updated.stockSold).toBe(10);
		});

		it("creates separate entries for different products", async () => {
			const sale = await createTestSale();
			const p1 = await addTestProduct(sale.id, { productId: "p1" });
			const p2 = await addTestProduct(sale.id, { productId: "p2" });
			expect(p1.id).not.toBe(p2.id);
		});

		it("stores productName when provided", async () => {
			const sale = await createTestSale();
			const product = await controller.addProduct({
				flashSaleId: sale.id,
				productId: "product-1",
				salePrice: 29.99,
				originalPrice: 59.99,
				productName: "Blue Widget",
			});
			expect(product.productName).toBe("Blue Widget");
		});

		it("stores productSlug when provided", async () => {
			const sale = await createTestSale();
			const product = await controller.addProduct({
				flashSaleId: sale.id,
				productId: "product-1",
				salePrice: 29.99,
				originalPrice: 59.99,
				productSlug: "blue-widget",
			});
			expect(product.productSlug).toBe("blue-widget");
		});

		it("stores productImage when provided", async () => {
			const sale = await createTestSale();
			const product = await controller.addProduct({
				flashSaleId: sale.id,
				productId: "product-1",
				salePrice: 29.99,
				originalPrice: 59.99,
				productImage: "https://example.com/widget.jpg",
			});
			expect(product.productImage).toBe("https://example.com/widget.jpg");
		});

		it("omits metadata fields when not provided", async () => {
			const sale = await createTestSale();
			const product = await addTestProduct(sale.id);
			expect(product.productName).toBeUndefined();
			expect(product.productSlug).toBeUndefined();
			expect(product.productImage).toBeUndefined();
		});

		it("preserves metadata on upsert", async () => {
			const sale = await createTestSale();
			await controller.addProduct({
				flashSaleId: sale.id,
				productId: "product-1",
				salePrice: 29.99,
				originalPrice: 59.99,
				productName: "Blue Widget",
				productSlug: "blue-widget",
			});
			// Upsert with updated price — metadata should persist
			const updated = await controller.addProduct({
				flashSaleId: sale.id,
				productId: "product-1",
				salePrice: 19.99,
				originalPrice: 59.99,
				productName: "Blue Widget Updated",
			});
			expect(updated.salePrice).toBe(19.99);
			expect(updated.productName).toBe("Blue Widget Updated");
		});
	});

	// ── updateProduct ──

	describe("updateProduct", () => {
		it("updates sale price", async () => {
			const sale = await createTestSale();
			await addTestProduct(sale.id);

			const updated = await controller.updateProduct(sale.id, "product-1", {
				salePrice: 19.99,
			});
			expect(updated).not.toBeNull();
			expect(updated?.salePrice).toBe(19.99);
		});

		it("updates original price", async () => {
			const sale = await createTestSale();
			await addTestProduct(sale.id);

			const updated = await controller.updateProduct(sale.id, "product-1", {
				originalPrice: 79.99,
			});
			expect(updated?.originalPrice).toBe(79.99);
		});

		it("sets stock limit", async () => {
			const sale = await createTestSale();
			await addTestProduct(sale.id);

			const updated = await controller.updateProduct(sale.id, "product-1", {
				stockLimit: 25,
			});
			expect(updated?.stockLimit).toBe(25);
		});

		it("clears stock limit with null", async () => {
			const sale = await createTestSale();
			await addTestProduct(sale.id, { stockLimit: 50 });

			const updated = await controller.updateProduct(sale.id, "product-1", {
				stockLimit: null,
			});
			expect(updated?.stockLimit).toBeUndefined();
		});

		it("preserves stock limit when not specified", async () => {
			const sale = await createTestSale();
			await addTestProduct(sale.id, { stockLimit: 50 });

			const updated = await controller.updateProduct(sale.id, "product-1", {
				salePrice: 19.99,
			});
			expect(updated?.stockLimit).toBe(50);
		});

		it("updates sort order", async () => {
			const sale = await createTestSale();
			await addTestProduct(sale.id);

			const updated = await controller.updateProduct(sale.id, "product-1", {
				sortOrder: 10,
			});
			expect(updated?.sortOrder).toBe(10);
		});

		it("returns null for non-existent product", async () => {
			const sale = await createTestSale();
			const result = await controller.updateProduct(sale.id, "missing", {
				salePrice: 10,
			});
			expect(result).toBeNull();
		});
	});

	// ── removeProduct ──

	describe("removeProduct", () => {
		it("removes a product from a flash sale", async () => {
			const sale = await createTestSale();
			await addTestProduct(sale.id);

			const removed = await controller.removeProduct(sale.id, "product-1");
			expect(removed).toBe(true);

			const products = await controller.listProducts(sale.id);
			expect(products).toHaveLength(0);
		});

		it("returns false for non-existent product", async () => {
			const sale = await createTestSale();
			const removed = await controller.removeProduct(sale.id, "missing");
			expect(removed).toBe(false);
		});
	});

	// ── listProducts ──

	describe("listProducts", () => {
		it("lists all products for a flash sale", async () => {
			const sale = await createTestSale();
			await addTestProduct(sale.id, { productId: "p1" });
			await addTestProduct(sale.id, { productId: "p2" });
			await addTestProduct(sale.id, { productId: "p3" });

			const products = await controller.listProducts(sale.id);
			expect(products).toHaveLength(3);
		});

		it("supports pagination", async () => {
			const sale = await createTestSale();
			await addTestProduct(sale.id, { productId: "p1" });
			await addTestProduct(sale.id, { productId: "p2" });
			await addTestProduct(sale.id, { productId: "p3" });

			const page = await controller.listProducts(sale.id, {
				take: 2,
				skip: 0,
			});
			expect(page).toHaveLength(2);
		});

		it("returns empty array for sale with no products", async () => {
			const sale = await createTestSale();
			const products = await controller.listProducts(sale.id);
			expect(products).toHaveLength(0);
		});
	});

	// ── countProducts ──

	describe("countProducts", () => {
		it("counts products in a flash sale", async () => {
			const sale = await createTestSale();
			await addTestProduct(sale.id, { productId: "p1" });
			await addTestProduct(sale.id, { productId: "p2" });

			const count = await controller.countProducts(sale.id);
			expect(count).toBe(2);
		});

		it("returns 0 for sale with no products", async () => {
			const sale = await createTestSale();
			const count = await controller.countProducts(sale.id);
			expect(count).toBe(0);
		});
	});

	// ── bulkAddProducts ──

	describe("bulkAddProducts", () => {
		it("adds multiple products at once", async () => {
			const sale = await createTestSale();
			const products = await controller.bulkAddProducts(sale.id, [
				{ productId: "p1", salePrice: 10, originalPrice: 20 },
				{ productId: "p2", salePrice: 15, originalPrice: 30 },
				{ productId: "p3", salePrice: 25, originalPrice: 50 },
			]);

			expect(products).toHaveLength(3);
			expect(products[0].productId).toBe("p1");
			expect(products[0].salePrice).toBe(10);
			expect(products[1].productId).toBe("p2");
			expect(products[2].productId).toBe("p3");
		});

		it("supports stock limits in bulk", async () => {
			const sale = await createTestSale();
			const products = await controller.bulkAddProducts(sale.id, [
				{
					productId: "p1",
					salePrice: 10,
					originalPrice: 20,
					stockLimit: 50,
				},
				{
					productId: "p2",
					salePrice: 15,
					originalPrice: 30,
					stockLimit: 100,
				},
			]);
			expect(products[0].stockLimit).toBe(50);
			expect(products[1].stockLimit).toBe(100);
		});

		it("supports sort order in bulk", async () => {
			const sale = await createTestSale();
			const products = await controller.bulkAddProducts(sale.id, [
				{
					productId: "p1",
					salePrice: 10,
					originalPrice: 20,
					sortOrder: 2,
				},
				{
					productId: "p2",
					salePrice: 15,
					originalPrice: 30,
					sortOrder: 1,
				},
			]);
			expect(products[0].sortOrder).toBe(2);
			expect(products[1].sortOrder).toBe(1);
		});

		it("upserts existing products in bulk", async () => {
			const sale = await createTestSale();
			await controller.addProduct({
				flashSaleId: sale.id,
				productId: "p1",
				salePrice: 50,
				originalPrice: 100,
			});

			const products = await controller.bulkAddProducts(sale.id, [
				{ productId: "p1", salePrice: 40, originalPrice: 100 },
			]);
			expect(products).toHaveLength(1);
			expect(products[0].salePrice).toBe(40);

			const count = await controller.countProducts(sale.id);
			expect(count).toBe(1);
		});
	});

	// ── recordSale ──

	describe("recordSale", () => {
		it("increments stockSold", async () => {
			const sale = await createTestSale({ status: "active" });
			await addTestProduct(sale.id, { stockLimit: 100 });

			const result = await controller.recordSale(sale.id, "product-1", 3);
			expect(result).not.toBeNull();
			expect(result?.stockSold).toBe(3);
		});

		it("accumulates multiple sales", async () => {
			const sale = await createTestSale({ status: "active" });
			await addTestProduct(sale.id, { stockLimit: 100 });

			await controller.recordSale(sale.id, "product-1", 5);
			const result = await controller.recordSale(sale.id, "product-1", 3);
			expect(result?.stockSold).toBe(8);
		});

		it("returns null when exceeding stock limit", async () => {
			const sale = await createTestSale({ status: "active" });
			await addTestProduct(sale.id, { stockLimit: 10 });

			await controller.recordSale(sale.id, "product-1", 8);
			const result = await controller.recordSale(sale.id, "product-1", 5);
			expect(result).toBeNull();
		});

		it("allows sales up to exact stock limit", async () => {
			const sale = await createTestSale({ status: "active" });
			await addTestProduct(sale.id, { stockLimit: 10 });

			const result = await controller.recordSale(sale.id, "product-1", 10);
			expect(result).not.toBeNull();
			expect(result?.stockSold).toBe(10);
		});

		it("allows unlimited sales when no stock limit", async () => {
			const sale = await createTestSale({ status: "active" });
			await addTestProduct(sale.id);

			const result = await controller.recordSale(sale.id, "product-1", 1000);
			expect(result).not.toBeNull();
			expect(result?.stockSold).toBe(1000);
		});

		it("returns null for non-existent product", async () => {
			const sale = await createTestSale({ status: "active" });
			const result = await controller.recordSale(sale.id, "missing", 1);
			expect(result).toBeNull();
		});
	});

	// ── getActiveSales ──

	describe("getActiveSales", () => {
		it("returns active sales within date range", async () => {
			await createTestSale({
				slug: "active-now",
				status: "active",
				startsAt: past,
				endsAt: future,
			});

			const sales = await controller.getActiveSales();
			expect(sales).toHaveLength(1);
			expect(sales[0].slug).toBe("active-now");
		});

		it("includes products with active sales", async () => {
			const sale = await createTestSale({
				status: "active",
				startsAt: past,
				endsAt: future,
			});
			await addTestProduct(sale.id, { productId: "p1" });
			await addTestProduct(sale.id, { productId: "p2" });

			const sales = await controller.getActiveSales();
			expect(sales).toHaveLength(1);
			expect(sales[0].products).toHaveLength(2);
		});

		it("excludes draft sales", async () => {
			await createTestSale({
				slug: "draft",
				status: "draft",
				startsAt: past,
				endsAt: future,
			});

			const sales = await controller.getActiveSales();
			expect(sales).toHaveLength(0);
		});

		it("excludes ended sales", async () => {
			await createTestSale({
				slug: "ended",
				status: "ended",
				startsAt: past,
				endsAt: future,
			});

			const sales = await controller.getActiveSales();
			expect(sales).toHaveLength(0);
		});

		it("excludes active sales not yet started", async () => {
			await createTestSale({
				slug: "future",
				status: "active",
				startsAt: future,
				endsAt: farFuture,
			});

			const sales = await controller.getActiveSales();
			expect(sales).toHaveLength(0);
		});

		it("excludes active sales past end date", async () => {
			const farPast = new Date(Date.now() - 172800000);
			await createTestSale({
				slug: "past",
				status: "active",
				startsAt: farPast,
				endsAt: past,
			});

			const sales = await controller.getActiveSales();
			expect(sales).toHaveLength(0);
		});

		it("returns multiple concurrent active sales", async () => {
			await createTestSale({
				slug: "sale-1",
				status: "active",
				startsAt: past,
				endsAt: future,
			});
			await createTestSale({
				slug: "sale-2",
				status: "active",
				startsAt: past,
				endsAt: future,
			});

			const sales = await controller.getActiveSales();
			expect(sales).toHaveLength(2);
		});
	});

	// ── getActiveProductDeal ──

	describe("getActiveProductDeal", () => {
		it("returns deal for product in an active sale", async () => {
			const sale = await createTestSale({
				status: "active",
				startsAt: past,
				endsAt: future,
			});
			await addTestProduct(sale.id, {
				salePrice: 29.99,
				originalPrice: 59.99,
			});

			const deal = await controller.getActiveProductDeal("product-1");
			expect(deal).not.toBeNull();
			expect(deal?.salePrice).toBe(29.99);
			expect(deal?.originalPrice).toBe(59.99);
			expect(deal?.discountPercent).toBe(50);
			expect(deal?.flashSaleId).toBe(sale.id);
			expect(deal?.flashSaleName).toBe("Summer Blowout");
			expect(deal?.endsAt).toEqual(future);
		});

		it("returns null for product not in any sale", async () => {
			const deal = await controller.getActiveProductDeal("missing");
			expect(deal).toBeNull();
		});

		it("returns null for product in inactive sale", async () => {
			const sale = await createTestSale({
				status: "draft",
				startsAt: past,
				endsAt: future,
			});
			await addTestProduct(sale.id);

			const deal = await controller.getActiveProductDeal("product-1");
			expect(deal).toBeNull();
		});

		it("returns null for product in sale not yet started", async () => {
			const sale = await createTestSale({
				status: "active",
				startsAt: future,
				endsAt: farFuture,
			});
			await addTestProduct(sale.id);

			const deal = await controller.getActiveProductDeal("product-1");
			expect(deal).toBeNull();
		});

		it("returns null when product is sold out", async () => {
			const sale = await createTestSale({
				status: "active",
				startsAt: past,
				endsAt: future,
			});
			await addTestProduct(sale.id, { stockLimit: 5 });
			await controller.recordSale(sale.id, "product-1", 5);

			const deal = await controller.getActiveProductDeal("product-1");
			expect(deal).toBeNull();
		});

		it("calculates stock remaining correctly", async () => {
			const sale = await createTestSale({
				status: "active",
				startsAt: past,
				endsAt: future,
			});
			await addTestProduct(sale.id, { stockLimit: 50 });
			await controller.recordSale(sale.id, "product-1", 20);

			const deal = await controller.getActiveProductDeal("product-1");
			expect(deal?.stockLimit).toBe(50);
			expect(deal?.stockSold).toBe(20);
			expect(deal?.stockRemaining).toBe(30);
		});

		it("returns null stockRemaining when no stock limit", async () => {
			const sale = await createTestSale({
				status: "active",
				startsAt: past,
				endsAt: future,
			});
			await addTestProduct(sale.id);

			const deal = await controller.getActiveProductDeal("product-1");
			expect(deal?.stockLimit).toBeNull();
			expect(deal?.stockRemaining).toBeNull();
		});

		it("calculates discount percent correctly", async () => {
			const sale = await createTestSale({
				status: "active",
				startsAt: past,
				endsAt: future,
			});
			await addTestProduct(sale.id, {
				salePrice: 75,
				originalPrice: 100,
			});

			const deal = await controller.getActiveProductDeal("product-1");
			expect(deal?.discountPercent).toBe(25);
		});

		it("handles 0 original price gracefully", async () => {
			const sale = await createTestSale({
				status: "active",
				startsAt: past,
				endsAt: future,
			});
			await addTestProduct(sale.id, {
				salePrice: 0,
				originalPrice: 0,
			});

			const deal = await controller.getActiveProductDeal("product-1");
			expect(deal?.discountPercent).toBe(0);
		});
	});

	// ── getActiveProductDeals ──

	describe("getActiveProductDeals", () => {
		it("returns deals for multiple products", async () => {
			const sale = await createTestSale({
				status: "active",
				startsAt: past,
				endsAt: future,
			});
			await addTestProduct(sale.id, {
				productId: "p1",
				salePrice: 10,
				originalPrice: 20,
			});
			await addTestProduct(sale.id, {
				productId: "p2",
				salePrice: 15,
				originalPrice: 30,
			});

			const deals = await controller.getActiveProductDeals(["p1", "p2", "p3"]);
			expect(deals.p1).toBeDefined();
			expect(deals.p1.salePrice).toBe(10);
			expect(deals.p2).toBeDefined();
			expect(deals.p2.salePrice).toBe(15);
			expect(deals.p3).toBeUndefined();
		});

		it("returns empty object when no deals match", async () => {
			const deals = await controller.getActiveProductDeals(["p1", "p2"]);
			expect(Object.keys(deals)).toHaveLength(0);
		});
	});

	// ── getStats ──

	describe("getStats", () => {
		it("returns stats for all flash sales and products", async () => {
			const s1 = await createTestSale({
				slug: "a",
				status: "active",
			});
			await createTestSale({ slug: "b", status: "draft" });
			await createTestSale({ slug: "c", status: "scheduled" });
			await createTestSale({ slug: "d", status: "ended" });

			await addTestProduct(s1.id, { productId: "p1" });
			await addTestProduct(s1.id, { productId: "p2" });
			await controller.recordSale(s1.id, "p1", 10);
			await controller.recordSale(s1.id, "p2", 5);

			const stats = await controller.getStats();
			expect(stats.totalSales).toBe(4);
			expect(stats.draftSales).toBe(1);
			expect(stats.scheduledSales).toBe(1);
			expect(stats.activeSales).toBe(1);
			expect(stats.endedSales).toBe(1);
			expect(stats.totalProducts).toBe(2);
			expect(stats.totalUnitsSold).toBe(15);
		});

		it("returns zeros when empty", async () => {
			const stats = await controller.getStats();
			expect(stats.totalSales).toBe(0);
			expect(stats.draftSales).toBe(0);
			expect(stats.scheduledSales).toBe(0);
			expect(stats.activeSales).toBe(0);
			expect(stats.endedSales).toBe(0);
			expect(stats.totalProducts).toBe(0);
			expect(stats.totalUnitsSold).toBe(0);
		});
	});

	// ── Cascading behavior ──

	describe("cascading behavior", () => {
		it("deleting a flash sale removes all its products", async () => {
			const sale = await createTestSale();
			await addTestProduct(sale.id, { productId: "p1" });
			await addTestProduct(sale.id, { productId: "p2" });
			await addTestProduct(sale.id, { productId: "p3" });

			await controller.deleteFlashSale(sale.id);

			const count = await controller.countProducts(sale.id);
			expect(count).toBe(0);
		});

		it("products from other flash sales are not affected", async () => {
			const s1 = await createTestSale({ slug: "a" });
			const s2 = await createTestSale({ slug: "b" });

			await addTestProduct(s1.id, { productId: "p1" });
			await addTestProduct(s2.id, { productId: "p1" });

			await controller.deleteFlashSale(s1.id);

			const remaining = await controller.countProducts(s2.id);
			expect(remaining).toBe(1);
		});
	});

	// ── Flash sale lifecycle ──

	describe("flash sale lifecycle", () => {
		it("creates as draft, transitions through lifecycle", async () => {
			const sale = await createTestSale({ status: "draft" });
			expect(sale.status).toBe("draft");

			const scheduled = await controller.updateFlashSale(sale.id, {
				status: "scheduled",
			});
			expect(scheduled?.status).toBe("scheduled");

			const active = await controller.updateFlashSale(sale.id, {
				status: "active",
			});
			expect(active?.status).toBe("active");

			const ended = await controller.updateFlashSale(sale.id, {
				status: "ended",
			});
			expect(ended?.status).toBe("ended");
		});

		it("active sale with products shows in active sales", async () => {
			const sale = await createTestSale({
				status: "active",
				startsAt: past,
				endsAt: future,
			});
			await addTestProduct(sale.id, { productId: "p1" });
			await addTestProduct(sale.id, { productId: "p2" });

			const activeSales = await controller.getActiveSales();
			expect(activeSales).toHaveLength(1);
			expect(activeSales[0].products).toHaveLength(2);
		});

		it("product deal unavailable after stock sells out", async () => {
			const sale = await createTestSale({
				status: "active",
				startsAt: past,
				endsAt: future,
			});
			await addTestProduct(sale.id, { stockLimit: 3 });

			// Product available before selling out
			let deal = await controller.getActiveProductDeal("product-1");
			expect(deal).not.toBeNull();

			// Sell all stock
			await controller.recordSale(sale.id, "product-1", 3);

			// Product no longer available
			deal = await controller.getActiveProductDeal("product-1");
			expect(deal).toBeNull();
		});
	});
});
