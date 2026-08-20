import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import { createShippingController } from "../service-impl";

// ---------------------------------------------------------------------------
// createShipment / getShipment
// ---------------------------------------------------------------------------

describe("createShipment", () => {
	it("creates a shipment with defaults", async () => {
		const ctrl = createShippingController(createMockDataService());
		const shipment = await ctrl.createShipment({ orderId: "order-1" });

		expect(shipment.orderId).toBe("order-1");
		expect(shipment.status).toBe("pending");
		expect(shipment.id).toBeTruthy();
		expect(shipment.createdAt).toBeInstanceOf(Date);
	});

	it("accepts carrier and method IDs", async () => {
		const ctrl = createShippingController(createMockDataService());
		const shipment = await ctrl.createShipment({
			orderId: "order-1",
			carrierId: "carrier-1",
			methodId: "method-1",
		});
		expect(shipment.carrierId).toBe("carrier-1");
		expect(shipment.methodId).toBe("method-1");
	});

	it("accepts tracking number", async () => {
		const ctrl = createShippingController(createMockDataService());
		const shipment = await ctrl.createShipment({
			orderId: "order-1",
			trackingNumber: "1Z999AA10123456784",
		});
		expect(shipment.trackingNumber).toBe("1Z999AA10123456784");
	});

	it("accepts estimated delivery date", async () => {
		const ctrl = createShippingController(createMockDataService());
		const delivery = new Date("2026-03-20");
		const shipment = await ctrl.createShipment({
			orderId: "order-1",
			estimatedDelivery: delivery,
		});
		expect(shipment.estimatedDelivery).toEqual(delivery);
	});

	it("accepts notes", async () => {
		const ctrl = createShippingController(createMockDataService());
		const shipment = await ctrl.createShipment({
			orderId: "order-1",
			notes: "Handle with care",
		});
		expect(shipment.notes).toBe("Handle with care");
	});

	it("always starts in pending status", async () => {
		const ctrl = createShippingController(createMockDataService());
		const shipment = await ctrl.createShipment({
			orderId: "order-1",
			trackingNumber: "TRACK123",
		});
		expect(shipment.status).toBe("pending");
	});
});

describe("getShipment", () => {
	it("returns null for missing shipment", async () => {
		const ctrl = createShippingController(createMockDataService());
		expect(await ctrl.getShipment("nope")).toBeNull();
	});

	it("returns shipment when it exists", async () => {
		const ctrl = createShippingController(createMockDataService());
		const shipment = await ctrl.createShipment({ orderId: "order-1" });
		const fetched = await ctrl.getShipment(shipment.id);
		expect(fetched?.orderId).toBe("order-1");
	});
});

// ---------------------------------------------------------------------------
// listShipments
// ---------------------------------------------------------------------------

