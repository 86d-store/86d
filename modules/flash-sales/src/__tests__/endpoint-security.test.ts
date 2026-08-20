import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createFlashSaleController } from "../service-impl";
import { getProductDealParamsSchema } from "../store/endpoints/get-product-deal";
import { getProductDealsBodySchema } from "../store/endpoints/get-product-deals";

/**
 * Security regression tests for flash-sales endpoints.
 *
 * Flash sales are public-read endpoints (no auth required for store-facing),
 * so security focuses on:
 * - Only truly active sales (status + date range) are visible on storefront
 * - Draft/scheduled/ended sales are never exposed via store endpoints
 * - Stock limits are enforced and cannot be bypassed
 * - Date boundaries are strictly enforced
 */

describe("flash-sales endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createFlashSaleController>;

	const past = new Date(Date.now() - 3600_000);
	const future = new Date(Date.now() + 3600_000);
	const farPast = new Date(Date.now() - 7200_000);
	const farFuture = new Date(Date.now() + 7200_000);

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createFlashSaleController(mockData);
	});

	describe("storefront visibility rules", () => {
		it("draft sales are never returned by getActiveSales", async () => {
			await controller.createFlashSale({
				name: "Draft Sale",
				slug: "draft-sale",
				status: "draft",
				startsAt: past,
				endsAt: future,
			});

			const active = await controller.getActiveSales();
			expect(active).toHaveLength(0);
		});

		it("scheduled sales are never returned by getActiveSales", async () => {
			await controller.createFlashSale({
				name: "Scheduled Sale",
				slug: "scheduled-sale",
				status: "scheduled",
				startsAt: past,
				endsAt: future,
			});

			const active = await controller.getActiveSales();
			expect(active).toHaveLength(0);
		});

		it("ended sales are never returned by getActiveSales", async () => {
			await controller.createFlashSale({
				name: "Ended Sale",
				slug: "ended-sale",
				status: "ended",
				startsAt: past,
				endsAt: future,
			});

			const active = await controller.getActiveSales();
			expect(active).toHaveLength(0);
		});

		it("future active sales (not yet started) are not visible", async () => {
			await controller.createFlashSale({
				name: "Future Sale",
				slug: "future-sale",
				status: "active",
				startsAt: future,
				endsAt: farFuture,
			});

			const active = await controller.getActiveSales();
			expect(active).toHaveLength(0);
		});

		it("past active sales (already ended by date) are not visible", async () => {
			await controller.createFlashSale({
				name: "Past Sale",
				slug: "past-sale",
				status: "active",
				startsAt: farPast,
				endsAt: past,
			});

			const active = await controller.getActiveSales();
			expect(active).toHaveLength(0);
		});

		it("only active + in-date-range sales are visible", async () => {
			// Visible
			await controller.createFlashSale({
				name: "Live Sale",
				slug: "live-sale",
				status: "active",
				startsAt: past,
				endsAt: future,
			});

			// Not visible (draft)
			await controller.createFlashSale({
				name: "Draft",
				slug: "draft",
				status: "draft",
				startsAt: past,
				endsAt: future,
			});

			// Not visible (future start)
			await controller.createFlashSale({
				name: "Future",
				slug: "future",
				status: "active",
				startsAt: future,
				endsAt: farFuture,
			});

			const active = await controller.getActiveSales();
			expect(active).toHaveLength(1);
			expect(active[0].name).toBe("Live Sale");
		});
	});

	describe("product deal visibility", () => {
		it("sanitizes and bounds product lookup input", () => {
			expect(
				getProductDealParamsSchema.parse({
					productId: "  <b>prod_1</b>  ",
				}).productId,
			).toBe("prod_1");

			expect(
				getProductDealsBodySchema.parse({
					productIds: ["  <b>prod_1</b>  ", "prod_2"],
				}).productIds,
			).toEqual(["prod_1", "prod_2"]);

			expect(() =>
				getProductDealsBodySchema.parse({
					productIds: ["x".repeat(201)],
				}),
			).toThrow();
		});

		it("getActiveProductDeal returns null for products in draft sales", async () => {
			const sale = await controller.createFlashSale({
				name: "Draft",
				slug: "draft",
				status: "draft",
				startsAt: past,
				endsAt: future,
			});
			await controller.addProduct({
				flashSaleId: sale.id,
				productId: "prod_1",
				salePrice: 500,
				originalPrice: 1000,
			});

			const deal = await controller.getActiveProductDeal("prod_1");
			expect(deal).toBeNull();
		});

		it("getActiveProductDeal returns null for sold-out products", async () => {
			const sale = await controller.createFlashSale({
				name: "Active",
				slug: "active",
				status: "active",
				startsAt: past,
				endsAt: future,
			});
			await controller.addProduct({
				flashSaleId: sale.id,
				productId: "prod_1",
				salePrice: 500,
				originalPrice: 1000,
				stockLimit: 5,
			});

			// Sell all stock
			await controller.recordSale(sale.id, "prod_1", 5);

			const deal = await controller.getActiveProductDeal("prod_1");
			expect(deal).toBeNull();
		});

		it("getActiveProductDeal returns deal for active in-stock products", async () => {
			const sale = await controller.createFlashSale({
				name: "Active Sale",
				slug: "active-sale",
				status: "active",
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
			await controller.recordSale(sale.id, "prod_1", 3);

			const deal = await controller.getActiveProductDeal("prod_1");
			expect(deal).not.toBeNull();
			expect(deal?.discountPercent).toBe(50);
			expect(deal?.stockRemaining).toBe(7);
		});
	});

	describe("stock limit enforcement", () => {
		it("recordSale rejects quantity exceeding stock limit", async () => {
			const sale = await controller.createFlashSale({
				name: "Limited",
				slug: "limited",
				status: "active",
				startsAt: past,
				endsAt: future,
			});
			await controller.addProduct({
				flashSaleId: sale.id,
				productId: "prod_1",
				salePrice: 500,
				originalPrice: 1000,
				stockLimit: 3,
			});

			// First sale succeeds
			const first = await controller.recordSale(sale.id, "prod_1", 2);
			expect(first).not.toBeNull();
			expect(first?.stockSold).toBe(2);

			// Exceeding limit returns null
			const overflow = await controller.recordSale(sale.id, "prod_1", 2);
			expect(overflow).toBeNull();

			// Exact remaining succeeds
			const exact = await controller.recordSale(sale.id, "prod_1", 1);
			expect(exact).not.toBeNull();
			expect(exact?.stockSold).toBe(3);
		});

		it("unlimited stock products never reject", async () => {
			const sale = await controller.createFlashSale({
				name: "Unlimited",
				slug: "unlimited",
				status: "active",
				startsAt: past,
				endsAt: future,
			});
			await controller.addProduct({
				flashSaleId: sale.id,
				productId: "prod_1",
				salePrice: 500,
				originalPrice: 1000,
			});

			// Large quantity succeeds
			const result = await controller.recordSale(sale.id, "prod_1", 1000);
			expect(result).not.toBeNull();
			expect(result?.stockSold).toBe(1000);
		});

		it("recordSale returns null for non-existent product", async () => {
			const sale = await controller.createFlashSale({
				name: "Sale",
				slug: "sale",
				status: "active",
				startsAt: past,
				endsAt: future,
			});

			const result = await controller.recordSale(sale.id, "nonexistent", 1);
			expect(result).toBeNull();
		});
	});

	describe("cascade deletion security", () => {
		it("deleting a sale removes all its products", async () => {
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
				salePrice: 500,
				originalPrice: 1000,
			});
			await controller.addProduct({
				flashSaleId: sale.id,
				productId: "prod_2",
				salePrice: 700,
				originalPrice: 1400,
			});

			await controller.deleteFlashSale(sale.id);

			// Products should be gone
			const count = await controller.countProducts(sale.id);
			expect(count).toBe(0);
		});

		it("deleting a sale does not affect other sales' products", async () => {
			const sale1 = await controller.createFlashSale({
				name: "Sale 1",
				slug: "sale-1",
				status: "active",
				startsAt: past,
				endsAt: future,
			});
			const sale2 = await controller.createFlashSale({
				name: "Sale 2",
				slug: "sale-2",
				status: "active",
				startsAt: past,
				endsAt: future,
			});
			await controller.addProduct({
				flashSaleId: sale1.id,
				productId: "prod_1",
				salePrice: 500,
				originalPrice: 1000,
			});
			await controller.addProduct({
				flashSaleId: sale2.id,
				productId: "prod_2",
				salePrice: 700,
				originalPrice: 1400,
			});

			await controller.deleteFlashSale(sale1.id);

			const count2 = await controller.countProducts(sale2.id);
			expect(count2).toBe(1);
		});
	});
});
