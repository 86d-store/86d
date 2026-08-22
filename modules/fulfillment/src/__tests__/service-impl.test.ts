import type { ScopedEventEmitter } from "@86d-app/core/events";
import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it, vi } from "vitest";
import { createTestFulfillmentController as createFulfillmentController } from "./test-controller";

function createMockEvents(): ScopedEventEmitter & {
	emitted: Array<{ type: string; payload: unknown }>;
} {
	const emitted: Array<{ type: string; payload: unknown }> = [];
	return {
		emitted,
		emit: vi.fn(async (type: string, payload: unknown) => {
			emitted.push({ type, payload });
		}),
		on: vi.fn(() => () => {}),
		off: vi.fn(),
	};
}

// ---------------------------------------------------------------------------
// createFulfillment
// ---------------------------------------------------------------------------

describe("createFulfillment", () => {
	it("creates a fulfillment with items", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "order-1",
			items: [{ lineItemId: "item-1", quantity: 2 }],
		});

		expect(f.id).toBeTruthy();
		expect(f.orderId).toBe("order-1");
		expect(f.status).toBe("pending");
		expect(f.items).toEqual([{ lineItemId: "item-1", quantity: 2 }]);
		expect(f.createdAt).toBeInstanceOf(Date);
		expect(f.updatedAt).toBeInstanceOf(Date);
	});

	it("stores optional notes", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "order-1",
			items: [{ lineItemId: "item-1", quantity: 1 }],
			notes: "Handle with care",
		});
		expect(f.notes).toBe("Handle with care");
	});

	it("creates with multiple items", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "order-1",
			items: [
				{ lineItemId: "item-1", quantity: 1 },
				{ lineItemId: "item-2", quantity: 3 },
			],
		});
		expect(f.items).toHaveLength(2);
	});

	it("throws when items array is empty", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		await expect(
			ctrl.createFulfillment({ orderId: "order-1", items: [] }),
		).rejects.toThrow("at least one Order line");
	});

	it("generates unique IDs for each fulfillment", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f1 = await ctrl.createFulfillment({
			orderId: "order-1",
			items: [{ lineItemId: "item-1", quantity: 1 }],
		});
		const f2 = await ctrl.createFulfillment({
			orderId: "order-1",
			items: [{ lineItemId: "item-2", quantity: 1 }],
		});
		expect(f1.id).not.toBe(f2.id);
	});

	it("does not set carrier or tracking fields on creation", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "order-1",
			items: [{ lineItemId: "item-1", quantity: 1 }],
		});
		expect(f.carrier).toBeUndefined();
		expect(f.trackingNumber).toBeUndefined();
		expect(f.trackingUrl).toBeUndefined();
		expect(f.shippedAt).toBeUndefined();
		expect(f.deliveredAt).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// getFulfillment
// ---------------------------------------------------------------------------

describe("getFulfillment", () => {
	it("returns null for missing fulfillment", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		expect(await ctrl.getFulfillment("nope")).toBeNull();
	});

	it("returns the fulfillment when it exists", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "order-1",
			items: [{ lineItemId: "item-1", quantity: 1 }],
		});
		const fetched = await ctrl.getFulfillment(f.id);
		expect(fetched?.id).toBe(f.id);
		expect(fetched?.orderId).toBe("order-1");
	});

	it("returns all fields including notes", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "order-1",
			items: [{ lineItemId: "item-1", quantity: 1 }],
			notes: "Important",
		});
		const fetched = await ctrl.getFulfillment(f.id);
		expect(fetched?.notes).toBe("Important");
		expect(fetched?.items).toEqual([{ lineItemId: "item-1", quantity: 1 }]);
	});
});

// ---------------------------------------------------------------------------
// listByOrder
// ---------------------------------------------------------------------------

