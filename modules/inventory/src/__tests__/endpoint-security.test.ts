import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { InventoryController } from "../service";
import { createInventoryController } from "../service-impl";

/**
 * Security regression tests for inventory endpoints.
 *
 * Inventory integrity is critical to order fulfillment and financial accuracy.
 * These tests verify:
 * - Stock quantity integrity: available = quantity - reserved, never negative
 * - Negative stock prevention: adjustments and deductions floor at zero
 * - Reservation isolation: reservations for one product/variant/location
 *   never affect another
 * - Concurrent adjustment safety: sequential mutations produce consistent state
 * - Location isolation: warehouse A stock cannot leak into warehouse B
 * - SKU uniqueness: product+variant+location tuples are distinct inventory items
 * - Back-in-stock subscription isolation and email normalization
 */

describe("inventory endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: InventoryController;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createInventoryController(mockData);
	});

	// ── Stock Quantity Integrity ─────────────────────────────────────

	describe("stock quantity integrity", () => {
		it("available is always quantity minus reserved, never negative", async () => {
			await controller.setStock({ productId: "p1", quantity: 10 });
			await controller.reserve({ productId: "p1", quantity: 7 });
			const stock = await controller.getStock({ productId: "p1" });

			expect(stock?.available).toBe(3);
			expect(stock?.available).toBeGreaterThanOrEqual(0);
			expect(stock?.available).toBe(
				(stock?.quantity ?? 0) - (stock?.reserved ?? 0),
			);
		});

		it("available floors at zero when reserved exceeds quantity via backorder", async () => {
			await controller.setStock({
				productId: "p1",
				quantity: 5,
				allowBackorder: true,
			});
			await controller.reserve({ productId: "p1", quantity: 8 });
			const stock = await controller.getStock({ productId: "p1" });

			// reserved > quantity, but available floors at 0
			expect(stock?.reserved).toBe(8);
			expect(stock?.quantity).toBe(5);
			expect(stock?.available).toBe(0);
		});

		it("setStock recalculates available with existing reservations", async () => {
			await controller.setStock({ productId: "p1", quantity: 20 });
			await controller.reserve({ productId: "p1", quantity: 10 });

			// Reduce stock below current reserved — available should floor at 0
			const updated = await controller.setStock({
				productId: "p1",
				quantity: 5,
			});
			expect(updated.reserved).toBe(10);
			expect(updated.quantity).toBe(5);
			expect(updated.available).toBe(0);
		});
	});

	// ── Negative Stock Prevention ────────────────────────────────────

	describe("negative stock prevention", () => {
		it("adjustStock with large negative delta floors quantity at zero", async () => {
			await controller.setStock({ productId: "p1", quantity: 3 });
			const result = await controller.adjustStock({
				productId: "p1",
				delta: -999,
			});

			expect(result?.quantity).toBe(0);
			expect(result?.quantity).toBeGreaterThanOrEqual(0);
		});

		it("deduct floors both quantity and reserved at zero", async () => {
			await controller.setStock({ productId: "p1", quantity: 5 });
			await controller.reserve({ productId: "p1", quantity: 3 });
			const result = await controller.deduct({
				productId: "p1",
				quantity: 100,
			});

			expect(result?.quantity).toBe(0);
			expect(result?.reserved).toBe(0);
			expect(result?.available).toBe(0);
		});

		it("release floors reserved at zero — cannot go negative", async () => {
			await controller.setStock({ productId: "p1", quantity: 10 });
			await controller.reserve({ productId: "p1", quantity: 2 });
			const result = await controller.release({
				productId: "p1",
				quantity: 50,
			});

			expect(result?.reserved).toBe(0);
			expect(result?.available).toBe(10);
		});

		it("reserve rejects when insufficient stock and backorder disabled", async () => {
			await controller.setStock({ productId: "p1", quantity: 5 });
			await controller.reserve({ productId: "p1", quantity: 4 });

			// Only 1 available, requesting 2
			const result = await controller.reserve({
				productId: "p1",
				quantity: 2,
			});
			expect(result).toBeNull();

			// Verify original state is untouched
			const stock = await controller.getStock({ productId: "p1" });
			expect(stock?.reserved).toBe(4);
			expect(stock?.available).toBe(1);
		});
	});

	// ── Reservation Isolation ────────────────────────────────────────

	describe("reservation isolation", () => {
		it("reserving one product does not affect another product", async () => {
			await controller.setStock({ productId: "p1", quantity: 10 });
			await controller.setStock({ productId: "p2", quantity: 10 });

			await controller.reserve({ productId: "p1", quantity: 8 });

			const p2 = await controller.getStock({ productId: "p2" });
			expect(p2?.reserved).toBe(0);
			expect(p2?.available).toBe(10);
		});

		it("reserving one variant does not affect another variant", async () => {
			await controller.setStock({
				productId: "p1",
				variantId: "red",
				quantity: 10,
			});
			await controller.setStock({
				productId: "p1",
				variantId: "blue",
				quantity: 10,
			});

			await controller.reserve({
				productId: "p1",
				variantId: "red",
				quantity: 9,
			});

			const blue = await controller.getStock({
				productId: "p1",
				variantId: "blue",
			});
			expect(blue?.reserved).toBe(0);
			expect(blue?.available).toBe(10);
		});

		it("deducting from one location does not affect another location", async () => {
			await controller.setStock({
				productId: "p1",
				locationId: "warehouse-a",
				quantity: 20,
			});
			await controller.setStock({
				productId: "p1",
				locationId: "warehouse-b",
				quantity: 15,
			});

			await controller.deduct({
				productId: "p1",
				locationId: "warehouse-a",
				quantity: 10,
			});

			const b = await controller.getStock({
				productId: "p1",
				locationId: "warehouse-b",
			});
			expect(b?.quantity).toBe(15);
			expect(b?.available).toBe(15);
		});
	});

	// ── Concurrent Adjustment Safety ─────────────────────────────────

	describe("concurrent adjustment safety", () => {
		it("sequential adjustments produce correct cumulative result", async () => {
			await controller.setStock({ productId: "p1", quantity: 100 });

			await controller.adjustStock({ productId: "p1", delta: -10 });
			await controller.adjustStock({ productId: "p1", delta: -20 });
			await controller.adjustStock({ productId: "p1", delta: 5 });

			const stock = await controller.getStock({ productId: "p1" });
			// 100 - 10 - 20 + 5 = 75
			expect(stock?.quantity).toBe(75);
		});

		it("reserve then release then deduct leaves correct final state", async () => {
			await controller.setStock({ productId: "p1", quantity: 50 });

			// Reserve 20
			await controller.reserve({ productId: "p1", quantity: 20 });
			// Release 5
			await controller.release({ productId: "p1", quantity: 5 });
			// Deduct 10 (fulfillment of 10 reserved units)
			await controller.deduct({ productId: "p1", quantity: 10 });

			const stock = await controller.getStock({ productId: "p1" });
			// quantity: 50 - 10 = 40, reserved: 20 - 5 - 10 = 5
			expect(stock?.quantity).toBe(40);
			expect(stock?.reserved).toBe(5);
			expect(stock?.available).toBe(35);
		});

		it("multiple reservations followed by bulk deduct is consistent", async () => {
			await controller.setStock({ productId: "p1", quantity: 30 });
			await controller.reserve({ productId: "p1", quantity: 5 });
			await controller.reserve({ productId: "p1", quantity: 5 });
			await controller.reserve({ productId: "p1", quantity: 5 });

			// 15 reserved total
			const before = await controller.getStock({ productId: "p1" });
			expect(before?.reserved).toBe(15);

			// Deduct all 15 (fulfill all)
			await controller.deduct({ productId: "p1", quantity: 15 });

			const after = await controller.getStock({ productId: "p1" });
			expect(after?.quantity).toBe(15);
			expect(after?.reserved).toBe(0);
			expect(after?.available).toBe(15);
		});
	});

	// ── Location Isolation ───────────────────────────────────────────

	describe("location isolation", () => {
		it("adjusting stock at location A does not affect location B", async () => {
			await controller.setStock({
				productId: "p1",
				locationId: "loc-a",
				quantity: 20,
			});
			await controller.setStock({
				productId: "p1",
				locationId: "loc-b",
				quantity: 30,
			});

			await controller.adjustStock({
				productId: "p1",
				locationId: "loc-a",
				delta: -15,
			});

			const locA = await controller.getStock({
				productId: "p1",
				locationId: "loc-a",
			});
			const locB = await controller.getStock({
				productId: "p1",
				locationId: "loc-b",
			});
			expect(locA?.quantity).toBe(5);
			expect(locB?.quantity).toBe(30);
		});

		it("reserving at one location does not reduce availability at another", async () => {
			await controller.setStock({
				productId: "p1",
				locationId: "east",
				quantity: 10,
			});
			await controller.setStock({
				productId: "p1",
				locationId: "west",
				quantity: 10,
			});

			await controller.reserve({
				productId: "p1",
				locationId: "east",
				quantity: 10,
			});

			const west = await controller.getStock({
				productId: "p1",
				locationId: "west",
			});
			expect(west?.available).toBe(10);
			expect(west?.reserved).toBe(0);
		});

		it("low stock at one location does not flag other locations", async () => {
			await controller.setStock({
				productId: "p1",
				locationId: "loc-low",
				quantity: 1,
				lowStockThreshold: 5,
			});
			await controller.setStock({
				productId: "p1",
				locationId: "loc-ok",
				quantity: 100,
				lowStockThreshold: 5,
			});

			const lowItems = await controller.getLowStockItems({
				locationId: "loc-ok",
			});
			expect(lowItems).toHaveLength(0);
		});
	});

	// ── SKU Uniqueness (product+variant+location) ────────────────────

	describe("SKU uniqueness — product+variant+location tuples", () => {
		it("same product with and without variant are distinct items", async () => {
			await controller.setStock({ productId: "p1", quantity: 100 });
			await controller.setStock({
				productId: "p1",
				variantId: "v1",
				quantity: 5,
			});

			const base = await controller.getStock({ productId: "p1" });
			const variant = await controller.getStock({
				productId: "p1",
				variantId: "v1",
			});
			expect(base?.quantity).toBe(100);
			expect(variant?.quantity).toBe(5);
		});

		it("same product with and without location are distinct items", async () => {
			await controller.setStock({ productId: "p1", quantity: 50 });
			await controller.setStock({
				productId: "p1",
				locationId: "loc-a",
				quantity: 10,
			});

			const noLoc = await controller.getStock({ productId: "p1" });
			const withLoc = await controller.getStock({
				productId: "p1",
				locationId: "loc-a",
			});
			expect(noLoc?.quantity).toBe(50);
			expect(withLoc?.quantity).toBe(10);
		});

		it("full tuple product+variant+location is unique", async () => {
			await controller.setStock({
				productId: "p1",
				variantId: "v1",
				locationId: "loc-a",
				quantity: 7,
			});
			await controller.setStock({
				productId: "p1",
				variantId: "v1",
				locationId: "loc-b",
				quantity: 3,
			});
			await controller.setStock({
				productId: "p1",
				variantId: "v2",
				locationId: "loc-a",
				quantity: 12,
			});

			const items = await controller.listItems({ productId: "p1" });
			expect(items).toHaveLength(3);

			const locA_v1 = await controller.getStock({
				productId: "p1",
				variantId: "v1",
				locationId: "loc-a",
			});
			const locB_v1 = await controller.getStock({
				productId: "p1",
				variantId: "v1",
				locationId: "loc-b",
			});
			const locA_v2 = await controller.getStock({
				productId: "p1",
				variantId: "v2",
				locationId: "loc-a",
			});
			expect(locA_v1?.quantity).toBe(7);
			expect(locB_v1?.quantity).toBe(3);
			expect(locA_v2?.quantity).toBe(12);
		});
	});

	// ── Nonexistent Item Guards ──────────────────────────────────────

	describe("nonexistent item guards", () => {
		it("adjustStock on missing item returns null, not error", async () => {
			const result = await controller.adjustStock({
				productId: "ghost",
				delta: 10,
			});
			expect(result).toBeNull();
		});

		it("reserve on missing item returns null, not error", async () => {
			const result = await controller.reserve({
				productId: "ghost",
				quantity: 1,
			});
			expect(result).toBeNull();
		});

		it("release on missing item returns null, not error", async () => {
			const result = await controller.release({
				productId: "ghost",
				quantity: 1,
			});
			expect(result).toBeNull();
		});

		it("deduct on missing item returns null, not error", async () => {
			const result = await controller.deduct({
				productId: "ghost",
				quantity: 1,
			});
			expect(result).toBeNull();
		});

		it("isInStock for untracked product returns true (not tracked = in stock)", async () => {
			const result = await controller.isInStock({
				productId: "untracked-item",
				quantity: 999,
			});
			expect(result).toBe(true);
		});
	});

	// ── Back-in-Stock Subscription Security ──────────────────────────

	describe("back-in-stock subscription security", () => {
		it("email is normalized to lowercase preventing duplicate bypasses", async () => {
			const sub1 = await controller.subscribeBackInStock({
				productId: "p1",
				email: "User@EXAMPLE.COM",
			});
			const sub2 = await controller.subscribeBackInStock({
				productId: "p1",
				email: "user@example.com",
			});

			// Same ID means deduplication worked despite case difference
			expect(sub1.id).toBe(sub2.id);
			expect(sub1.email).toBe("user@example.com");
		});

		it("subscriptions for different products are isolated", async () => {
			await controller.subscribeBackInStock({
				productId: "p1",
				email: "user@test.com",
			});
			await controller.subscribeBackInStock({
				productId: "p2",
				email: "user@test.com",
			});

			const p1Subs = await controller.getBackInStockSubscribers({
				productId: "p1",
			});
			const p2Subs = await controller.getBackInStockSubscribers({
				productId: "p2",
			});
			expect(p1Subs).toHaveLength(1);
			expect(p2Subs).toHaveLength(1);
		});

		it("markSubscribersNotified does not affect other products", async () => {
			await controller.subscribeBackInStock({
				productId: "p1",
				email: "a@test.com",
			});
			await controller.subscribeBackInStock({
				productId: "p2",
				email: "b@test.com",
			});

			await controller.markSubscribersNotified({ productId: "p1" });

			// p2 subscription should still be active
			const isActive = await controller.checkBackInStockSubscription({
				productId: "p2",
				email: "b@test.com",
			});
			expect(isActive).toBe(true);

			// p1 subscription should no longer be active
			const isNotified = await controller.checkBackInStockSubscription({
				productId: "p1",
				email: "a@test.com",
			});
			expect(isNotified).toBe(false);
		});

		it("unsubscribing one email does not affect another subscriber", async () => {
			await controller.subscribeBackInStock({
				productId: "p1",
				email: "keep@test.com",
			});
			await controller.subscribeBackInStock({
				productId: "p1",
				email: "remove@test.com",
			});

			await controller.unsubscribeBackInStock({
				productId: "p1",
				email: "remove@test.com",
			});

			const remaining = await controller.getBackInStockSubscribers({
				productId: "p1",
			});
			expect(remaining).toHaveLength(1);
			expect(remaining[0].email).toBe("keep@test.com");
		});
	});
});
