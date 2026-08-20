import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createFavorController } from "../service-impl";

function defined<T>(val: T | null | undefined, label = "value"): T {
	if (val == null) throw new Error(`Expected ${label} to be defined`);
	return val;
}

describe("favor controller", () => {
	let data: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createFavorController>;

	beforeEach(() => {
		data = createMockDataService();
		controller = createFavorController(data);
	});

	// ── createDelivery ─────────────────────────────────────────────────

	describe("createDelivery", () => {
		it("creates a delivery with all required fields", async () => {
			const delivery = await controller.createDelivery({
				orderId: "order_1",
				pickupAddress: { street: "123 Main St", city: "Austin" },
				dropoffAddress: { street: "456 Elm St", city: "Austin" },
				fee: 599,
			});

			expect(delivery.id).toEqual(expect.any(String));
			expect(delivery.orderId).toBe("order_1");
			expect(delivery.status).toBe("pending");
			expect(delivery.pickupAddress).toEqual({
				street: "123 Main St",
				city: "Austin",
			});
			expect(delivery.dropoffAddress).toEqual({
				street: "456 Elm St",
				city: "Austin",
			});
			expect(delivery.fee).toBe(599);
			expect(delivery.tip).toBe(0);
			expect(delivery.metadata).toEqual({});
			expect(delivery.createdAt).toBeInstanceOf(Date);
			expect(delivery.updatedAt).toBeInstanceOf(Date);
		});

		it("applies default tip of 0 when not provided", async () => {
			const delivery = await controller.createDelivery({
				orderId: "order_2",
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
				fee: 300,
			});

			expect(delivery.tip).toBe(0);
		});

		it("uses provided tip when given", async () => {
			const delivery = await controller.createDelivery({
				orderId: "order_3",
				pickupAddress: { street: "A" },
				dropoffAddress: { street: "B" },
				fee: 300,
				tip: 150,
			});

			expect(delivery.tip).toBe(150);
		});

		it("applies default empty metadata when not provided", async () => {
			const delivery = await controller.createDelivery({
				orderId: "order_4",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 100,
			});

			expect(delivery.metadata).toEqual({});
		});

		it("uses provided metadata when given", async () => {
			const delivery = await controller.createDelivery({
				orderId: "order_5",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 100,
				metadata: { source: "app", priority: "high" },
			});

			expect(delivery.metadata).toEqual({
				source: "app",
				priority: "high",
			});
		});

		it("stores specialInstructions when provided", async () => {
			const delivery = await controller.createDelivery({
				orderId: "order_6",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 200,
				specialInstructions: "Ring doorbell twice",
			});

			expect(delivery.specialInstructions).toBe("Ring doorbell twice");
		});

		it("persists delivery in data store", async () => {
			const delivery = await controller.createDelivery({
				orderId: "order_7",
				pickupAddress: { street: "X" },
				dropoffAddress: { street: "Y" },
				fee: 400,
			});

			const fetched = await controller.getDelivery(delivery.id);
			const result = defined(fetched, "fetched delivery");
			expect(result.orderId).toBe("order_7");
		});

		it("assigns unique IDs to different deliveries", async () => {
			const d1 = await controller.createDelivery({
				orderId: "order_a",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 100,
			});
			const d2 = await controller.createDelivery({
				orderId: "order_b",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 200,
			});

			expect(d1.id).not.toBe(d2.id);
		});
	});

	// ── getDelivery ────────────────────────────────────────────────────

	describe("getDelivery", () => {
		it("returns the delivery when it exists", async () => {
			const created = await controller.createDelivery({
				orderId: "order_get",
				pickupAddress: { street: "Pickup St" },
				dropoffAddress: { street: "Dropoff St" },
				fee: 500,
				tip: 100,
			});

			const fetched = defined(
				await controller.getDelivery(created.id),
				"delivery",
			);
			expect(fetched.orderId).toBe("order_get");
			expect(fetched.fee).toBe(500);
			expect(fetched.tip).toBe(100);
		});

		it("returns null for a non-existent delivery", async () => {
			const result = await controller.getDelivery("nonexistent_id");
			expect(result).toBeNull();
		});
	});

	// ── cancelDelivery ─────────────────────────────────────────────────

	describe("cancelDelivery", () => {
		it("cancels a pending delivery", async () => {
			const created = await controller.createDelivery({
				orderId: "order_cancel",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 300,
			});

			const cancelled = defined(
				await controller.cancelDelivery(created.id),
				"cancelled delivery",
			);
			expect(cancelled.status).toBe("cancelled");
			expect(cancelled.updatedAt.getTime()).toBeGreaterThanOrEqual(
				created.updatedAt.getTime(),
			);
		});

		it("cancels an assigned delivery", async () => {
			const created = await controller.createDelivery({
				orderId: "order_assigned",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 300,
			});
			await controller.updateDeliveryStatus(created.id, "assigned");

			const cancelled = defined(
				await controller.cancelDelivery(created.id),
				"cancelled delivery",
			);
			expect(cancelled.status).toBe("cancelled");
		});

		it("returns null when delivery does not exist", async () => {
			const result = await controller.cancelDelivery("nonexistent");
			expect(result).toBeNull();
		});

		it("returns null when delivery is already completed", async () => {
			const created = await controller.createDelivery({
				orderId: "order_done",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 300,
			});
			await controller.updateDeliveryStatus(created.id, "completed");

			const result = await controller.cancelDelivery(created.id);
			expect(result).toBeNull();
		});

		it("returns null when delivery is already cancelled", async () => {
			const created = await controller.createDelivery({
				orderId: "order_already_cancelled",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 300,
			});
			await controller.cancelDelivery(created.id);

			const result = await controller.cancelDelivery(created.id);
			expect(result).toBeNull();
		});

		it("persists the cancelled status in the data store", async () => {
			const created = await controller.createDelivery({
				orderId: "order_persist_cancel",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 300,
			});
			await controller.cancelDelivery(created.id);

			const fetched = defined(
				await controller.getDelivery(created.id),
				"re-fetched delivery",
			);
			expect(fetched.status).toBe("cancelled");
		});
	});

	// ── updateDeliveryStatus ───────────────────────────────────────────

	describe("updateDeliveryStatus", () => {
		it("updates the status of a delivery", async () => {
			const created = await controller.createDelivery({
				orderId: "order_status",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 400,
			});

			const updated = defined(
				await controller.updateDeliveryStatus(created.id, "assigned"),
				"updated delivery",
			);
			expect(updated.status).toBe("assigned");
		});

		it("returns null when delivery does not exist", async () => {
			const result = await controller.updateDeliveryStatus(
				"nonexistent",
				"assigned",
			);
			expect(result).toBeNull();
		});

		it("applies externalId from updates", async () => {
			const created = await controller.createDelivery({
				orderId: "order_ext",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 400,
			});

			const updated = defined(
				await controller.updateDeliveryStatus(created.id, "assigned", {
					externalId: "ext_123",
				}),
				"updated delivery",
			);
			expect(updated.externalId).toBe("ext_123");
		});

		it("applies runnerName and runnerPhone from updates", async () => {
			const created = await controller.createDelivery({
				orderId: "order_runner",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 400,
			});

			const updated = defined(
				await controller.updateDeliveryStatus(created.id, "assigned", {
					runnerName: "John Doe",
					runnerPhone: "+15551234567",
				}),
				"updated delivery",
			);
			expect(updated.runnerName).toBe("John Doe");
			expect(updated.runnerPhone).toBe("+15551234567");
		});

		it("applies trackingUrl from updates", async () => {
			const created = await controller.createDelivery({
				orderId: "order_track",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 400,
			});

			const updated = defined(
				await controller.updateDeliveryStatus(created.id, "en-route", {
					trackingUrl: "https://track.favor.com/abc",
				}),
				"updated delivery",
			);
			expect(updated.trackingUrl).toBe("https://track.favor.com/abc");
		});

		it("applies estimatedArrival and actualArrival from updates", async () => {
			const created = await controller.createDelivery({
				orderId: "order_arrival",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 400,
			});

			const estimated = new Date("2026-03-27T15:00:00Z");
			const actual = new Date("2026-03-27T15:05:00Z");

			const updated = defined(
				await controller.updateDeliveryStatus(created.id, "completed", {
					estimatedArrival: estimated,
					actualArrival: actual,
				}),
				"updated delivery",
			);
			expect(updated.estimatedArrival).toEqual(estimated);
			expect(updated.actualArrival).toEqual(actual);
		});

		it("applies all optional update fields at once", async () => {
			const created = await controller.createDelivery({
				orderId: "order_all_fields",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 400,
			});

			const eta = new Date("2026-04-01T12:00:00Z");
			const updated = defined(
				await controller.updateDeliveryStatus(created.id, "en-route", {
					externalId: "ext_999",
					runnerName: "Jane Smith",
					runnerPhone: "+15559876543",
					trackingUrl: "https://track.favor.com/xyz",
					estimatedArrival: eta,
				}),
				"updated delivery",
			);

			expect(updated.externalId).toBe("ext_999");
			expect(updated.runnerName).toBe("Jane Smith");
			expect(updated.runnerPhone).toBe("+15559876543");
			expect(updated.trackingUrl).toBe("https://track.favor.com/xyz");
			expect(updated.estimatedArrival).toEqual(eta);
			expect(updated.status).toBe("en-route");
		});

		it("updates the updatedAt timestamp", async () => {
			const created = await controller.createDelivery({
				orderId: "order_ts",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 400,
			});

			const updated = defined(
				await controller.updateDeliveryStatus(created.id, "assigned"),
				"updated delivery",
			);
			expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
				created.updatedAt.getTime(),
			);
		});

		it("does not modify fields not included in updates", async () => {
			const created = await controller.createDelivery({
				orderId: "order_no_extra",
				pickupAddress: { street: "Keep Me" },
				dropoffAddress: { street: "Keep Me Too" },
				fee: 500,
				tip: 100,
				specialInstructions: "Leave at door",
			});

			const updated = defined(
				await controller.updateDeliveryStatus(created.id, "assigned", {
					externalId: "ext_only",
				}),
				"updated delivery",
			);
			expect(updated.orderId).toBe("order_no_extra");
			expect(updated.pickupAddress).toEqual({ street: "Keep Me" });
			expect(updated.dropoffAddress).toEqual({ street: "Keep Me Too" });
			expect(updated.fee).toBe(500);
			expect(updated.tip).toBe(100);
			expect(updated.specialInstructions).toBe("Leave at door");
		});
	});

	// ── listDeliveries ─────────────────────────────────────────────────

	describe("listDeliveries", () => {
		it("returns all deliveries when no filters provided", async () => {
			await controller.createDelivery({
				orderId: "order_1",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 100,
			});
			await controller.createDelivery({
				orderId: "order_2",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 200,
			});

			const deliveries = await controller.listDeliveries();
			expect(deliveries).toHaveLength(2);
		});

		it("returns empty array when no deliveries exist", async () => {
			const deliveries = await controller.listDeliveries();
			expect(deliveries).toEqual([]);
		});

		it("filters deliveries by status", async () => {
			const d1 = await controller.createDelivery({
				orderId: "order_a",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 100,
			});
			await controller.createDelivery({
				orderId: "order_b",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 200,
			});
			await controller.updateDeliveryStatus(d1.id, "assigned");

			const assigned = await controller.listDeliveries({
				status: "assigned",
			});
			expect(assigned).toHaveLength(1);
			expect(assigned[0].orderId).toBe("order_a");
		});

		it("filters deliveries by orderId", async () => {
			await controller.createDelivery({
				orderId: "target_order",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 100,
			});
			await controller.createDelivery({
				orderId: "other_order",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 200,
			});

			const results = await controller.listDeliveries({
				orderId: "target_order",
			});
			expect(results).toHaveLength(1);
			expect(results[0].orderId).toBe("target_order");
		});

		it("supports take parameter for pagination", async () => {
			await controller.createDelivery({
				orderId: "o1",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 100,
			});
			await controller.createDelivery({
				orderId: "o2",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 200,
			});
			await controller.createDelivery({
				orderId: "o3",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 300,
			});

			const results = await controller.listDeliveries({ take: 2 });
			expect(results).toHaveLength(2);
		});

		it("supports skip parameter for pagination", async () => {
			await controller.createDelivery({
				orderId: "o1",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 100,
			});
			await controller.createDelivery({
				orderId: "o2",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 200,
			});
			await controller.createDelivery({
				orderId: "o3",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 300,
			});

			const results = await controller.listDeliveries({ skip: 2 });
			expect(results).toHaveLength(1);
		});

		it("combines status filter with take/skip", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createDelivery({
					orderId: `order_${i}`,
					pickupAddress: {},
					dropoffAddress: {},
					fee: 100,
				});
			}

			const results = await controller.listDeliveries({
				status: "pending",
				take: 3,
				skip: 1,
			});
			expect(results).toHaveLength(3);
		});
	});

	// ── createServiceArea ──────────────────────────────────────────────

	describe("createServiceArea", () => {
		it("creates a service area with all required fields", async () => {
			const area = await controller.createServiceArea({
				name: "Downtown Austin",
				zipCodes: ["78701", "78702", "78703"],
				deliveryFee: 599,
				estimatedMinutes: 30,
			});

			expect(area.id).toEqual(expect.any(String));
			expect(area.name).toBe("Downtown Austin");
			expect(area.isActive).toBe(true);
			expect(area.zipCodes).toEqual(["78701", "78702", "78703"]);
			expect(area.minOrderAmount).toBe(0);
			expect(area.deliveryFee).toBe(599);
			expect(area.estimatedMinutes).toBe(30);
			expect(area.createdAt).toBeInstanceOf(Date);
			expect(area.updatedAt).toBeInstanceOf(Date);
		});

		it("defaults isActive to true", async () => {
			const area = await controller.createServiceArea({
				name: "Test Area",
				zipCodes: ["10001"],
				deliveryFee: 400,
				estimatedMinutes: 20,
			});

			expect(area.isActive).toBe(true);
		});

		it("defaults minOrderAmount to 0 when not provided", async () => {
			const area = await controller.createServiceArea({
				name: "No Min Area",
				zipCodes: ["20001"],
				deliveryFee: 300,
				estimatedMinutes: 25,
			});

			expect(area.minOrderAmount).toBe(0);
		});

		it("uses provided minOrderAmount when given", async () => {
			const area = await controller.createServiceArea({
				name: "Min Order Area",
				zipCodes: ["30001"],
				minOrderAmount: 1500,
				deliveryFee: 500,
				estimatedMinutes: 35,
			});

			expect(area.minOrderAmount).toBe(1500);
		});

		it("persists the service area in the data store", async () => {
			const area = await controller.createServiceArea({
				name: "Persisted Area",
				zipCodes: ["40001"],
				deliveryFee: 600,
				estimatedMinutes: 40,
			});

			const areas = await controller.listServiceAreas();
			expect(areas).toHaveLength(1);
			expect(areas[0].name).toBe("Persisted Area");
			expect(areas[0].id).toBe(area.id);
		});
	});

	// ── updateServiceArea ──────────────────────────────────────────────

	describe("updateServiceArea", () => {
		it("updates the name of a service area", async () => {
			const area = await controller.createServiceArea({
				name: "Old Name",
				zipCodes: ["50001"],
				deliveryFee: 500,
				estimatedMinutes: 30,
			});

			const updated = defined(
				await controller.updateServiceArea(area.id, { name: "New Name" }),
				"updated area",
			);
			expect(updated.name).toBe("New Name");
		});

		it("updates isActive to false", async () => {
			const area = await controller.createServiceArea({
				name: "Active Area",
				zipCodes: ["50002"],
				deliveryFee: 500,
				estimatedMinutes: 30,
			});

			const updated = defined(
				await controller.updateServiceArea(area.id, { isActive: false }),
				"updated area",
			);
			expect(updated.isActive).toBe(false);
		});

		it("updates zipCodes", async () => {
			const area = await controller.createServiceArea({
				name: "Zip Area",
				zipCodes: ["60001"],
				deliveryFee: 500,
				estimatedMinutes: 30,
			});

			const updated = defined(
				await controller.updateServiceArea(area.id, {
					zipCodes: ["60001", "60002", "60003"],
				}),
				"updated area",
			);
			expect(updated.zipCodes).toEqual(["60001", "60002", "60003"]);
		});

		it("updates minOrderAmount", async () => {
			const area = await controller.createServiceArea({
				name: "Min Area",
				zipCodes: ["70001"],
				deliveryFee: 500,
				estimatedMinutes: 30,
			});

			const updated = defined(
				await controller.updateServiceArea(area.id, {
					minOrderAmount: 2000,
				}),
				"updated area",
			);
			expect(updated.minOrderAmount).toBe(2000);
		});

		it("updates deliveryFee and estimatedMinutes", async () => {
			const area = await controller.createServiceArea({
				name: "Fee Area",
				zipCodes: ["80001"],
				deliveryFee: 500,
				estimatedMinutes: 30,
			});

			const updated = defined(
				await controller.updateServiceArea(area.id, {
					deliveryFee: 799,
					estimatedMinutes: 45,
				}),
				"updated area",
			);
			expect(updated.deliveryFee).toBe(799);
			expect(updated.estimatedMinutes).toBe(45);
		});

		it("returns null when area does not exist", async () => {
			const result = await controller.updateServiceArea("nonexistent", {
				name: "Nope",
			});
			expect(result).toBeNull();
		});

		it("does not modify fields not included in params", async () => {
			const area = await controller.createServiceArea({
				name: "Original",
				zipCodes: ["90001"],
				minOrderAmount: 1000,
				deliveryFee: 500,
				estimatedMinutes: 30,
			});

			const updated = defined(
				await controller.updateServiceArea(area.id, { name: "Changed" }),
				"updated area",
			);
			expect(updated.name).toBe("Changed");
			expect(updated.zipCodes).toEqual(["90001"]);
			expect(updated.minOrderAmount).toBe(1000);
			expect(updated.deliveryFee).toBe(500);
			expect(updated.estimatedMinutes).toBe(30);
			expect(updated.isActive).toBe(true);
		});

		it("updates the updatedAt timestamp", async () => {
			const area = await controller.createServiceArea({
				name: "Timestamp Area",
				zipCodes: ["91001"],
				deliveryFee: 500,
				estimatedMinutes: 30,
			});

			const updated = defined(
				await controller.updateServiceArea(area.id, { name: "Updated" }),
				"updated area",
			);
			expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
				area.updatedAt.getTime(),
			);
		});
	});

	// ── deleteServiceArea ──────────────────────────────────────────────

	describe("deleteServiceArea", () => {
		it("deletes an existing service area and returns true", async () => {
			const area = await controller.createServiceArea({
				name: "To Delete",
				zipCodes: ["11001"],
				deliveryFee: 500,
				estimatedMinutes: 30,
			});

			const result = await controller.deleteServiceArea(area.id);
			expect(result).toBe(true);
		});

		it("returns false when area does not exist", async () => {
			const result = await controller.deleteServiceArea("nonexistent");
			expect(result).toBe(false);
		});

		it("removes the area from the data store", async () => {
			const area = await controller.createServiceArea({
				name: "Deleted Area",
				zipCodes: ["12001"],
				deliveryFee: 500,
				estimatedMinutes: 30,
			});

			await controller.deleteServiceArea(area.id);
			const areas = await controller.listServiceAreas();
			expect(areas).toHaveLength(0);
		});
	});

	// ── listServiceAreas ───────────────────────────────────────────────

	describe("listServiceAreas", () => {
		it("returns all service areas when no filters provided", async () => {
			await controller.createServiceArea({
				name: "Area 1",
				zipCodes: ["10001"],
				deliveryFee: 400,
				estimatedMinutes: 20,
			});
			await controller.createServiceArea({
				name: "Area 2",
				zipCodes: ["20001"],
				deliveryFee: 500,
				estimatedMinutes: 30,
			});

			const areas = await controller.listServiceAreas();
			expect(areas).toHaveLength(2);
		});

		it("returns empty array when no service areas exist", async () => {
			const areas = await controller.listServiceAreas();
			expect(areas).toEqual([]);
		});

		it("filters by isActive true", async () => {
			const a1 = await controller.createServiceArea({
				name: "Active",
				zipCodes: ["10001"],
				deliveryFee: 400,
				estimatedMinutes: 20,
			});
			const a2 = await controller.createServiceArea({
				name: "Inactive",
				zipCodes: ["20001"],
				deliveryFee: 500,
				estimatedMinutes: 30,
			});
			await controller.updateServiceArea(a2.id, { isActive: false });

			const activeAreas = await controller.listServiceAreas({
				isActive: true,
			});
			expect(activeAreas).toHaveLength(1);
			expect(activeAreas[0].id).toBe(a1.id);
		});

		it("filters by isActive false", async () => {
			await controller.createServiceArea({
				name: "Active",
				zipCodes: ["10001"],
				deliveryFee: 400,
				estimatedMinutes: 20,
			});
			const a2 = await controller.createServiceArea({
				name: "Inactive",
				zipCodes: ["20001"],
				deliveryFee: 500,
				estimatedMinutes: 30,
			});
			await controller.updateServiceArea(a2.id, { isActive: false });

			const inactiveAreas = await controller.listServiceAreas({
				isActive: false,
			});
			expect(inactiveAreas).toHaveLength(1);
			expect(inactiveAreas[0].name).toBe("Inactive");
		});

		it("supports take parameter", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createServiceArea({
					name: `Area ${i}`,
					zipCodes: [`${10000 + i}`],
					deliveryFee: 400,
					estimatedMinutes: 20,
				});
			}

			const areas = await controller.listServiceAreas({ take: 3 });
			expect(areas).toHaveLength(3);
		});

		it("supports skip parameter", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createServiceArea({
					name: `Area ${i}`,
					zipCodes: [`${10000 + i}`],
					deliveryFee: 400,
					estimatedMinutes: 20,
				});
			}

			const areas = await controller.listServiceAreas({ skip: 3 });
			expect(areas).toHaveLength(2);
		});
	});

	// ── checkAvailability ──────────────────────────────────────────────

	describe("checkAvailability", () => {
		it("returns available with matching area when zip code is covered", async () => {
			await controller.createServiceArea({
				name: "Downtown",
				zipCodes: ["78701", "78702", "78703"],
				deliveryFee: 599,
				estimatedMinutes: 30,
			});

			const result = await controller.checkAvailability("78702");
			expect(result.available).toBe(true);
			const area = defined(result.area, "matched service area");
			expect(area.name).toBe("Downtown");
		});

		it("returns not available when zip code is not covered", async () => {
			await controller.createServiceArea({
				name: "Downtown",
				zipCodes: ["78701", "78702"],
				deliveryFee: 599,
				estimatedMinutes: 30,
			});

			const result = await controller.checkAvailability("99999");
			expect(result.available).toBe(false);
			expect(result.area).toBeNull();
		});

		it("returns not available when no service areas exist", async () => {
			const result = await controller.checkAvailability("78701");
			expect(result.available).toBe(false);
			expect(result.area).toBeNull();
		});

		it("ignores inactive service areas", async () => {
			const area = await controller.createServiceArea({
				name: "Inactive Area",
				zipCodes: ["78704"],
				deliveryFee: 599,
				estimatedMinutes: 30,
			});
			await controller.updateServiceArea(area.id, { isActive: false });

			const result = await controller.checkAvailability("78704");
			expect(result.available).toBe(false);
			expect(result.area).toBeNull();
		});

		it("returns the first matching active area when multiple cover the zip", async () => {
			await controller.createServiceArea({
				name: "Area A",
				zipCodes: ["78701"],
				deliveryFee: 500,
				estimatedMinutes: 25,
			});
			await controller.createServiceArea({
				name: "Area B",
				zipCodes: ["78701"],
				deliveryFee: 600,
				estimatedMinutes: 35,
			});

			const result = await controller.checkAvailability("78701");
			expect(result.available).toBe(true);
			const area = defined(result.area, "matched area");
			expect(area.name).toBe("Area A");
		});
	});

	// ── getDeliveryStats ───────────────────────────────────────────────

	describe("getDeliveryStats", () => {
		it("returns all zeros when no deliveries exist", async () => {
			const stats = await controller.getDeliveryStats();
			expect(stats).toEqual({
				totalDeliveries: 0,
				totalPending: 0,
				totalAssigned: 0,
				totalEnRoute: 0,
				totalCompleted: 0,
				totalCancelled: 0,
				totalFees: 0,
				totalTips: 0,
			});
		});

		it("counts pending deliveries", async () => {
			await controller.createDelivery({
				orderId: "o1",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 500,
				tip: 100,
			});
			await controller.createDelivery({
				orderId: "o2",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 300,
			});

			const stats = await controller.getDeliveryStats();
			expect(stats.totalDeliveries).toBe(2);
			expect(stats.totalPending).toBe(2);
			expect(stats.totalFees).toBe(800);
			expect(stats.totalTips).toBe(100);
		});

		it("counts assigned deliveries", async () => {
			const d = await controller.createDelivery({
				orderId: "o1",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 400,
			});
			await controller.updateDeliveryStatus(d.id, "assigned");

			const stats = await controller.getDeliveryStats();
			expect(stats.totalAssigned).toBe(1);
		});

		it("counts en-route and arrived as totalEnRoute", async () => {
			const d1 = await controller.createDelivery({
				orderId: "o1",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 400,
			});
			const d2 = await controller.createDelivery({
				orderId: "o2",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 500,
			});
			await controller.updateDeliveryStatus(d1.id, "en-route");
			await controller.updateDeliveryStatus(d2.id, "arrived");

			const stats = await controller.getDeliveryStats();
			expect(stats.totalEnRoute).toBe(2);
		});

		it("counts completed deliveries", async () => {
			const d = await controller.createDelivery({
				orderId: "o1",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 600,
				tip: 200,
			});
			await controller.updateDeliveryStatus(d.id, "completed");

			const stats = await controller.getDeliveryStats();
			expect(stats.totalCompleted).toBe(1);
			expect(stats.totalFees).toBe(600);
			expect(stats.totalTips).toBe(200);
		});

		it("counts cancelled deliveries", async () => {
			const d = await controller.createDelivery({
				orderId: "o1",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 300,
			});
			await controller.cancelDelivery(d.id);

			const stats = await controller.getDeliveryStats();
			expect(stats.totalCancelled).toBe(1);
		});

		it("correctly aggregates mixed statuses", async () => {
			const d1 = await controller.createDelivery({
				orderId: "o1",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 100,
				tip: 50,
			});
			const d2 = await controller.createDelivery({
				orderId: "o2",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 200,
				tip: 75,
			});
			const d3 = await controller.createDelivery({
				orderId: "o3",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 300,
				tip: 100,
			});
			const d4 = await controller.createDelivery({
				orderId: "o4",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 400,
			});
			await controller.createDelivery({
				orderId: "o5",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 500,
				tip: 200,
			});

			await controller.updateDeliveryStatus(d1.id, "assigned");
			await controller.updateDeliveryStatus(d2.id, "en-route");
			await controller.updateDeliveryStatus(d3.id, "completed");
			await controller.cancelDelivery(d4.id);
			// d5 stays pending

			const stats = await controller.getDeliveryStats();
			expect(stats.totalDeliveries).toBe(5);
			expect(stats.totalPending).toBe(1);
			expect(stats.totalAssigned).toBe(1);
			expect(stats.totalEnRoute).toBe(1);
			expect(stats.totalCompleted).toBe(1);
			expect(stats.totalCancelled).toBe(1);
			expect(stats.totalFees).toBe(1500);
			expect(stats.totalTips).toBe(425);
		});
	});
});