describe("listByOrder", () => {
	it("lists fulfillments for an order", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		await ctrl.createFulfillment({
			orderId: "order-1",
			items: [{ lineItemId: "item-1", quantity: 1 }],
		});
		await ctrl.createFulfillment({
			orderId: "order-1",
			items: [{ lineItemId: "item-2", quantity: 2 }],
		});
		await ctrl.createFulfillment({
			orderId: "order-2",
			items: [{ lineItemId: "item-3", quantity: 1 }],
		});

		const results = await ctrl.listByOrder("order-1");
		expect(results).toHaveLength(2);
		expect(results.every((f) => f.orderId === "order-1")).toBe(true);
	});

	it("returns empty array for order with no fulfillments", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		expect(await ctrl.listByOrder("none")).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// listFulfillments
// ---------------------------------------------------------------------------

describe("listFulfillments", () => {
	it("lists all fulfillments", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		await ctrl.createFulfillment({
			orderId: "o-2",
			items: [{ lineItemId: "i-2", quantity: 1 }],
		});
		expect(await ctrl.listFulfillments()).toHaveLength(2);
	});

	it("filters by status", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f1 = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		await ctrl.createFulfillment({
			orderId: "o-2",
			items: [{ lineItemId: "i-2", quantity: 1 }],
		});
		await ctrl.updateStatus(f1.id, "processing");

		const processing = await ctrl.listFulfillments({
			status: "processing",
		});
		expect(processing).toHaveLength(1);
		expect(processing[0].id).toBe(f1.id);
	});

	it("respects limit and offset", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		for (let i = 0; i < 5; i++) {
			await ctrl.createFulfillment({
				orderId: `o-${i}`,
				items: [{ lineItemId: `i-${i}`, quantity: 1 }],
			});
		}

		const page = await ctrl.listFulfillments({ limit: 2, offset: 1 });
		expect(page).toHaveLength(2);
	});

	it("returns empty array when none exist", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		expect(await ctrl.listFulfillments()).toHaveLength(0);
	});

	it("returns all when no params provided", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		for (let i = 0; i < 3; i++) {
			await ctrl.createFulfillment({
				orderId: `o-${i}`,
				items: [{ lineItemId: `i-${i}`, quantity: 1 }],
			});
		}
		expect(await ctrl.listFulfillments()).toHaveLength(3);
	});

	it("offset beyond results returns empty array", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		expect(await ctrl.listFulfillments({ offset: 10 })).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// updateStatus
// ---------------------------------------------------------------------------

describe("updateStatus", () => {
	it("transitions pending → processing", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		const updated = await ctrl.updateStatus(f.id, "processing");
		expect(updated?.status).toBe("processing");
	});

	it("transitions pending → shipped and sets shippedAt", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		const updated = await ctrl.updateStatus(f.id, "shipped");
		expect(updated?.status).toBe("shipped");
		expect(updated?.shippedAt).toBeInstanceOf(Date);
	});

	it("transitions pending → cancelled", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		const updated = await ctrl.updateStatus(f.id, "cancelled");
		expect(updated?.status).toBe("cancelled");
	});

	it("transitions processing → shipped", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		await ctrl.updateStatus(f.id, "processing");
		const updated = await ctrl.updateStatus(f.id, "shipped");
		expect(updated?.status).toBe("shipped");
		expect(updated?.shippedAt).toBeInstanceOf(Date);
	});

	it("transitions processing → cancelled", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		await ctrl.updateStatus(f.id, "processing");
		const updated = await ctrl.updateStatus(f.id, "cancelled");
		expect(updated?.status).toBe("cancelled");
	});

	it("transitions shipped → delivered and sets deliveredAt", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		await ctrl.updateStatus(f.id, "shipped");
		const updated = await ctrl.updateStatus(f.id, "delivered");
		expect(updated?.status).toBe("delivered");
		expect(updated?.deliveredAt).toBeInstanceOf(Date);
	});

	it("transitions shipped → cancelled", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		await ctrl.updateStatus(f.id, "shipped");
		const updated = await ctrl.updateStatus(f.id, "cancelled");
		expect(updated?.status).toBe("cancelled");
	});

	it("rejects invalid transition delivered → pending", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		await ctrl.updateStatus(f.id, "shipped");
		await ctrl.updateStatus(f.id, "delivered");
		await expect(ctrl.updateStatus(f.id, "pending")).rejects.toThrow(
			"Cannot transition",
		);
	});

	it("rejects invalid transition delivered → shipped", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		await ctrl.updateStatus(f.id, "shipped");
		await ctrl.updateStatus(f.id, "delivered");
		await expect(ctrl.updateStatus(f.id, "shipped")).rejects.toThrow(
			"Cannot transition",
		);
	});

	it("rejects transition from cancelled", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		await ctrl.updateStatus(f.id, "cancelled");
		await expect(ctrl.updateStatus(f.id, "pending")).rejects.toThrow(
			"Cannot transition",
		);
	});

	it("rejects transition cancelled → processing", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		await ctrl.updateStatus(f.id, "cancelled");
		await expect(ctrl.updateStatus(f.id, "processing")).rejects.toThrow(
			"Cannot transition",
		);
	});

	it("rejects backward transition processing → pending", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		await ctrl.updateStatus(f.id, "processing");
		await expect(ctrl.updateStatus(f.id, "pending")).rejects.toThrow(
			"Cannot transition",
		);
	});

	it("rejects backward transition shipped → processing", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		await ctrl.updateStatus(f.id, "shipped");
		await expect(ctrl.updateStatus(f.id, "processing")).rejects.toThrow(
			"Cannot transition",
		);
	});

	it("returns null for missing fulfillment", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		expect(await ctrl.updateStatus("ghost", "processing")).toBeNull();
	});

	it("advances updatedAt timestamp", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		await new Promise((r) => setTimeout(r, 1));
		const updated = await ctrl.updateStatus(f.id, "processing");
		expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
			f.updatedAt.getTime(),
		);
	});

	it("persists status change to data store", async () => {
		const data = createMockDataService();
		const ctrl = createFulfillmentController(data);
		const f = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		await ctrl.updateStatus(f.id, "processing");
		const fetched = await ctrl.getFulfillment(f.id);
		expect(fetched?.status).toBe("processing");
	});
});

