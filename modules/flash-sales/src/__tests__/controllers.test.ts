import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createFlashSaleController } from "../service-impl";

/**
 * Controller-level edge-case tests for flash-sales.
 * Complements service-impl.test.ts by focusing on boundary conditions,
 * concurrency-like patterns, and data integrity.
 */

describe("flash-sales controller edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createFlashSaleController>;

	const past = new Date(Date.now() - 3600_000);
	const future = new Date(Date.now() + 3600_000);

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createFlashSaleController(mockData);
	});

	describe("slug uniqueness and lookup", () => {
		it("getFlashSaleBySlug returns null for non-existent slug", async () => {
			const result = await controller.getFlashSaleBySlug("does-not-exist");
			expect(result).toBeNull();
		});

		it("getFlashSaleBySlug returns correct sale when multiple exist", async () => {
			await controller.createFlashSale({
				name: "Sale A",
				slug: "sale-a",
				startsAt: past,
				endsAt: future,
			});
			await controller.createFlashSale({
				name: "Sale B",
				slug: "sale-b",
				startsAt: past,
				endsAt: future,
			});

			const saleA = await controller.getFlashSaleBySlug("sale-a");
			expect(saleA?.name).toBe("Sale A");
			const saleB = await controller.getFlashSaleBySlug("sale-b");
			expect(saleB?.name).toBe("Sale B");
		});
	});

	describe("update edge cases", () => {
		it("updating non-existent sale returns null", async () => {
			const result = await controller.updateFlashSale("nonexistent", {
				name: "Updated",
			});
			expect(result).toBeNull();
		});

		it("setting description to null clears it", async () => {
			const sale = await controller.createFlashSale({
				name: "Sale",
				slug: "sale",
				description: "Original description",
				startsAt: past,
				endsAt: future,
			});

			const updated = await controller.updateFlashSale(sale.id, {
				description: null,
			});
			expect(updated).not.toBeNull();
			expect(updated?.description).toBeUndefined();
		});

		it("updatedAt timestamp changes on update", async () => {
			const sale = await controller.createFlashSale({
				name: "Sale",
				slug: "sale",
				startsAt: past,
				endsAt: future,
			});

			const updated = await controller.updateFlashSale(sale.id, {
				name: "Updated Name",
			});
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				sale.updatedAt.getTime(),
			);
		});

		it("partial update preserves unchanged fields", async () => {
			const sale = await controller.createFlashSale({
				name: "Original",
				slug: "original",
				description: "Keep this",
				status: "scheduled",
				startsAt: past,
				endsAt: future,
			});

			const updated = await controller.updateFlashSale(sale.id, {
				name: "Changed",
			});
			expect(updated?.name).toBe("Changed");
			expect(updated?.slug).toBe("original");
			expect(updated?.description).toBe("Keep this");
			expect(updated?.status).toBe("scheduled");
		});
	});

	describe("delete edge cases", () => {
		it("deleting non-existent sale returns false", async () => {
			const result = await controller.deleteFlashSale("nonexistent");
			expect(result).toBe(false);
		});

		it("delete is idempotent", async () => {
			const sale = await controller.createFlashSale({
				name: "Sale",
				slug: "sale",
				startsAt: past,
				endsAt: future,
			});
			expect(await controller.deleteFlashSale(sale.id)).toBe(true);
			expect(await controller.deleteFlashSale(sale.id)).toBe(false);
		});
	});

	describe("product upsert behavior", () => {
		it("addProduct with same flashSaleId+productId upserts", async () => {
			const sale = await controller.createFlashSale({
				name: "Sale",
				slug: "sale",
				startsAt: past,
				endsAt: future,
			});

			const first = await controller.addProduct({
				flashSaleId: sale.id,
				productId: "prod_1",
				salePrice: 500,
				originalPrice: 1000,
			});

			// Sell some
			await controller.recordSale(sale.id, "prod_1", 3);

			// Upsert with new price
			const upserted = await controller.addProduct({
				flashSaleId: sale.id,
				productId: "prod_1",
				salePrice: 400,
				originalPrice: 1000,
			});

			// Same id, updated price, preserved stockSold
			expect(upserted.id).toBe(first.id);
			expect(upserted.salePrice).toBe(400);
			expect(upserted.stockSold).toBe(3);
		});

		it("same product in different sales gets separate entries", async () => {
			const sale1 = await controller.createFlashSale({
				name: "Sale 1",
				slug: "sale-1",
				startsAt: past,
				endsAt: future,
			});
			const sale2 = await controller.createFlashSale({
				name: "Sale 2",
				slug: "sale-2",
				startsAt: past,
				endsAt: future,
			});

			const p1 = await controller.addProduct({
				flashSaleId: sale1.id,
				productId: "prod_1",
				salePrice: 500,
				originalPrice: 1000,
			});
			const p2 = await controller.addProduct({
				flashSaleId: sale2.id,
				productId: "prod_1",
				salePrice: 600,
				originalPrice: 1000,
			});

			expect(p1.id).not.toBe(p2.id);
			expect(p1.flashSaleId).toBe(sale1.id);
			expect(p2.flashSaleId).toBe(sale2.id);
		});
	});

	describe("updateProduct edge cases", () => {
		it("clearing stockLimit with null", async () => {
			const sale = await controller.createFlashSale({
				name: "Sale",
				slug: "sale",
				startsAt: past,
				endsAt: future,
			});
			await controller.addProduct({
				flashSaleId: sale.id,
				productId: "prod_1",
				salePrice: 500,
				originalPrice: 1000,
				stockLimit: 10,
			});

			const updated = await controller.updateProduct(sale.id, "prod_1", {
				stockLimit: null,
			});
			expect(updated).not.toBeNull();
			expect(updated?.stockLimit).toBeUndefined();
		});

		it("preserving stockLimit when not specified", async () => {
			const sale = await controller.createFlashSale({
				name: "Sale",
				slug: "sale",
				startsAt: past,
				endsAt: future,
			});
			await controller.addProduct({
				flashSaleId: sale.id,
				productId: "prod_1",
				salePrice: 500,
				originalPrice: 1000,
				stockLimit: 10,
			});

			const updated = await controller.updateProduct(sale.id, "prod_1", {
				salePrice: 400,
			});
			expect(updated?.stockLimit).toBe(10);
			expect(updated?.salePrice).toBe(400);
		});

		it("updating non-existent product returns null", async () => {
			const sale = await controller.createFlashSale({
				name: "Sale",
				slug: "sale",
				startsAt: past,
				endsAt: future,
			});

			const result = await controller.updateProduct(sale.id, "nonexistent", {
				salePrice: 400,
			});
			expect(result).toBeNull();
		});
	});

	describe("removeProduct edge cases", () => {
		it("removing non-existent product returns false", async () => {
			const sale = await controller.createFlashSale({
				name: "Sale",
				slug: "sale",
				startsAt: past,
				endsAt: future,
			});

			const result = await controller.removeProduct(sale.id, "nonexistent");
			expect(result).toBe(false);
		});
	});

	describe("bulkAddProducts", () => {
		it("bulk add creates all entries", async () => {
			const sale = await controller.createFlashSale({
				name: "Sale",
				slug: "sale",
				startsAt: past,
				endsAt: future,
			});

			const products = await controller.bulkAddProducts(sale.id, [
				{ productId: "p1", salePrice: 500, originalPrice: 1000 },
				{ productId: "p2", salePrice: 700, originalPrice: 1400, stockLimit: 5 },
				{ productId: "p3", salePrice: 300, originalPrice: 600, sortOrder: 2 },
			]);

			expect(products).toHaveLength(3);
			const count = await controller.countProducts(sale.id);
			expect(count).toBe(3);
		});

		it("bulk add with duplicate productIds upserts", async () => {
			const sale = await controller.createFlashSale({
				name: "Sale",
				slug: "sale",
				startsAt: past,
				endsAt: future,
			});

			await controller.bulkAddProducts(sale.id, [
				{ productId: "p1", salePrice: 500, originalPrice: 1000 },
				{ productId: "p1", salePrice: 400, originalPrice: 1000 },
			]);

			const count = await controller.countProducts(sale.id);
			expect(count).toBe(1);

			const products = await controller.listProducts(sale.id);
			expect(products[0].salePrice).toBe(400);
		});
	});

	describe("getActiveProductDeals batch query", () => {
		it("returns deals only for products with active sales", async () => {
			const activeSale = await controller.createFlashSale({
				name: "Active",
				slug: "active",
				status: "active",
				startsAt: past,
				endsAt: future,
			});
			const draftSale = await controller.createFlashSale({
				name: "Draft",
				slug: "draft",
				status: "draft",
				startsAt: past,
				endsAt: future,
			});

			await controller.addProduct({
				flashSaleId: activeSale.id,
				productId: "prod_active",
				salePrice: 500,
				originalPrice: 1000,
			});
			await controller.addProduct({
				flashSaleId: draftSale.id,
				productId: "prod_draft",
				salePrice: 500,
				originalPrice: 1000,
			});

			const deals = await controller.getActiveProductDeals([
				"prod_active",
				"prod_draft",
				"prod_missing",
			]);

			expect(Object.keys(deals)).toHaveLength(1);
			expect(deals.prod_active).toBeDefined();
			expect(deals.prod_draft).toBeUndefined();
			expect(deals.prod_missing).toBeUndefined();
		});

		it("returns empty object for no matching products", async () => {
			const deals = await controller.getActiveProductDeals([
				"nonexistent_1",
				"nonexistent_2",
			]);
			expect(deals).toEqual({});
		});
	});

	describe("listing and pagination", () => {
		it("listFlashSales respects take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createFlashSale({
					name: `Sale ${i}`,
					slug: `sale-${i}`,
					startsAt: new Date(Date.now() - (5 - i) * 3600_000),
					endsAt: future,
				});
			}

			const page1 = await controller.listFlashSales({ take: 2, skip: 0 });
			expect(page1).toHaveLength(2);

			const page2 = await controller.listFlashSales({ take: 2, skip: 2 });
			expect(page2).toHaveLength(2);

			const page3 = await controller.listFlashSales({ take: 2, skip: 4 });
			expect(page3).toHaveLength(1);
		});

		it("listProducts respects take and skip", async () => {
			const sale = await controller.createFlashSale({
				name: "Sale",
				slug: "sale",
				startsAt: past,
				endsAt: future,
			});

			for (let i = 0; i < 5; i++) {
				await controller.addProduct({
					flashSaleId: sale.id,
					productId: `prod_${i}`,
					salePrice: 500,
					originalPrice: 1000,
					sortOrder: i,
				});
			}

			const page1 = await controller.listProducts(sale.id, {
				take: 2,
				skip: 0,
			});
			expect(page1).toHaveLength(2);

			const page2 = await controller.listProducts(sale.id, {
				take: 10,
				skip: 3,
			});
			expect(page2).toHaveLength(2);
		});
	});

	describe("discount calculation", () => {
		it("calculates correct discount percentage", async () => {
			const sale = await controller.createFlashSale({
				name: "Sale",
				slug: "sale",
				status: "active",
				startsAt: past,
				endsAt: future,
			});
			await controller.addProduct({
				flashSaleId: sale.id,
				productId: "prod_1",
				salePrice: 750,
				originalPrice: 1000,
			});

			const deal = await controller.getActiveProductDeal("prod_1");
			expect(deal?.discountPercent).toBe(25);
		});

		it("handles zero original price gracefully", async () => {
			const sale = await controller.createFlashSale({
				name: "Sale",
				slug: "sale",
				status: "active",
				startsAt: past,
				endsAt: future,
			});
			await controller.addProduct({
				flashSaleId: sale.id,
				productId: "prod_1",
				salePrice: 0,
				originalPrice: 0,
			});

			const deal = await controller.getActiveProductDeal("prod_1");
			expect(deal?.discountPercent).toBe(0);
		});
	});

	describe("stats accuracy", () => {
		it("stats reflect all sale statuses", async () => {
			await controller.createFlashSale({
				name: "Draft",
				slug: "draft",
				status: "draft",
				startsAt: past,
				endsAt: future,
			});
			await controller.createFlashSale({
				name: "Scheduled",
				slug: "scheduled",
				status: "scheduled",
				startsAt: past,
				endsAt: future,
			});
			const active = await controller.createFlashSale({
				name: "Active",
				slug: "active",
				status: "active",
				startsAt: past,
				endsAt: future,
			});
			await controller.createFlashSale({
				name: "Ended",
				slug: "ended",
				status: "ended",
				startsAt: past,
				endsAt: future,
			});

			await controller.addProduct({
				flashSaleId: active.id,
				productId: "prod_1",
				salePrice: 500,
				originalPrice: 1000,
			});
			await controller.recordSale(active.id, "prod_1", 7);

			const stats = await controller.getStats();
			expect(stats.totalSales).toBe(4);
			expect(stats.draftSales).toBe(1);
			expect(stats.scheduledSales).toBe(1);
			expect(stats.activeSales).toBe(1);
			expect(stats.endedSales).toBe(1);
			expect(stats.totalProducts).toBe(1);
			expect(stats.totalUnitsSold).toBe(7);
		});

		it("empty store returns zero stats", async () => {
			const stats = await controller.getStats();
			expect(stats.totalSales).toBe(0);
			expect(stats.totalUnitsSold).toBe(0);
		});
	});
});