describe("listShipments", () => {
	it("lists all shipments", async () => {
		const ctrl = createShippingController(createMockDataService());
		await ctrl.createShipment({ orderId: "order-1" });
		await ctrl.createShipment({ orderId: "order-2" });
		expect(await ctrl.listShipments()).toHaveLength(2);
	});

	it("filters by orderId", async () => {
		const ctrl = createShippingController(createMockDataService());
		await ctrl.createShipment({ orderId: "order-1" });
		await ctrl.createShipment({ orderId: "order-2" });
		await ctrl.createShipment({ orderId: "order-1" });
		const results = await ctrl.listShipments({ orderId: "order-1" });
		expect(results).toHaveLength(2);
	});

	it("filters by status", async () => {
		const ctrl = createShippingController(createMockDataService());
		const s1 = await ctrl.createShipment({ orderId: "order-1" });
		await ctrl.createShipment({ orderId: "order-2" });
		await ctrl.updateShipmentStatus(s1.id, "shipped");
		const shipped = await ctrl.listShipments({ status: "shipped" });
		expect(shipped).toHaveLength(1);
		expect(shipped[0].orderId).toBe("order-1");
	});

	it("returns empty array when no shipments exist", async () => {
		const ctrl = createShippingController(createMockDataService());
		expect(await ctrl.listShipments()).toHaveLength(0);
	});

	it("filters by both orderId and status", async () => {
		const ctrl = createShippingController(createMockDataService());
		const s1 = await ctrl.createShipment({ orderId: "order-1" });
		await ctrl.createShipment({ orderId: "order-1" });
		await ctrl.updateShipmentStatus(s1.id, "shipped");
		const results = await ctrl.listShipments({
			orderId: "order-1",
			status: "shipped",
		});
		expect(results).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// updateShipment
// ---------------------------------------------------------------------------

describe("updateShipment", () => {
	it("updates tracking number", async () => {
		const ctrl = createShippingController(createMockDataService());
		const shipment = await ctrl.createShipment({ orderId: "order-1" });
		const updated = await ctrl.updateShipment(shipment.id, {
			trackingNumber: "TRACK456",
		});
		expect(updated?.trackingNumber).toBe("TRACK456");
	});

	it("updates carrier ID", async () => {
		const ctrl = createShippingController(createMockDataService());
		const shipment = await ctrl.createShipment({ orderId: "order-1" });
		const updated = await ctrl.updateShipment(shipment.id, {
			carrierId: "carrier-2",
		});
		expect(updated?.carrierId).toBe("carrier-2");
	});

	it("updates method ID", async () => {
		const ctrl = createShippingController(createMockDataService());
		const shipment = await ctrl.createShipment({ orderId: "order-1" });
		const updated = await ctrl.updateShipment(shipment.id, {
			methodId: "method-2",
		});
		expect(updated?.methodId).toBe("method-2");
	});

	it("updates estimated delivery", async () => {
		const ctrl = createShippingController(createMockDataService());
		const shipment = await ctrl.createShipment({ orderId: "order-1" });
		const newDate = new Date("2026-04-01");
		const updated = await ctrl.updateShipment(shipment.id, {
			estimatedDelivery: newDate,
		});
		expect(updated?.estimatedDelivery).toEqual(newDate);
	});

	it("updates notes", async () => {
		const ctrl = createShippingController(createMockDataService());
		const shipment = await ctrl.createShipment({ orderId: "order-1" });
		const updated = await ctrl.updateShipment(shipment.id, {
			notes: "Updated notes",
		});
		expect(updated?.notes).toBe("Updated notes");
	});

	it("returns null for missing shipment", async () => {
		const ctrl = createShippingController(createMockDataService());
		expect(await ctrl.updateShipment("nope", { notes: "Fail" })).toBeNull();
	});

	it("preserves fields not included in update", async () => {
		const ctrl = createShippingController(createMockDataService());
		const shipment = await ctrl.createShipment({
			orderId: "order-1",
			carrierId: "carrier-1",
			trackingNumber: "TRACK123",
			notes: "Original notes",
		});
		const updated = await ctrl.updateShipment(shipment.id, {
			notes: "New notes",
		});
		expect(updated?.carrierId).toBe("carrier-1");
		expect(updated?.trackingNumber).toBe("TRACK123");
		expect(updated?.orderId).toBe("order-1");
	});

	it("does not change status through updateShipment", async () => {
		const ctrl = createShippingController(createMockDataService());
		const shipment = await ctrl.createShipment({ orderId: "order-1" });
		const updated = await ctrl.updateShipment(shipment.id, {
			trackingNumber: "TRACK123",
		});
		expect(updated?.status).toBe("pending");
	});
});

// ---------------------------------------------------------------------------
// updateShipmentStatus
// ---------------------------------------------------------------------------

describe("updateShipmentStatus", () => {
	it("transitions from pending to shipped", async () => {
		const ctrl = createShippingController(createMockDataService());
		const shipment = await ctrl.createShipment({ orderId: "order-1" });
		const updated = await ctrl.updateShipmentStatus(shipment.id, "shipped");
		expect(updated?.status).toBe("shipped");
		expect(updated?.shippedAt).toBeInstanceOf(Date);
	});

	it("transitions from shipped to in_transit", async () => {
		const ctrl = createShippingController(createMockDataService());
		const shipment = await ctrl.createShipment({ orderId: "order-1" });
		await ctrl.updateShipmentStatus(shipment.id, "shipped");
		const updated = await ctrl.updateShipmentStatus(shipment.id, "in_transit");
		expect(updated?.status).toBe("in_transit");
	});

	it("transitions from in_transit to delivered", async () => {
		const ctrl = createShippingController(createMockDataService());
		const shipment = await ctrl.createShipment({ orderId: "order-1" });
		await ctrl.updateShipmentStatus(shipment.id, "shipped");
		await ctrl.updateShipmentStatus(shipment.id, "in_transit");
		const updated = await ctrl.updateShipmentStatus(shipment.id, "delivered");
		expect(updated?.status).toBe("delivered");
		expect(updated?.deliveredAt).toBeInstanceOf(Date);
	});

	it("transitions from shipped directly to delivered", async () => {
		const ctrl = createShippingController(createMockDataService());
		const shipment = await ctrl.createShipment({ orderId: "order-1" });
		await ctrl.updateShipmentStatus(shipment.id, "shipped");
		const updated = await ctrl.updateShipmentStatus(shipment.id, "delivered");
		expect(updated?.status).toBe("delivered");
	});

	it("transitions from pending to failed", async () => {
		const ctrl = createShippingController(createMockDataService());
		const shipment = await ctrl.createShipment({ orderId: "order-1" });
		const updated = await ctrl.updateShipmentStatus(shipment.id, "failed");
		expect(updated?.status).toBe("failed");
	});

	it("transitions from failed back to pending", async () => {
		const ctrl = createShippingController(createMockDataService());
		const shipment = await ctrl.createShipment({ orderId: "order-1" });
		await ctrl.updateShipmentStatus(shipment.id, "failed");
		const updated = await ctrl.updateShipmentStatus(shipment.id, "pending");
		expect(updated?.status).toBe("pending");
	});

	it("transitions from delivered to returned", async () => {
		const ctrl = createShippingController(createMockDataService());
		const shipment = await ctrl.createShipment({ orderId: "order-1" });
		await ctrl.updateShipmentStatus(shipment.id, "shipped");
		await ctrl.updateShipmentStatus(shipment.id, "delivered");
		const updated = await ctrl.updateShipmentStatus(shipment.id, "returned");
		expect(updated?.status).toBe("returned");
	});

	it("rejects invalid transition: pending to delivered", async () => {
		const ctrl = createShippingController(createMockDataService());
		const shipment = await ctrl.createShipment({ orderId: "order-1" });
		const result = await ctrl.updateShipmentStatus(shipment.id, "delivered");
		expect(result).toBeNull();
	});

	it("rejects invalid transition: pending to in_transit", async () => {
		const ctrl = createShippingController(createMockDataService());
		const shipment = await ctrl.createShipment({ orderId: "order-1" });
		const result = await ctrl.updateShipmentStatus(shipment.id, "in_transit");
		expect(result).toBeNull();
	});

	it("rejects invalid transition: pending to returned", async () => {
		const ctrl = createShippingController(createMockDataService());
		const shipment = await ctrl.createShipment({ orderId: "order-1" });
		const result = await ctrl.updateShipmentStatus(shipment.id, "returned");
		expect(result).toBeNull();
	});

	it("rejects transition from returned (terminal state)", async () => {
		const ctrl = createShippingController(createMockDataService());
		const shipment = await ctrl.createShipment({ orderId: "order-1" });
		await ctrl.updateShipmentStatus(shipment.id, "shipped");
		await ctrl.updateShipmentStatus(shipment.id, "delivered");
		await ctrl.updateShipmentStatus(shipment.id, "returned");
		const result = await ctrl.updateShipmentStatus(shipment.id, "pending");
		expect(result).toBeNull();
	});

	it("returns null for missing shipment", async () => {
		const ctrl = createShippingController(createMockDataService());
		expect(await ctrl.updateShipmentStatus("nope", "shipped")).toBeNull();
	});

	it("sets shippedAt only on shipped transition", async () => {
		const ctrl = createShippingController(createMockDataService());
		const shipment = await ctrl.createShipment({ orderId: "order-1" });
		expect(shipment.shippedAt).toBeUndefined();
		const shipped = await ctrl.updateShipmentStatus(shipment.id, "shipped");
		expect(shipped?.shippedAt).toBeInstanceOf(Date);
	});

	it("sets deliveredAt only on delivered transition", async () => {
		const ctrl = createShippingController(createMockDataService());
		const shipment = await ctrl.createShipment({ orderId: "order-1" });
		await ctrl.updateShipmentStatus(shipment.id, "shipped");
		const delivered = await ctrl.updateShipmentStatus(shipment.id, "delivered");
		expect(delivered?.deliveredAt).toBeInstanceOf(Date);
	});

	it("allows shipped to returned", async () => {
		const ctrl = createShippingController(createMockDataService());
		const shipment = await ctrl.createShipment({ orderId: "order-1" });
		await ctrl.updateShipmentStatus(shipment.id, "shipped");
		const returned = await ctrl.updateShipmentStatus(shipment.id, "returned");
		expect(returned?.status).toBe("returned");
	});

	it("allows shipped to failed", async () => {
		const ctrl = createShippingController(createMockDataService());
		const shipment = await ctrl.createShipment({ orderId: "order-1" });
		await ctrl.updateShipmentStatus(shipment.id, "shipped");
		const failed = await ctrl.updateShipmentStatus(shipment.id, "failed");
		expect(failed?.status).toBe("failed");
	});

	it("allows in_transit to returned", async () => {
		const ctrl = createShippingController(createMockDataService());
		const shipment = await ctrl.createShipment({ orderId: "order-1" });
		await ctrl.updateShipmentStatus(shipment.id, "shipped");
		await ctrl.updateShipmentStatus(shipment.id, "in_transit");
		const returned = await ctrl.updateShipmentStatus(shipment.id, "returned");
		expect(returned?.status).toBe("returned");
	});

	it("allows in_transit to failed", async () => {
		const ctrl = createShippingController(createMockDataService());
		const shipment = await ctrl.createShipment({ orderId: "order-1" });
		await ctrl.updateShipmentStatus(shipment.id, "shipped");
		await ctrl.updateShipmentStatus(shipment.id, "in_transit");
		const failed = await ctrl.updateShipmentStatus(shipment.id, "failed");
		expect(failed?.status).toBe("failed");
	});
});

// ---------------------------------------------------------------------------
// deleteShipment
// ---------------------------------------------------------------------------

describe("deleteShipment", () => {
	it("deletes an existing shipment", async () => {
		const ctrl = createShippingController(createMockDataService());
		const shipment = await ctrl.createShipment({ orderId: "order-1" });
		expect(await ctrl.deleteShipment(shipment.id)).toBe(true);
		expect(await ctrl.getShipment(shipment.id)).toBeNull();
	});

	it("returns false for missing shipment", async () => {
		const ctrl = createShippingController(createMockDataService());
		expect(await ctrl.deleteShipment("nope")).toBe(false);
	});

	it("double delete returns false", async () => {
		const ctrl = createShippingController(createMockDataService());
		const shipment = await ctrl.createShipment({ orderId: "order-1" });
		await ctrl.deleteShipment(shipment.id);
		expect(await ctrl.deleteShipment(shipment.id)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// getTrackingUrl
// ---------------------------------------------------------------------------

describe("getTrackingUrl", () => {
	it("returns tracking URL when carrier has template", async () => {
		const ctrl = createShippingController(createMockDataService());
		const carrier = await ctrl.createCarrier({
			name: "FedEx",
			code: "fedex",
			trackingUrlTemplate:
				"https://www.fedex.com/fedextrack/?trknbr={tracking}",
		});
		const shipment = await ctrl.createShipment({
			orderId: "order-1",
			carrierId: carrier.id,
			trackingNumber: "123456789",
		});
		const url = await ctrl.getTrackingUrl(shipment.id);
		expect(url).toBe("https://www.fedex.com/fedextrack/?trknbr=123456789");
	});

	it("returns null when shipment has no tracking number", async () => {
		const ctrl = createShippingController(createMockDataService());
		const carrier = await ctrl.createCarrier({
			name: "FedEx",
			code: "fedex",
			trackingUrlTemplate: "https://track.fedex.com/{tracking}",
		});
		const shipment = await ctrl.createShipment({
			orderId: "order-1",
			carrierId: carrier.id,
		});
		expect(await ctrl.getTrackingUrl(shipment.id)).toBeNull();
	});

	it("returns null when shipment has no carrier", async () => {
		const ctrl = createShippingController(createMockDataService());
		const shipment = await ctrl.createShipment({
			orderId: "order-1",
			trackingNumber: "TRACK123",
		});
		expect(await ctrl.getTrackingUrl(shipment.id)).toBeNull();
	});

	it("returns null when carrier has no tracking URL template", async () => {
		const ctrl = createShippingController(createMockDataService());
		const carrier = await ctrl.createCarrier({
			name: "Custom",
			code: "custom",
		});
		const shipment = await ctrl.createShipment({
			orderId: "order-1",
			carrierId: carrier.id,
			trackingNumber: "TRACK123",
		});
		expect(await ctrl.getTrackingUrl(shipment.id)).toBeNull();
	});

	it("returns null for missing shipment", async () => {
		const ctrl = createShippingController(createMockDataService());
		expect(await ctrl.getTrackingUrl("nope")).toBeNull();
	});

	it("replaces {tracking} placeholder in URL", async () => {
		const ctrl = createShippingController(createMockDataService());
		const carrier = await ctrl.createCarrier({
			name: "UPS",
			code: "ups",
			trackingUrlTemplate: "https://www.ups.com/track?tracknum={tracking}",
		});
		const shipment = await ctrl.createShipment({
			orderId: "order-1",
			carrierId: carrier.id,
			trackingNumber: "1Z999AA10123456784",
		});
		const url = await ctrl.getTrackingUrl(shipment.id);
		expect(url).toBe("https://www.ups.com/track?tracknum=1Z999AA10123456784");
	});
});