// ---------------------------------------------------------------------------
// addTracking
// ---------------------------------------------------------------------------

describe("addTracking", () => {
	it("adds carrier and tracking number", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		const updated = await ctrl.addTracking(f.id, {
			carrier: "UPS",
			trackingNumber: "1Z999AA10123456784",
		});
		expect(updated?.carrier).toBe("UPS");
		expect(updated?.trackingNumber).toBe("1Z999AA10123456784");
	});

	it("stores optional tracking URL", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		const updated = await ctrl.addTracking(f.id, {
			carrier: "FedEx",
			trackingNumber: "794644790138",
			trackingUrl: "https://www.fedex.com/track?id=794644790138",
		});
		expect(updated?.trackingUrl).toBe(
			"https://www.fedex.com/track?id=794644790138",
		);
	});

	it("adds tracking to a processing fulfillment", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		await ctrl.updateStatus(f.id, "processing");
		const updated = await ctrl.addTracking(f.id, {
			carrier: "DHL",
			trackingNumber: "DHL123",
		});
		expect(updated?.carrier).toBe("DHL");
		expect(updated?.status).toBe("processing");
	});

	it("adds tracking to a shipped fulfillment", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		await ctrl.updateStatus(f.id, "shipped");
		const updated = await ctrl.addTracking(f.id, {
			carrier: "USPS",
			trackingNumber: "9400111",
		});
		expect(updated?.carrier).toBe("USPS");
	});

	it("rejects tracking on delivered fulfillment", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		await ctrl.updateStatus(f.id, "shipped");
		await ctrl.updateStatus(f.id, "delivered");
		await expect(
			ctrl.addTracking(f.id, {
				carrier: "UPS",
				trackingNumber: "123",
			}),
		).rejects.toThrow("Cannot add tracking to a delivered fulfillment");
	});

	it("rejects tracking on cancelled fulfillment", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		await ctrl.updateStatus(f.id, "cancelled");
		await expect(
			ctrl.addTracking(f.id, {
				carrier: "UPS",
				trackingNumber: "123",
			}),
		).rejects.toThrow("Cannot add tracking to a cancelled fulfillment");
	});

	it("returns null for missing fulfillment", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		expect(
			await ctrl.addTracking("ghost", {
				carrier: "UPS",
				trackingNumber: "123",
			}),
		).toBeNull();
	});

	it("overwrites existing tracking info", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		await ctrl.addTracking(f.id, {
			carrier: "UPS",
			trackingNumber: "OLD",
		});
		const updated = await ctrl.addTracking(f.id, {
			carrier: "FedEx",
			trackingNumber: "NEW",
		});
		expect(updated?.carrier).toBe("FedEx");
		expect(updated?.trackingNumber).toBe("NEW");
	});

	it("advances updatedAt on tracking update", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		await new Promise((r) => setTimeout(r, 1));
		const updated = await ctrl.addTracking(f.id, {
			carrier: "UPS",
			trackingNumber: "123",
		});
		expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
			f.updatedAt.getTime(),
		);
	});
});

// ---------------------------------------------------------------------------
// cancelFulfillment
// ---------------------------------------------------------------------------

