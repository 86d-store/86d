import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { FulfillmentController, FulfillmentStatus } from "../service";
import { createTestFulfillmentController as createFulfillmentController } from "./test-controller";

/**
 * Security regression tests for fulfillment endpoints.
 *
 * Fulfillments carry shipping destinations, carrier details, and tracking
 * numbers. These tests verify:
 * - Order-to-fulfillment isolation: fulfillments from order A never leak into order B queries
 * - Status transition enforcement: the state machine cannot be bypassed
 * - Tracking number integrity: tracking cannot be added to terminal-state fulfillments
 * - Partial fulfillment accuracy: item quantities are preserved exactly
 * - Item quantity validation: empty items are rejected at creation
 */

describe("fulfillment endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: FulfillmentController;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createFulfillmentController(mockData);
	});

	// ── Order-to-Fulfillment Isolation ─────────────────────────────

	describe("order-to-fulfillment isolation", () => {
		it("listByOrder never returns fulfillments from a different order", async () => {
			await controller.createFulfillment({
				orderId: "order_victim",
				items: [{ lineItemId: "li_v1", quantity: 3 }],
			});
			await controller.createFulfillment({
				orderId: "order_victim",
				items: [{ lineItemId: "li_v2", quantity: 1 }],
			});
			await controller.createFulfillment({
				orderId: "order_attacker",
				items: [{ lineItemId: "li_a1", quantity: 1 }],
			});

			const attackerResults = await controller.listByOrder("order_attacker");
			expect(attackerResults).toHaveLength(1);
			for (const f of attackerResults) {
				expect(f.orderId).toBe("order_attacker");
			}
		});

		it("listByOrder returns empty for an order with no fulfillments", async () => {
			await controller.createFulfillment({
				orderId: "order_other",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});

			const results = await controller.listByOrder("order_nonexistent");
			expect(results).toHaveLength(0);
		});

		it("cancelling a fulfillment in order A does not affect order B", async () => {
			const fA = await controller.createFulfillment({
				orderId: "order_A",
				items: [{ lineItemId: "li_a1", quantity: 2 }],
			});
			const fB = await controller.createFulfillment({
				orderId: "order_B",
				items: [{ lineItemId: "li_b1", quantity: 1 }],
			});

			await controller.cancelFulfillment(fA.id);

			const orderBList = await controller.listByOrder("order_B");
			expect(orderBList).toHaveLength(1);
			expect(orderBList[0]?.status).toBe("pending");
			expect(orderBList[0]?.id).toBe(fB.id);
		});

		it("getFulfillment does not scope by orderId (endpoint must verify ownership)", async () => {
			const f = await controller.createFulfillment({
				orderId: "order_secret",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});

			// The controller returns any fulfillment by ID regardless of caller
			// Endpoints MUST verify the caller owns the parent order
			const result = await controller.getFulfillment(f.id);
			expect(result).not.toBeNull();
			expect(result?.orderId).toBe("order_secret");
		});
	});

	// ── Status Transition Enforcement ──────────────────────────────

	describe("status transition enforcement", () => {
		const terminalStatuses: FulfillmentStatus[] = ["delivered", "cancelled"];

		for (const terminal of terminalStatuses) {
			it(`rejects all transitions out of terminal state "${terminal}"`, async () => {
				const f = await controller.createFulfillment({
					orderId: "order_1",
					items: [{ lineItemId: "li_1", quantity: 1 }],
				});

				// Reach the terminal state
				if (terminal === "delivered") {
					await controller.updateStatus(f.id, "shipped");
					await controller.updateStatus(f.id, "delivered");
				} else {
					await controller.updateStatus(f.id, "cancelled");
				}

				const targets: FulfillmentStatus[] = [
					"pending",
					"processing",
					"shipped",
					"delivered",
					"cancelled",
				];
				for (const target of targets) {
					if (target === terminal) continue;
					await expect(controller.updateStatus(f.id, target)).rejects.toThrow(
						"Cannot transition",
					);
				}
			});
		}

		it("rejects backward transition shipped -> processing", async () => {
			const f = await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});
			await controller.updateStatus(f.id, "shipped");

			await expect(controller.updateStatus(f.id, "processing")).rejects.toThrow(
				"Cannot transition",
			);
		});

		it("rejects backward transition processing -> pending", async () => {
			const f = await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});
			await controller.updateStatus(f.id, "processing");

			await expect(controller.updateStatus(f.id, "pending")).rejects.toThrow(
				"Cannot transition",
			);
		});

		it("error message includes current and target status", async () => {
			const f = await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});
			await controller.updateStatus(f.id, "shipped");
			await controller.updateStatus(f.id, "delivered");

			await expect(controller.updateStatus(f.id, "pending")).rejects.toThrow(
				/delivered.*pending/,
			);
		});

		it("updateStatus returns null for non-existent fulfillment ID", async () => {
			const result = await controller.updateStatus("nonexistent_id", "shipped");
			expect(result).toBeNull();
		});

		it("sets shippedAt only when transitioning to shipped", async () => {
			const f = await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});

			const processing = await controller.updateStatus(f.id, "processing");
			expect(processing?.shippedAt).toBeUndefined();

			const shipped = await controller.updateStatus(f.id, "shipped");
			expect(shipped?.shippedAt).toBeInstanceOf(Date);
		});

		it("sets deliveredAt only when transitioning to delivered", async () => {
			const f = await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});
			await controller.updateStatus(f.id, "shipped");

			const delivered = await controller.updateStatus(f.id, "delivered");
			expect(delivered?.deliveredAt).toBeInstanceOf(Date);
			// shippedAt should still be present from the previous transition
			expect(delivered?.shippedAt).toBeInstanceOf(Date);
		});
	});

	// ── Tracking Number Integrity ──────────────────────────────────

	describe("tracking number integrity", () => {
		it("rejects tracking on a delivered fulfillment", async () => {
			const f = await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});
			await controller.updateStatus(f.id, "shipped");
			await controller.updateStatus(f.id, "delivered");

			await expect(
				controller.addTracking(f.id, {
					carrier: "UPS",
					trackingNumber: "1Z999",
				}),
			).rejects.toThrow("delivered");
		});

		it("rejects tracking on a cancelled fulfillment", async () => {
			const f = await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});
			await controller.updateStatus(f.id, "cancelled");

			await expect(
				controller.addTracking(f.id, {
					carrier: "FedEx",
					trackingNumber: "794644",
				}),
			).rejects.toThrow("cancelled");
		});

		it("tracking overwrite replaces all fields including trackingUrl", async () => {
			const f = await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});

			await controller.addTracking(f.id, {
				carrier: "UPS",
				trackingNumber: "OLD_NUM",
				trackingUrl: "https://ups.com/track/OLD_NUM",
			});

			const updated = await controller.addTracking(f.id, {
				carrier: "FedEx",
				trackingNumber: "NEW_NUM",
				trackingUrl: "https://fedex.com/track/NEW_NUM",
			});

			expect(updated?.carrier).toBe("FedEx");
			expect(updated?.trackingNumber).toBe("NEW_NUM");
			expect(updated?.trackingUrl).toBe("https://fedex.com/track/NEW_NUM");
		});

		it("addTracking returns null for non-existent fulfillment ID", async () => {
			const result = await controller.addTracking("ghost_id", {
				carrier: "DHL",
				trackingNumber: "ABC123",
			});
			expect(result).toBeNull();
		});

		it("tracking info persists through status transitions", async () => {
			const f = await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});

			await controller.addTracking(f.id, {
				carrier: "USPS",
				trackingNumber: "9400111",
				trackingUrl: "https://usps.com/track/9400111",
			});

			await controller.updateStatus(f.id, "shipped");
			await controller.updateStatus(f.id, "delivered");

			const final = await controller.getFulfillment(f.id);
			expect(final?.carrier).toBe("USPS");
			expect(final?.trackingNumber).toBe("9400111");
			expect(final?.trackingUrl).toBe("https://usps.com/track/9400111");
		});
	});

	// ── Partial Fulfillment Accuracy ───────────────────────────────

	describe("partial fulfillment accuracy", () => {
		it("preserves exact item quantities across multiple fulfillments", async () => {
			const f1 = await controller.createFulfillment({
				orderId: "order_1",
				items: [
					{ lineItemId: "li_1", quantity: 2 },
					{ lineItemId: "li_2", quantity: 1 },
				],
			});
			const f2 = await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 3 }],
			});

			const fetched1 = await controller.getFulfillment(f1.id);
			const fetched2 = await controller.getFulfillment(f2.id);

			expect(fetched1?.items).toHaveLength(2);
			expect(fetched1?.items[0]?.quantity).toBe(2);
			expect(fetched1?.items[1]?.quantity).toBe(1);
			expect(fetched2?.items).toHaveLength(1);
			expect(fetched2?.items[0]?.quantity).toBe(3);
		});

		it("each fulfillment has independent status even for the same order", async () => {
			const f1 = await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});
			const f2 = await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_2", quantity: 1 }],
			});

			await controller.updateStatus(f1.id, "shipped");
			await controller.cancelFulfillment(f2.id);

			const results = await controller.listByOrder("order_1");
			const statuses = results
				.map((f) => f.status)
				.sort((a, b) => a.localeCompare(b));
			expect(statuses).toEqual(["cancelled", "shipped"]);
		});

		it("lineItemId references are preserved as-is after creation", async () => {
			const lineItemId = "li_with-special.chars_123";
			const f = await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId, quantity: 5 }],
			});

			const fetched = await controller.getFulfillment(f.id);
			expect(fetched?.items[0]?.lineItemId).toBe(lineItemId);
			expect(fetched?.items[0]?.quantity).toBe(5);
		});
	});

	// ── Item Quantity Validation ────────────────────────────────────

	describe("item quantity validation", () => {
		it("rejects creation with empty items array", async () => {
			await expect(
				controller.createFulfillment({ orderId: "order_1", items: [] }),
			).rejects.toThrow("at least one Order line");
		});

		it("accepts a single item with quantity 1", async () => {
			const f = await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});
			expect(f.items).toHaveLength(1);
			expect(f.items[0]?.quantity).toBe(1);
		});

		it("preserves large quantity values without truncation", async () => {
			const f = await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 99999 }],
			});
			expect(f.items[0]?.quantity).toBe(99999);
		});
	});

	// ── Cancel Guard ───────────────────────────────────────────────

	describe("cancel guard", () => {
		it("throws when cancelling a delivered fulfillment", async () => {
			const f = await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});
			await controller.updateStatus(f.id, "shipped");
			await controller.updateStatus(f.id, "delivered");

			await expect(controller.cancelFulfillment(f.id)).rejects.toThrow(
				"Cannot cancel a delivered fulfillment",
			);
		});

		it("cancelling an already-cancelled fulfillment is idempotent", async () => {
			const f = await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});

			const first = await controller.cancelFulfillment(f.id);
			const second = await controller.cancelFulfillment(f.id);
			expect(first?.status).toBe("cancelled");
			expect(second?.status).toBe("cancelled");
		});

		it("cancelFulfillment returns null for non-existent ID", async () => {
			const result = await controller.cancelFulfillment("nonexistent");
			expect(result).toBeNull();
		});

		it("can cancel from any non-terminal state", async () => {
			const cancellableFrom: FulfillmentStatus[] = [
				"pending",
				"processing",
				"shipped",
			];

			for (const status of cancellableFrom) {
				const data = createMockDataService();
				const ctrl = createFulfillmentController(data);
				const f = await ctrl.createFulfillment({
					orderId: "order_1",
					items: [{ lineItemId: "li_1", quantity: 1 }],
				});

				if (status === "processing") {
					await ctrl.updateStatus(f.id, "processing");
				} else if (status === "shipped") {
					await ctrl.updateStatus(f.id, "shipped");
				}

				const cancelled = await ctrl.cancelFulfillment(f.id);
				expect(cancelled?.status).toBe("cancelled");
			}
		});
	});
});
