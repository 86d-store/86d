import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FulfillmentStatus } from "../service";
import { createTestFulfillmentController as createFulfillmentController } from "./test-controller";

// ── Helpers ───────────────────────────────────────────────────────────────

function createMockEvents() {
	const emitted: Array<{ event: string; payload: unknown }> = [];
	return {
		emit: vi.fn(async (event: string, payload: unknown) => {
			emitted.push({ event, payload });
		}),
		on: vi.fn(),
		off: vi.fn(),
		emitted,
	};
}

// ── Edge cases and data integrity tests ──────────────────────────────────

describe("fulfillment controllers — edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createFulfillmentController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createFulfillmentController(mockData);
	});

	// ── createFulfillment — validation ──────────────────────────────

	describe("createFulfillment — validation", () => {
		it("throws on empty items array", async () => {
			await expect(
				controller.createFulfillment({
					orderId: "order_1",
					items: [],
				}),
			).rejects.toThrow("at least one Order line");
		});

		it("generates unique IDs for each fulfillment", async () => {
			const f1 = await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});
			const f2 = await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});
			expect(f1.id).not.toBe(f2.id);
		});

		it("stores notes when provided", async () => {
			const f = await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
				notes: "Handle with care",
			});
			expect(f.notes).toBe("Handle with care");
		});

		it("creates with pending status and no tracking", async () => {
			const f = await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 2 }],
			});
			expect(f.status).toBe("pending");
			expect(f.carrier).toBeUndefined();
			expect(f.trackingNumber).toBeUndefined();
			expect(f.shippedAt).toBeUndefined();
		});

		it("stores multiple items correctly", async () => {
			const f = await controller.createFulfillment({
				orderId: "order_1",
				items: [
					{ lineItemId: "li_1", quantity: 2 },
					{ lineItemId: "li_2", quantity: 3 },
					{ lineItemId: "li_3", quantity: 1 },
				],
			});
			expect(f.items).toHaveLength(3);
			expect(f.items[1].quantity).toBe(3);
		});
	});

	// ── status transitions — complete matrix ────────────────────────

	describe("status transitions — complete matrix", () => {
		const validTransitions: Array<[FulfillmentStatus, FulfillmentStatus]> = [
			["pending", "processing"],
			["pending", "shipped"],
			["pending", "cancelled"],
			["processing", "shipped"],
			["processing", "cancelled"],
			["shipped", "delivered"],
			["shipped", "cancelled"],
		];

		for (const [from, to] of validTransitions) {
			it(`allows ${from} → ${to}`, async () => {
				const f = await controller.createFulfillment({
					orderId: "order_1",
					items: [{ lineItemId: "li_1", quantity: 1 }],
				});

				// Get to the "from" state
				if (from === "processing") {
					await controller.updateStatus(f.id, "processing");
				} else if (from === "shipped") {
					await controller.updateStatus(f.id, "shipped");
				}

				const result = await controller.updateStatus(f.id, to);
				expect(result?.status).toBe(to);
			});
		}

		const invalidTransitions: Array<[FulfillmentStatus, FulfillmentStatus]> = [
			["delivered", "pending"],
			["delivered", "shipped"],
			["delivered", "cancelled"],
			["cancelled", "pending"],
			["cancelled", "processing"],
			["cancelled", "shipped"],
			["processing", "pending"],
			["shipped", "processing"],
			["shipped", "pending"],
		];

		for (const [from, to] of invalidTransitions) {
			it(`rejects ${from} → ${to}`, async () => {
				const f = await controller.createFulfillment({
					orderId: "order_1",
					items: [{ lineItemId: "li_1", quantity: 1 }],
				});

				// Get to the "from" state
				if (from === "processing") {
					await controller.updateStatus(f.id, "processing");
				} else if (from === "shipped") {
					await controller.updateStatus(f.id, "shipped");
				} else if (from === "delivered") {
					await controller.updateStatus(f.id, "shipped");
					await controller.updateStatus(f.id, "delivered");
				} else if (from === "cancelled") {
					await controller.updateStatus(f.id, "cancelled");
				}

				await expect(controller.updateStatus(f.id, to)).rejects.toThrow();
			});
		}
	});

	// ── updateStatus — timestamp setting ────────────────────────────

	describe("updateStatus — timestamps", () => {
		it("sets shippedAt when transitioning to shipped", async () => {
			const f = await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});
			const result = await controller.updateStatus(f.id, "shipped");
			expect(result?.shippedAt).toBeInstanceOf(Date);
		});

		it("sets deliveredAt when transitioning to delivered", async () => {
			const f = await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});
			await controller.updateStatus(f.id, "shipped");
			const result = await controller.updateStatus(f.id, "delivered");
			expect(result?.deliveredAt).toBeInstanceOf(Date);
		});

		it("returns null for non-existent fulfillment", async () => {
			const result = await controller.updateStatus("nonexistent", "shipped");
			expect(result).toBeNull();
		});
	});

	// ── addTracking — edge cases ────────────────────────────────────

	describe("addTracking — edge cases", () => {
		it("adds tracking to pending fulfillment", async () => {
			const f = await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});
			const result = await controller.addTracking(f.id, {
				carrier: "UPS",
				trackingNumber: "1Z123456",
			});
			expect(result?.carrier).toBe("UPS");
			expect(result?.trackingNumber).toBe("1Z123456");
			expect(result?.status).toBe("pending"); // No autoShip by default
		});

		it("throws when adding tracking to delivered fulfillment", async () => {
			const f = await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});
			await controller.updateStatus(f.id, "shipped");
			await controller.updateStatus(f.id, "delivered");

			await expect(
				controller.addTracking(f.id, {
					carrier: "UPS",
					trackingNumber: "123",
				}),
			).rejects.toThrow("delivered");
		});

		it("throws when adding tracking to cancelled fulfillment", async () => {
			const f = await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});
			await controller.updateStatus(f.id, "cancelled");

			await expect(
				controller.addTracking(f.id, {
					carrier: "DHL",
					trackingNumber: "456",
				}),
			).rejects.toThrow("cancelled");
		});

		it("overwrites existing tracking info", async () => {
			const f = await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});
			await controller.addTracking(f.id, {
				carrier: "UPS",
				trackingNumber: "OLD123",
			});
			const result = await controller.addTracking(f.id, {
				carrier: "FedEx",
				trackingNumber: "NEW456",
				trackingUrl: "https://tracking.example.com/NEW456",
			});
			expect(result?.carrier).toBe("FedEx");
			expect(result?.trackingNumber).toBe("NEW456");
			expect(result?.trackingUrl).toBe("https://tracking.example.com/NEW456");
		});

		it("returns null for non-existent fulfillment", async () => {
			const result = await controller.addTracking("nonexistent", {
				carrier: "UPS",
				trackingNumber: "123",
			});
			expect(result).toBeNull();
		});
	});

	// ── autoShipOnTracking option ───────────────────────────────────

	describe("autoShipOnTracking option", () => {
		it("auto-transitions to shipped when tracking added to pending", async () => {
			const events = createMockEvents();
			const autoController = createFulfillmentController(mockData, {
				events,
				options: { autoShipOnTracking: true },
			});

			const f = await autoController.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});

			const result = await autoController.addTracking(f.id, {
				carrier: "UPS",
				trackingNumber: "1Z123",
			});
			expect(result?.status).toBe("shipped");
			expect(result?.shippedAt).toBeInstanceOf(Date);
		});

		it("auto-transitions processing to shipped", async () => {
			const autoController = createFulfillmentController(mockData, {
				options: { autoShipOnTracking: true },
			});

			const f = await autoController.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});
			await autoController.updateStatus(f.id, "processing");

			const result = await autoController.addTracking(f.id, {
				carrier: "FedEx",
				trackingNumber: "789",
			});
			expect(result?.status).toBe("shipped");
		});

		it("does NOT auto-ship when option is false", async () => {
			const noAutoController = createFulfillmentController(mockData, {
				options: { autoShipOnTracking: false },
			});

			const f = await noAutoController.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});

			const result = await noAutoController.addTracking(f.id, {
				carrier: "UPS",
				trackingNumber: "123",
			});
			expect(result?.status).toBe("pending");
		});

		it("does NOT auto-ship already-shipped fulfillment", async () => {
			const autoController = createFulfillmentController(mockData, {
				options: { autoShipOnTracking: true },
			});

			const f = await autoController.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});
			await autoController.updateStatus(f.id, "shipped");

			const result = await autoController.addTracking(f.id, {
				carrier: "UPS",
				trackingNumber: "123",
			});
			// Status stays "shipped" (no double-transition)
			expect(result?.status).toBe("shipped");
		});

		it("emits fulfillment.shipped event on auto-ship", async () => {
			const events = createMockEvents();
			const autoController = createFulfillmentController(mockData, {
				events,
				options: { autoShipOnTracking: true },
			});

			const f = await autoController.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});

			await autoController.addTracking(f.id, {
				carrier: "UPS",
				trackingNumber: "1Z123",
			});

			const shippedEvents = events.emitted.filter(
				(e) => e.event === "fulfillment.shipped",
			);
			expect(shippedEvents).toHaveLength(1);
		});
	});

	// ── cancelFulfillment — edge cases ──────────────────────────────

	describe("cancelFulfillment — edge cases", () => {
		it("cancel is idempotent — cancelling twice returns same result", async () => {
			const f = await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});

			const first = await controller.cancelFulfillment(f.id);
			const second = await controller.cancelFulfillment(f.id);
			expect(first?.status).toBe("cancelled");
			expect(second?.status).toBe("cancelled");
		});

		it("throws when cancelling delivered fulfillment", async () => {
			const f = await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});
			await controller.updateStatus(f.id, "shipped");
			await controller.updateStatus(f.id, "delivered");

			await expect(controller.cancelFulfillment(f.id)).rejects.toThrow(
				"delivered",
			);
		});

		it("returns null for non-existent fulfillment", async () => {
			const result = await controller.cancelFulfillment("nonexistent");
			expect(result).toBeNull();
		});

		it("can cancel from shipped status", async () => {
			const f = await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});
			await controller.updateStatus(f.id, "shipped");

			const result = await controller.cancelFulfillment(f.id);
			expect(result?.status).toBe("cancelled");
		});
	});

	// ── listByOrder — isolation ─────────────────────────────────────

	describe("listByOrder — order isolation", () => {
		it("only returns fulfillments for the specified order", async () => {
			await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});
			await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_2", quantity: 2 }],
			});
			await controller.createFulfillment({
				orderId: "order_2",
				items: [{ lineItemId: "li_3", quantity: 1 }],
			});

			const order1 = await controller.listByOrder("order_1");
			const order2 = await controller.listByOrder("order_2");
			expect(order1).toHaveLength(2);
			expect(order2).toHaveLength(1);
		});

		it("returns empty array for order with no fulfillments", async () => {
			const result = await controller.listByOrder("no-order");
			expect(result).toHaveLength(0);
		});
	});

	// ── listFulfillments — filtering and pagination ─────────────────

	describe("listFulfillments — filtering", () => {
		it("filters by status", async () => {
			const f1 = await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});
			await controller.createFulfillment({
				orderId: "order_2",
				items: [{ lineItemId: "li_2", quantity: 1 }],
			});
			await controller.updateStatus(f1.id, "shipped");

			const shipped = await controller.listFulfillments({
				status: "shipped",
			});
			expect(shipped).toHaveLength(1);
			expect(shipped[0].status).toBe("shipped");
		});

		it("respects limit and offset", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createFulfillment({
					orderId: `order_${i}`,
					items: [{ lineItemId: "li_1", quantity: 1 }],
				});
			}

			const page = await controller.listFulfillments({
				limit: 2,
				offset: 1,
			});
			expect(page).toHaveLength(2);
		});

		it("returns all when no params given", async () => {
			for (let i = 0; i < 3; i++) {
				await controller.createFulfillment({
					orderId: `order_${i}`,
					items: [{ lineItemId: "li_1", quantity: 1 }],
				});
			}

			const all = await controller.listFulfillments({});
			expect(all).toHaveLength(3);
		});
	});

	// ── event emission — comprehensive ──────────────────────────────

	describe("event emission", () => {
		it("emits fulfillment.created on creation", async () => {
			const events = createMockEvents();
			const evtController = createFulfillmentController(mockData, { events });

			await evtController.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});

			expect(events.emitted).toHaveLength(1);
			expect(events.emitted[0].event).toBe("fulfillment.created");
		});

		it("emits fulfillment.shipped on status → shipped", async () => {
			const events = createMockEvents();
			const evtController = createFulfillmentController(mockData, { events });

			const f = await evtController.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});
			await evtController.updateStatus(f.id, "shipped");

			const shippedEvents = events.emitted.filter(
				(e) => e.event === "fulfillment.shipped",
			);
			expect(shippedEvents).toHaveLength(1);
		});

		it("emits fulfillment.delivered on status → delivered", async () => {
			const events = createMockEvents();
			const evtController = createFulfillmentController(mockData, { events });

			const f = await evtController.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});
			await evtController.updateStatus(f.id, "shipped");
			await evtController.updateStatus(f.id, "delivered");

			const deliveredEvents = events.emitted.filter(
				(e) => e.event === "fulfillment.delivered",
			);
			expect(deliveredEvents).toHaveLength(1);
		});

		it("emits fulfillment.cancelled on cancelFulfillment", async () => {
			const events = createMockEvents();
			const evtController = createFulfillmentController(mockData, { events });

			const f = await evtController.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});
			await evtController.cancelFulfillment(f.id);

			const cancelledEvents = events.emitted.filter(
				(e) => e.event === "fulfillment.cancelled",
			);
			expect(cancelledEvents).toHaveLength(1);
		});

		it("does NOT emit cancelled event for already-cancelled (idempotent)", async () => {
			const events = createMockEvents();
			const evtController = createFulfillmentController(mockData, { events });

			const f = await evtController.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});
			await evtController.cancelFulfillment(f.id);
			await evtController.cancelFulfillment(f.id);

			const cancelledEvents = events.emitted.filter(
				(e) => e.event === "fulfillment.cancelled",
			);
			expect(cancelledEvents).toHaveLength(1); // Only one, not two
		});

		it("works without events emitter (graceful no-op)", async () => {
			const noEventsController = createFulfillmentController(mockData);

			const f = await noEventsController.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});
			// Should not throw
			await noEventsController.updateStatus(f.id, "shipped");
			await noEventsController.cancelFulfillment(
				(
					await noEventsController.createFulfillment({
						orderId: "order_2",
						items: [{ lineItemId: "li_2", quantity: 1 }],
					})
				).id,
			);
			expect(true).toBe(true);
		});
	});

	// ── full lifecycle ──────────────────────────────────────────────

	describe("full lifecycle", () => {
		it("create → processing → shipped → delivered with events", async () => {
			const events = createMockEvents();
			const evtController = createFulfillmentController(mockData, { events });

			const f = await evtController.createFulfillment({
				orderId: "order_1",
				items: [
					{ lineItemId: "li_1", quantity: 2 },
					{ lineItemId: "li_2", quantity: 1 },
				],
			});

			expect(f.status).toBe("pending");
			expect(f.items).toHaveLength(2);

			const processing = await evtController.updateStatus(f.id, "processing");
			expect(processing?.status).toBe("processing");

			// Add tracking
			const tracked = await evtController.addTracking(f.id, {
				carrier: "UPS",
				trackingNumber: "1Z123",
			});
			expect(tracked?.carrier).toBe("UPS");

			const shipped = await evtController.updateStatus(f.id, "shipped");
			expect(shipped?.status).toBe("shipped");
			expect(shipped?.shippedAt).toBeInstanceOf(Date);

			const delivered = await evtController.updateStatus(f.id, "delivered");
			expect(delivered?.status).toBe("delivered");
			expect(delivered?.deliveredAt).toBeInstanceOf(Date);

			// Verify events emitted in order
			const eventNames = events.emitted.map((e) => e.event);
			expect(eventNames).toContain("fulfillment.created");
			expect(eventNames).toContain("fulfillment.shipped");
			expect(eventNames).toContain("fulfillment.delivered");
		});

		it("multiple fulfillments for same order", async () => {
			const f1 = await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_1", quantity: 1 }],
			});
			await controller.createFulfillment({
				orderId: "order_1",
				items: [{ lineItemId: "li_2", quantity: 2 }],
			});

			await controller.updateStatus(f1.id, "shipped");

			const byOrder = await controller.listByOrder("order_1");
			expect(byOrder).toHaveLength(2);

			const statuses = byOrder.map((f) => f.status);
			expect(statuses).toContain("shipped");
			expect(statuses).toContain("pending");
		});
	});
});