describe("cancelFulfillment", () => {
	it("cancels a pending fulfillment", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		const cancelled = await ctrl.cancelFulfillment(f.id);
		expect(cancelled?.status).toBe("cancelled");
	});

	it("cancels a processing fulfillment", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		await ctrl.updateStatus(f.id, "processing");
		const cancelled = await ctrl.cancelFulfillment(f.id);
		expect(cancelled?.status).toBe("cancelled");
	});

	it("cancels a shipped fulfillment", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		await ctrl.updateStatus(f.id, "shipped");
		const cancelled = await ctrl.cancelFulfillment(f.id);
		expect(cancelled?.status).toBe("cancelled");
	});

	it("throws when cancelling a delivered fulfillment", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		await ctrl.updateStatus(f.id, "shipped");
		await ctrl.updateStatus(f.id, "delivered");
		await expect(ctrl.cancelFulfillment(f.id)).rejects.toThrow(
			"Cannot cancel a delivered fulfillment",
		);
	});

	it("returns the same fulfillment if already cancelled", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		await ctrl.cancelFulfillment(f.id);
		const again = await ctrl.cancelFulfillment(f.id);
		expect(again?.status).toBe("cancelled");
	});

	it("returns null for missing fulfillment", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		expect(await ctrl.cancelFulfillment("ghost")).toBeNull();
	});

	it("advances updatedAt on cancel", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		await new Promise((r) => setTimeout(r, 1));
		const cancelled = await ctrl.cancelFulfillment(f.id);
		expect(cancelled?.updatedAt.getTime()).toBeGreaterThanOrEqual(
			f.updatedAt.getTime(),
		);
	});
});

// ---------------------------------------------------------------------------
// Event emission
// ---------------------------------------------------------------------------

describe("event emission", () => {
	it("emits fulfillment.created on creation", async () => {
		const events = createMockEvents();
		const ctrl = createFulfillmentController(createMockDataService(), events);
		const f = await ctrl.createFulfillment({
			orderId: "order-1",
			items: [{ lineItemId: "item-1", quantity: 2 }],
		});

		expect(events.emit).toHaveBeenCalledWith("fulfillment.created", {
			fulfillmentId: f.id,
			orderId: "order-1",
			items: [{ lineItemId: "item-1", quantity: 2 }],
		});
	});

	it("emits fulfillment.shipped on status transition to shipped", async () => {
		const events = createMockEvents();
		const ctrl = createFulfillmentController(createMockDataService(), events);
		const f = await ctrl.createFulfillment({
			orderId: "order-1",
			items: [{ lineItemId: "item-1", quantity: 1 }],
		});
		await ctrl.updateStatus(f.id, "shipped");

		expect(events.emit).toHaveBeenCalledWith("fulfillment.shipped", {
			fulfillmentId: f.id,
			orderId: "order-1",
			carrier: undefined,
			trackingNumber: undefined,
		});
	});

	it("emits fulfillment.delivered on status transition to delivered", async () => {
		const events = createMockEvents();
		const ctrl = createFulfillmentController(createMockDataService(), events);
		const f = await ctrl.createFulfillment({
			orderId: "order-1",
			items: [{ lineItemId: "item-1", quantity: 1 }],
		});
		await ctrl.updateStatus(f.id, "shipped");
		await ctrl.updateStatus(f.id, "delivered");

		expect(events.emit).toHaveBeenCalledWith("fulfillment.delivered", {
			fulfillmentId: f.id,
			orderId: "order-1",
		});
	});

	it("emits fulfillment.cancelled on status transition to cancelled", async () => {
		const events = createMockEvents();
		const ctrl = createFulfillmentController(createMockDataService(), events);
		const f = await ctrl.createFulfillment({
			orderId: "order-1",
			items: [{ lineItemId: "item-1", quantity: 1 }],
		});
		await ctrl.updateStatus(f.id, "cancelled");

		expect(events.emit).toHaveBeenCalledWith("fulfillment.cancelled", {
			fulfillmentId: f.id,
			orderId: "order-1",
		});
	});

	it("emits fulfillment.cancelled on cancelFulfillment()", async () => {
		const events = createMockEvents();
		const ctrl = createFulfillmentController(createMockDataService(), events);
		const f = await ctrl.createFulfillment({
			orderId: "order-1",
			items: [{ lineItemId: "item-1", quantity: 1 }],
		});
		await ctrl.cancelFulfillment(f.id);

		const cancelledEvents = events.emitted.filter(
			(e) => e.type === "fulfillment.cancelled",
		);
		expect(cancelledEvents).toHaveLength(1);
		expect(cancelledEvents[0].payload).toEqual({
			fulfillmentId: f.id,
			orderId: "order-1",
		});
	});

	it("does not emit cancelled event for already cancelled fulfillment", async () => {
		const events = createMockEvents();
		const ctrl = createFulfillmentController(createMockDataService(), events);
		const f = await ctrl.createFulfillment({
			orderId: "order-1",
			items: [{ lineItemId: "item-1", quantity: 1 }],
		});
		await ctrl.cancelFulfillment(f.id);
		const countBefore = events.emitted.filter(
			(e) => e.type === "fulfillment.cancelled",
		).length;
		await ctrl.cancelFulfillment(f.id);
		const countAfter = events.emitted.filter(
			(e) => e.type === "fulfillment.cancelled",
		).length;
		expect(countAfter).toBe(countBefore);
	});

	it("does not emit processing event (only ships, delivers, cancels)", async () => {
		const events = createMockEvents();
		const ctrl = createFulfillmentController(createMockDataService(), events);
		const f = await ctrl.createFulfillment({
			orderId: "order-1",
			items: [{ lineItemId: "item-1", quantity: 1 }],
		});
		await ctrl.updateStatus(f.id, "processing");

		const processingEvents = events.emitted.filter(
			(e) =>
				e.type === "fulfillment.processing" ||
				(e.type === "fulfillment.shipped" &&
					(e.payload as { fulfillmentId: string }).fulfillmentId === f.id),
		);
		// Only fulfillment.created should be there, no processing or shipped event
		expect(processingEvents).toHaveLength(0);
	});

	it("works without events emitter (no events arg)", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "order-1",
			items: [{ lineItemId: "item-1", quantity: 1 }],
		});
		// Should not throw even without events emitter
		await ctrl.updateStatus(f.id, "shipped");
		await ctrl.updateStatus(f.id, "delivered");
		expect(f.id).toBeTruthy();
	});

	it("includes carrier info in shipped event when tracking exists", async () => {
		const events = createMockEvents();
		const ctrl = createFulfillmentController(createMockDataService(), events);
		const f = await ctrl.createFulfillment({
			orderId: "order-1",
			items: [{ lineItemId: "item-1", quantity: 1 }],
		});
		await ctrl.addTracking(f.id, {
			carrier: "UPS",
			trackingNumber: "1Z999",
		});
		await ctrl.updateStatus(f.id, "shipped");

		const shippedEvent = events.emitted.find(
			(e) => e.type === "fulfillment.shipped",
		);
		expect(shippedEvent?.payload).toEqual({
			fulfillmentId: f.id,
			orderId: "order-1",
			carrier: "UPS",
			trackingNumber: "1Z999",
		});
	});
});

