import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createFavorController } from "../service-impl";

describe("favor controller", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createFavorController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createFavorController(mockData);
	});

	// ── createDelivery ──────────────────────────────────────────────────

	describe("createDelivery", () => {
		it("creates a delivery with pending status", async () => {
			const delivery = await controller.createDelivery({
				orderId: "ord_1",
				pickupAddress: { street: "123 Main St" },
				dropoffAddress: { street: "456 Oak Ave" },
				fee: 799,
			});
			expect(delivery.id).toBeTruthy();
			expect(delivery.status).toBe("pending");
			expect(delivery.orderId).toBe("ord_1");
			expect(delivery.fee).toBe(799);
		});

		it("sets tip to 0 by default", async () => {
			const delivery = await controller.createDelivery({
				orderId: "ord_1",
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
				fee: 500,
			});
			expect(delivery.tip).toBe(0);
		});

		it("accepts custom tip", async () => {
			const delivery = await controller.createDelivery({
				orderId: "ord_1",
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
				fee: 500,
				tip: 300,
			});
			expect(delivery.tip).toBe(300);
		});

		it("stores special instructions", async () => {
			const delivery = await controller.createDelivery({
				orderId: "ord_1",
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
				fee: 500,
				specialInstructions: "Ring the bell twice",
			});
			expect(delivery.specialInstructions).toBe("Ring the bell twice");
		});

		it("generates unique IDs", async () => {
			const d1 = await controller.createDelivery({
				orderId: "ord_1",
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
				fee: 500,
			});
			const d2 = await controller.createDelivery({
				orderId: "ord_2",
				pickupAddress: { street: "C" },
				dropoffAddress: { street: "D" },
				fee: 600,
			});
			expect(d1.id).not.toBe(d2.id);
		});

		it("sets createdAt and updatedAt", async () => {
			const before = Date.now();
			const delivery = await controller.createDelivery({
				orderId: "ord_1",
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
				fee: 500,
			});
			const after = Date.now();
			expect(delivery.createdAt.getTime()).toBeGreaterThanOrEqual(before);
			expect(delivery.createdAt.getTime()).toBeLessThanOrEqual(after);
		});
	});

	// ── getDelivery ─────────────────────────────────────────────────────

	describe("getDelivery", () => {
		it("returns a delivery by id", async () => {
			const created = await controller.createDelivery({
				orderId: "ord_1",
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
				fee: 500,
			});
			const found = await controller.getDelivery(created.id);
			expect(found).not.toBeNull();
			expect(found?.orderId).toBe("ord_1");
		});

		it("returns null for non-existent id", async () => {
			const found = await controller.getDelivery("nonexistent");
			expect(found).toBeNull();
		});
	});

	// ── cancelDelivery ──────────────────────────────────────────────────

	describe("cancelDelivery", () => {
		it("cancels a pending delivery", async () => {
			const created = await controller.createDelivery({
				orderId: "ord_1",
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
				fee: 500,
			});
			const cancelled = await controller.cancelDelivery(created.id);
			expect(cancelled?.status).toBe("cancelled");
		});

		it("returns null for non-existent delivery", async () => {
			const result = await controller.cancelDelivery("nonexistent");
			expect(result).toBeNull();
		});

		it("returns null for already-completed delivery", async () => {
			const created = await controller.createDelivery({
				orderId: "ord_1",
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
				fee: 500,
			});
			await controller.updateDeliveryStatus(created.id, "completed");
			const result = await controller.cancelDelivery(created.id);
			expect(result).toBeNull();
		});

		it("returns null for already-cancelled delivery", async () => {
			const created = await controller.createDelivery({
				orderId: "ord_1",
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
				fee: 500,
			});
			await controller.cancelDelivery(created.id);
			const result = await controller.cancelDelivery(created.id);
			expect(result).toBeNull();
		});
	});

	// ── updateDeliveryStatus ────────────────────────────────────────────

	describe("updateDeliveryStatus", () => {
		it("updates status to assigned with runner info", async () => {
			const created = await controller.createDelivery({
				orderId: "ord_1",
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
				fee: 500,
			});
			const updated = await controller.updateDeliveryStatus(
				created.id,
				"assigned",
				{
					runnerName: "Maria",
					runnerPhone: "555-1234",
				},
			);
			expect(updated?.status).toBe("assigned");
			expect(updated?.runnerName).toBe("Maria");
			expect(updated?.runnerPhone).toBe("555-1234");
		});

		it("returns null for non-existent delivery", async () => {
			const result = await controller.updateDeliveryStatus(
				"nonexistent",
				"assigned",
			);
			expect(result).toBeNull();
		});

		it("updates tracking URL", async () => {
			const created = await controller.createDelivery({
				orderId: "ord_1",
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
				fee: 500,
			});
			const updated = await controller.updateDeliveryStatus(
				created.id,
				"en-route",
				{ trackingUrl: "https://track.favordelivery.com/123" },
			);
			expect(updated?.trackingUrl).toBe("https://track.favordelivery.com/123");
		});

		it("updates updatedAt timestamp", async () => {
			const created = await controller.createDelivery({
				orderId: "ord_1",
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
				fee: 500,
			});
			const original = created.updatedAt.getTime();
			const updated = await controller.updateDeliveryStatus(
				created.id,
				"assigned",
			);
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(original);
		});
	});

	// ── listDeliveries ──────────────────────────────────────────────────

	describe("listDeliveries", () => {
		it("returns empty array when no deliveries exist", async () => {
			const deliveries = await controller.listDeliveries();
			expect(deliveries).toHaveLength(0);
		});

		it("returns all deliveries", async () => {
			await controller.createDelivery({
				orderId: "ord_1",
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
				fee: 500,
			});
			await controller.createDelivery({
				orderId: "ord_2",
				pickupAddress: { street: "C" },
				dropoffAddress: { street: "D" },
				fee: 600,
			});
			const deliveries = await controller.listDeliveries();
			expect(deliveries).toHaveLength(2);
		});

		it("filters by status", async () => {
			const d1 = await controller.createDelivery({
				orderId: "ord_1",
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
				fee: 500,
			});
			await controller.createDelivery({
				orderId: "ord_2",
				pickupAddress: { street: "C" },
				dropoffAddress: { street: "D" },
				fee: 600,
			});
			await controller.updateDeliveryStatus(d1.id, "completed");
			const completed = await controller.listDeliveries({
				status: "completed",
			});
			expect(completed).toHaveLength(1);
		});

		it("filters by orderId", async () => {
			await controller.createDelivery({
				orderId: "ord_1",
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
				fee: 500,
			});
			await controller.createDelivery({
				orderId: "ord_2",
				pickupAddress: { street: "C" },
				dropoffAddress: { street: "D" },
				fee: 600,
			});
			const results = await controller.listDeliveries({
				orderId: "ord_1",
			});
			expect(results).toHaveLength(1);
			expect(results[0].orderId).toBe("ord_1");
		});

		it("respects take and skip", async () => {
			await controller.createDelivery({
				orderId: "ord_1",
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
				fee: 500,
			});
			await controller.createDelivery({
				orderId: "ord_2",
				pickupAddress: { street: "C" },
				dropoffAddress: { street: "D" },
				fee: 600,
			});
			const page = await controller.listDeliveries({ take: 1 });
			expect(page).toHaveLength(1);
			const skipped = await controller.listDeliveries({ skip: 10 });
			expect(skipped).toHaveLength(0);
		});
	});

	// ── service areas ───────────────────────────────────────────────────

	describe("createServiceArea", () => {
		it("creates a service area with defaults", async () => {
			const area = await controller.createServiceArea({
				name: "Downtown Austin",
				zipCodes: ["78701", "78702"],
				deliveryFee: 599,
				estimatedMinutes: 30,
			});
			expect(area.id).toBeTruthy();
			expect(area.name).toBe("Downtown Austin");
			expect(area.isActive).toBe(true);
			expect(area.minOrderAmount).toBe(0);
			expect(area.zipCodes).toEqual(["78701", "78702"]);
		});

		it("accepts custom minOrderAmount", async () => {
			const area = await controller.createServiceArea({
				name: "Suburbs",
				zipCodes: ["78750"],
				deliveryFee: 899,
				estimatedMinutes: 45,
				minOrderAmount: 1500,
			});
			expect(area.minOrderAmount).toBe(1500);
		});
	});

	describe("updateServiceArea", () => {
		it("updates service area name", async () => {
			const area = await controller.createServiceArea({
				name: "Original",
				zipCodes: ["78701"],
				deliveryFee: 599,
				estimatedMinutes: 30,
			});
			const updated = await controller.updateServiceArea(area.id, {
				name: "Updated",
			});
			expect(updated?.name).toBe("Updated");
		});

		it("deactivates a service area", async () => {
			const area = await controller.createServiceArea({
				name: "Test",
				zipCodes: ["78701"],
				deliveryFee: 599,
				estimatedMinutes: 30,
			});
			const updated = await controller.updateServiceArea(area.id, {
				isActive: false,
			});
			expect(updated?.isActive).toBe(false);
		});

		it("returns null for non-existent id", async () => {
			const result = await controller.updateServiceArea("nonexistent", {
				name: "Test",
			});
			expect(result).toBeNull();
		});

		it("updates multiple fields at once", async () => {
			const area = await controller.createServiceArea({
				name: "Test",
				zipCodes: ["78701"],
				deliveryFee: 599,
				estimatedMinutes: 30,
			});
			const updated = await controller.updateServiceArea(area.id, {
				name: "Updated",
				deliveryFee: 899,
				estimatedMinutes: 45,
				zipCodes: ["78701", "78702", "78703"],
			});
			expect(updated?.name).toBe("Updated");
			expect(updated?.deliveryFee).toBe(899);
			expect(updated?.estimatedMinutes).toBe(45);
			expect(updated?.zipCodes).toEqual(["78701", "78702", "78703"]);
		});
	});

	describe("deleteServiceArea", () => {
		it("deletes an existing service area", async () => {
			const area = await controller.createServiceArea({
				name: "Test",
				zipCodes: ["78701"],
				deliveryFee: 599,
				estimatedMinutes: 30,
			});
			const result = await controller.deleteServiceArea(area.id);
			expect(result).toBe(true);
		});

		it("returns false for non-existent id", async () => {
			const result = await controller.deleteServiceArea("nonexistent");
			expect(result).toBe(false);
		});
	});

	describe("listServiceAreas", () => {
		it("returns all service areas", async () => {
			await controller.createServiceArea({
				name: "Area 1",
				zipCodes: ["78701"],
				deliveryFee: 599,
				estimatedMinutes: 30,
			});
			await controller.createServiceArea({
				name: "Area 2",
				zipCodes: ["78702"],
				deliveryFee: 699,
				estimatedMinutes: 35,
			});
			const areas = await controller.listServiceAreas();
			expect(areas).toHaveLength(2);
		});

		it("returns empty array when none exist", async () => {
			const areas = await controller.listServiceAreas();
			expect(areas).toHaveLength(0);
		});
	});

	// ── checkAvailability ───────────────────────────────────────────────

	describe("checkAvailability", () => {
		it("returns available when zip code is in a service area", async () => {
			await controller.createServiceArea({
				name: "Downtown",
				zipCodes: ["78701", "78702"],
				deliveryFee: 599,
				estimatedMinutes: 30,
			});
			const result = await controller.checkAvailability("78701");
			expect(result.available).toBe(true);
			expect(result.area).not.toBeNull();
			expect(result.area?.name).toBe("Downtown");
		});

		it("returns unavailable for unknown zip code", async () => {
			await controller.createServiceArea({
				name: "Downtown",
				zipCodes: ["78701"],
				deliveryFee: 599,
				estimatedMinutes: 30,
			});
			const result = await controller.checkAvailability("90210");
			expect(result.available).toBe(false);
			expect(result.area).toBeNull();
		});

		it("ignores inactive service areas", async () => {
			const area = await controller.createServiceArea({
				name: "Closed Area",
				zipCodes: ["78701"],
				deliveryFee: 599,
				estimatedMinutes: 30,
			});
			await controller.updateServiceArea(area.id, { isActive: false });
			const result = await controller.checkAvailability("78701");
			expect(result.available).toBe(false);
		});
	});

	// ── getDeliveryStats ────────────────────────────────────────────────

	describe("getDeliveryStats", () => {
		it("returns zeroes when no deliveries exist", async () => {
			const stats = await controller.getDeliveryStats();
			expect(stats.totalDeliveries).toBe(0);
			expect(stats.totalFees).toBe(0);
			expect(stats.totalTips).toBe(0);
		});

		it("aggregates stats correctly", async () => {
			const d1 = await controller.createDelivery({
				orderId: "ord_1",
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
				fee: 500,
				tip: 200,
			});
			const d2 = await controller.createDelivery({
				orderId: "ord_2",
				pickupAddress: { street: "C" },
				dropoffAddress: { street: "D" },
				fee: 600,
				tip: 100,
			});
			await controller.createDelivery({
				orderId: "ord_3",
				pickupAddress: { street: "E" },
				dropoffAddress: { street: "F" },
				fee: 700,
			});

			await controller.updateDeliveryStatus(d1.id, "completed");
			await controller.cancelDelivery(d2.id);

			const stats = await controller.getDeliveryStats();
			expect(stats.totalDeliveries).toBe(3);
			expect(stats.totalCompleted).toBe(1);
			expect(stats.totalCancelled).toBe(1);
			expect(stats.totalPending).toBe(1);
			expect(stats.totalFees).toBe(1800);
			expect(stats.totalTips).toBe(300);
		});
	});

	// ── full lifecycle ──────────────────────────────────────────────────

	describe("full lifecycle", () => {
		it("delivery: pending -> assigned -> en-route -> arrived -> completed", async () => {
			const delivery = await controller.createDelivery({
				orderId: "ord_lifecycle",
				pickupAddress: { street: "123 Main" },
				dropoffAddress: { street: "456 Oak" },
				fee: 799,
				tip: 300,
				specialInstructions: "Leave at door",
			});
			expect(delivery.status).toBe("pending");

			const assigned = await controller.updateDeliveryStatus(
				delivery.id,
				"assigned",
				{
					runnerName: "Carlos",
					runnerPhone: "555-0000",
					externalId: "favor_ext_42",
				},
			);
			expect(assigned?.status).toBe("assigned");
			expect(assigned?.runnerName).toBe("Carlos");

			const enRoute = await controller.updateDeliveryStatus(
				delivery.id,
				"en-route",
				{
					trackingUrl: "https://track.favor.com/42",
					estimatedArrival: new Date("2026-03-16T15:30:00Z"),
				},
			);
			expect(enRoute?.status).toBe("en-route");

			const arrived = await controller.updateDeliveryStatus(
				delivery.id,
				"arrived",
			);
			expect(arrived?.status).toBe("arrived");

			const completed = await controller.updateDeliveryStatus(
				delivery.id,
				"completed",
				{ actualArrival: new Date() },
			);
			expect(completed?.status).toBe("completed");
			expect(completed?.actualArrival).toBeDefined();
		});
	});
});