// ---------------------------------------------------------------------------
// autoShipOnTracking option
// ---------------------------------------------------------------------------

describe("autoShipOnTracking", () => {
	it("auto-transitions to shipped when tracking is added to pending fulfillment", async () => {
		const ctrl = createFulfillmentController(
			createMockDataService(),
			undefined,
			{
				autoShipOnTracking: true,
			},
		);
		const f = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		const updated = await ctrl.addTracking(f.id, {
			carrier: "UPS",
			trackingNumber: "1Z999",
		});
		expect(updated?.status).toBe("shipped");
		expect(updated?.shippedAt).toBeInstanceOf(Date);
	});

	it("auto-transitions to shipped when tracking is added to processing fulfillment", async () => {
		const ctrl = createFulfillmentController(
			createMockDataService(),
			undefined,
			{
				autoShipOnTracking: true,
			},
		);
		const f = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		await ctrl.updateStatus(f.id, "processing");
		const updated = await ctrl.addTracking(f.id, {
			carrier: "FedEx",
			trackingNumber: "794644",
		});
		expect(updated?.status).toBe("shipped");
		expect(updated?.shippedAt).toBeInstanceOf(Date);
	});

	it("does not auto-ship when adding tracking to already shipped fulfillment", async () => {
		const ctrl = createFulfillmentController(
			createMockDataService(),
			undefined,
			{
				autoShipOnTracking: true,
			},
		);
		const f = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		await ctrl.updateStatus(f.id, "shipped");
		const updated = await ctrl.addTracking(f.id, {
			carrier: "USPS",
			trackingNumber: "9400111",
		});
		// Status should stay shipped, not re-trigger
		expect(updated?.status).toBe("shipped");
	});

	it("does not auto-ship when autoShipOnTracking is false", async () => {
		const ctrl = createFulfillmentController(
			createMockDataService(),
			undefined,
			{
				autoShipOnTracking: false,
			},
		);
		const f = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		const updated = await ctrl.addTracking(f.id, {
			carrier: "UPS",
			trackingNumber: "1Z999",
		});
		expect(updated?.status).toBe("pending");
	});

	it("does not auto-ship when option is not provided", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f = await ctrl.createFulfillment({
			orderId: "o-1",
			items: [{ lineItemId: "i-1", quantity: 1 }],
		});
		const updated = await ctrl.addTracking(f.id, {
			carrier: "UPS",
			trackingNumber: "1Z999",
		});
		expect(updated?.status).toBe("pending");
	});

	it("emits fulfillment.shipped event when auto-shipping", async () => {
		const events = createMockEvents();
		const ctrl = createFulfillmentController(createMockDataService(), events, {
			autoShipOnTracking: true,
		});
		const f = await ctrl.createFulfillment({
			orderId: "order-1",
			items: [{ lineItemId: "item-1", quantity: 1 }],
		});
		await ctrl.addTracking(f.id, {
			carrier: "UPS",
			trackingNumber: "1Z999",
		});

		const shippedEvent = events.emitted.find(
			(e) => e.type === "fulfillment.shipped",
		);
		expect(shippedEvent).toBeTruthy();
		expect(shippedEvent?.payload).toEqual({
			fulfillmentId: f.id,
			orderId: "order-1",
			carrier: "UPS",
			trackingNumber: "1Z999",
		});
	});
});

// ---------------------------------------------------------------------------
// Full lifecycle
// ---------------------------------------------------------------------------

describe("full lifecycle", () => {
	it("create → processing → shipped → delivered", async () => {
		const events = createMockEvents();
		const ctrl = createFulfillmentController(createMockDataService(), events);

		const f = await ctrl.createFulfillment({
			orderId: "order-1",
			items: [
				{ lineItemId: "item-1", quantity: 1 },
				{ lineItemId: "item-2", quantity: 2 },
			],
			notes: "Fragile items",
		});
		expect(f.status).toBe("pending");

		await ctrl.updateStatus(f.id, "processing");
		await ctrl.addTracking(f.id, {
			carrier: "UPS",
			trackingNumber: "1Z999",
			trackingUrl: "https://ups.com/track/1Z999",
		});
		await ctrl.updateStatus(f.id, "shipped");
		const delivered = await ctrl.updateStatus(f.id, "delivered");

		expect(delivered?.status).toBe("delivered");
		expect(delivered?.carrier).toBe("UPS");
		expect(delivered?.trackingNumber).toBe("1Z999");
		expect(delivered?.shippedAt).toBeInstanceOf(Date);
		expect(delivered?.deliveredAt).toBeInstanceOf(Date);

		const eventTypes = events.emitted.map((e) => e.type);
		expect(eventTypes).toContain("fulfillment.created");
		expect(eventTypes).toContain("fulfillment.shipped");
		expect(eventTypes).toContain("fulfillment.delivered");
	});

	it("create → cancel lifecycle", async () => {
		const events = createMockEvents();
		const ctrl = createFulfillmentController(createMockDataService(), events);

		const f = await ctrl.createFulfillment({
			orderId: "order-1",
			items: [{ lineItemId: "item-1", quantity: 1 }],
		});
		const cancelled = await ctrl.cancelFulfillment(f.id);

		expect(cancelled?.status).toBe("cancelled");
		const eventTypes = events.emitted.map((e) => e.type);
		expect(eventTypes).toContain("fulfillment.created");
		expect(eventTypes).toContain("fulfillment.cancelled");
	});

	it("multiple fulfillments for same order", async () => {
		const ctrl = createFulfillmentController(createMockDataService());
		const f1 = await ctrl.createFulfillment({
			orderId: "order-1",
			items: [{ lineItemId: "item-1", quantity: 1 }],
		});
		const f2 = await ctrl.createFulfillment({
			orderId: "order-1",
			items: [{ lineItemId: "item-2", quantity: 2 }],
		});

		await ctrl.updateStatus(f1.id, "shipped");
		await ctrl.cancelFulfillment(f2.id);

		const all = await ctrl.listByOrder("order-1");
		expect(all).toHaveLength(2);
		expect(all.find((f) => f.id === f1.id)?.status).toBe("shipped");
		expect(all.find((f) => f.id === f2.id)?.status).toBe("cancelled");
	});
});
