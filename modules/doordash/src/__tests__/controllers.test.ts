import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createDoordashController } from "../service-impl";

describe("doordash controller", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createDoordashController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createDoordashController(mockData);
	});

	// ── Delivery CRUD ────────────────────────────────────────────────

	describe("delivery creation", () => {
		it("creates a delivery with pending status", async () => {
			const delivery = await controller.createDelivery({
				orderId: "order-1",
				pickupAddress: { street: "123 Main St" },
				dropoffAddress: { street: "456 Oak Ave" },
				fee: 5.99,
			});
			expect(delivery.id).toBeDefined();
			expect(delivery.status).toBe("pending");
			expect(delivery.orderId).toBe("order-1");
			expect(delivery.fee).toBe(5.99);
			expect(delivery.tip).toBe(0);
		});

		it("creates a delivery with custom tip", async () => {
			const delivery = await controller.createDelivery({
				orderId: "order-2",
				pickupAddress: { street: "123 Main St" },
				dropoffAddress: { street: "456 Oak Ave" },
				fee: 5.99,
				tip: 3.0,
			});
			expect(delivery.tip).toBe(3.0);
		});

		it("creates a delivery with metadata", async () => {
			const delivery = await controller.createDelivery({
				orderId: "order-3",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 4.99,
				metadata: { priority: "high" },
			});
			expect(delivery.metadata).toEqual({ priority: "high" });
		});

		it("sets createdAt and updatedAt timestamps", async () => {
			const before = new Date();
			const delivery = await controller.createDelivery({
				orderId: "order-4",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 5.0,
			});
			const after = new Date();
			expect(delivery.createdAt.getTime()).toBeGreaterThanOrEqual(
				before.getTime(),
			);
			expect(delivery.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
		});
	});

	describe("get delivery", () => {
		it("retrieves an existing delivery", async () => {
			const created = await controller.createDelivery({
				orderId: "order-5",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 5.0,
			});
			const found = await controller.getDelivery(created.id);
			expect(found).not.toBeNull();
			expect(found?.orderId).toBe("order-5");
		});

		it("returns null for non-existent delivery", async () => {
			const result = await controller.getDelivery("non-existent");
			expect(result).toBeNull();
		});
	});

	// ── Delivery status transitions ──────────────────────────────────

	describe("delivery status transitions", () => {
		it("transitions from pending to accepted", async () => {
			const delivery = await controller.createDelivery({
				orderId: "order-6",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 5.0,
			});
			const updated = await controller.updateDeliveryStatus(
				delivery.id,
				"accepted",
			);
			expect(updated?.status).toBe("accepted");
		});

		it("transitions from accepted to picked-up and sets actualPickupTime", async () => {
			const delivery = await controller.createDelivery({
				orderId: "order-7",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 5.0,
			});
			await controller.updateDeliveryStatus(delivery.id, "accepted");
			const pickedUp = await controller.updateDeliveryStatus(
				delivery.id,
				"picked-up",
			);
			expect(pickedUp?.status).toBe("picked-up");
			expect(pickedUp?.actualPickupTime).toBeInstanceOf(Date);
		});

		it("transitions to delivered and sets actualDeliveryTime", async () => {
			const delivery = await controller.createDelivery({
				orderId: "order-8",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 5.0,
			});
			await controller.updateDeliveryStatus(delivery.id, "accepted");
			await controller.updateDeliveryStatus(delivery.id, "picked-up");
			const delivered = await controller.updateDeliveryStatus(
				delivery.id,
				"delivered",
			);
			expect(delivered?.status).toBe("delivered");
			expect(delivered?.actualDeliveryTime).toBeInstanceOf(Date);
		});

		it("cannot update status of delivered delivery", async () => {
			const delivery = await controller.createDelivery({
				orderId: "order-9",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 5.0,
			});
			await controller.updateDeliveryStatus(delivery.id, "delivered");
			const result = await controller.updateDeliveryStatus(
				delivery.id,
				"cancelled",
			);
			expect(result).toBeNull();
		});

		it("cannot update status of cancelled delivery", async () => {
			const delivery = await controller.createDelivery({
				orderId: "order-10",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 5.0,
			});
			await controller.cancelDelivery(delivery.id);
			const result = await controller.updateDeliveryStatus(
				delivery.id,
				"accepted",
			);
			expect(result).toBeNull();
		});

		it("returns null when updating non-existent delivery", async () => {
			const result = await controller.updateDeliveryStatus(
				"non-existent",
				"accepted",
			);
			expect(result).toBeNull();
		});
	});

	// ── Cancel delivery ──────────────────────────────────────────────

	describe("cancel delivery", () => {
		it("cancels a pending delivery", async () => {
			const delivery = await controller.createDelivery({
				orderId: "order-11",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 5.0,
			});
			const cancelled = await controller.cancelDelivery(delivery.id);
			expect(cancelled?.status).toBe("cancelled");
		});

		it("cancels an accepted delivery", async () => {
			const delivery = await controller.createDelivery({
				orderId: "order-12",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 5.0,
			});
			await controller.updateDeliveryStatus(delivery.id, "accepted");
			const cancelled = await controller.cancelDelivery(delivery.id);
			expect(cancelled?.status).toBe("cancelled");
		});

		it("cannot cancel a delivered delivery", async () => {
			const delivery = await controller.createDelivery({
				orderId: "order-13",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 5.0,
			});
			await controller.updateDeliveryStatus(delivery.id, "delivered");
			const result = await controller.cancelDelivery(delivery.id);
			expect(result).toBeNull();
		});

		it("cannot cancel an already cancelled delivery", async () => {
			const delivery = await controller.createDelivery({
				orderId: "order-14",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 5.0,
			});
			await controller.cancelDelivery(delivery.id);
			const result = await controller.cancelDelivery(delivery.id);
			expect(result).toBeNull();
		});

		it("returns null when cancelling non-existent delivery", async () => {
			const result = await controller.cancelDelivery("non-existent");
			expect(result).toBeNull();
		});
	});

	// ── List deliveries ──────────────────────────────────────────────

	describe("list deliveries", () => {
		it("lists all deliveries", async () => {
			await controller.createDelivery({
				orderId: "o-1",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 5.0,
			});
			await controller.createDelivery({
				orderId: "o-2",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 6.0,
			});
			const all = await controller.listDeliveries();
			expect(all).toHaveLength(2);
		});

		it("filters by status", async () => {
			const d1 = await controller.createDelivery({
				orderId: "o-3",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 5.0,
			});
			await controller.createDelivery({
				orderId: "o-4",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 6.0,
			});
			await controller.cancelDelivery(d1.id);

			const cancelled = await controller.listDeliveries({
				status: "cancelled",
			});
			expect(cancelled).toHaveLength(1);
			expect(cancelled[0].orderId).toBe("o-3");
		});

		it("supports pagination with take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createDelivery({
					orderId: `o-${i}`,
					pickupAddress: {},
					dropoffAddress: {},
					fee: 5.0,
				});
			}
			const page = await controller.listDeliveries({ take: 2 });
			expect(page).toHaveLength(2);
		});

		it("returns empty array when skip exceeds total", async () => {
			await controller.createDelivery({
				orderId: "o-only",
				pickupAddress: {},
				dropoffAddress: {},
				fee: 5.0,
			});
			const result = await controller.listDeliveries({ skip: 100 });
			expect(result).toEqual([]);
		});
	});

	// ── Quote operations without credentials ────────────────────────

	describe("quote operations without credentials", () => {
		it("requestQuote throws when no credentials are configured", async () => {
			await expect(
				controller.requestQuote({
					pickupAddress: "123 Main St",
					pickupBusinessName: "Store",
					pickupPhoneNumber: "+10000000000",
					dropoffAddress: "456 Oak Ave",
					dropoffBusinessName: "Customer",
					dropoffPhoneNumber: "+10000000000",
					orderValue: 2500,
				}),
			).rejects.toThrow("DoorDash API credentials are not configured");
		});

		it("acceptQuote throws when no credentials are configured", async () => {
			await expect(controller.acceptQuote("some-quote-id")).rejects.toThrow(
				"DoorDash API credentials are not configured",
			);
		});
	});

	// ── Delivery zone CRUD ───────────────────────────────────────────

	describe("zone creation", () => {
		it("creates a zone with default active status", async () => {
			const zone = await controller.createZone({
				name: "Downtown",
				radius: 5,
				centerLat: 40.7128,
				centerLng: -74.006,
				deliveryFee: 4.99,
				estimatedMinutes: 30,
			});
			expect(zone.id).toBeDefined();
			expect(zone.name).toBe("Downtown");
			expect(zone.isActive).toBe(true);
			expect(zone.minOrderAmount).toBe(0);
		});

		it("creates a zone with custom min order amount", async () => {
			const zone = await controller.createZone({
				name: "Suburbs",
				radius: 10,
				centerLat: 40.7,
				centerLng: -74.0,
				minOrderAmount: 15,
				deliveryFee: 7.99,
				estimatedMinutes: 45,
			});
			expect(zone.minOrderAmount).toBe(15);
		});
	});

	describe("zone update", () => {
		it("updates zone name", async () => {
			const zone = await controller.createZone({
				name: "Old Name",
				radius: 5,
				centerLat: 40.7,
				centerLng: -74.0,
				deliveryFee: 4.99,
				estimatedMinutes: 30,
			});
			const updated = await controller.updateZone(zone.id, {
				name: "New Name",
			});
			expect(updated?.name).toBe("New Name");
			expect(updated?.radius).toBe(5);
		});

		it("deactivates a zone", async () => {
			const zone = await controller.createZone({
				name: "Temp Zone",
				radius: 5,
				centerLat: 40.7,
				centerLng: -74.0,
				deliveryFee: 4.99,
				estimatedMinutes: 30,
			});
			const updated = await controller.updateZone(zone.id, {
				isActive: false,
			});
			expect(updated?.isActive).toBe(false);
		});

		it("returns null for non-existent zone", async () => {
			const result = await controller.updateZone("non-existent", {
				name: "Nope",
			});
			expect(result).toBeNull();
		});
	});

	describe("zone deletion", () => {
		it("deletes an existing zone", async () => {
			const zone = await controller.createZone({
				name: "Delete Me",
				radius: 5,
				centerLat: 40.7,
				centerLng: -74.0,
				deliveryFee: 4.99,
				estimatedMinutes: 30,
			});
			const result = await controller.deleteZone(zone.id);
			expect(result).toBe(true);
		});

		it("returns false for non-existent zone", async () => {
			const result = await controller.deleteZone("non-existent");
			expect(result).toBe(false);
		});

		it("double deletion returns false", async () => {
			const zone = await controller.createZone({
				name: "Once",
				radius: 5,
				centerLat: 40.7,
				centerLng: -74.0,
				deliveryFee: 4.99,
				estimatedMinutes: 30,
			});
			await controller.deleteZone(zone.id);
			const result = await controller.deleteZone(zone.id);
			expect(result).toBe(false);
		});
	});

	describe("list zones", () => {
		it("lists all zones", async () => {
			await controller.createZone({
				name: "Z1",
				radius: 5,
				centerLat: 40.7,
				centerLng: -74.0,
				deliveryFee: 4.99,
				estimatedMinutes: 30,
			});
			await controller.createZone({
				name: "Z2",
				radius: 10,
				centerLat: 40.8,
				centerLng: -74.1,
				deliveryFee: 7.99,
				estimatedMinutes: 45,
			});
			const zones = await controller.listZones();
			expect(zones).toHaveLength(2);
		});

		it("filters by active status", async () => {
			const zone = await controller.createZone({
				name: "Active",
				radius: 5,
				centerLat: 40.7,
				centerLng: -74.0,
				deliveryFee: 4.99,
				estimatedMinutes: 30,
			});
			await controller.createZone({
				name: "Inactive",
				radius: 10,
				centerLat: 40.8,
				centerLng: -74.1,
				deliveryFee: 7.99,
				estimatedMinutes: 45,
			});
			await controller.updateZone(zone.id, { isActive: false });

			const active = await controller.listZones({ isActive: true });
			expect(active).toHaveLength(1);
			expect(active[0].name).toBe("Inactive");
		});
	});

	// ── Delivery availability ────────────────────────────────────────

	describe("delivery availability", () => {
		it("returns available when address is within zone radius", async () => {
			await controller.createZone({
				name: "NYC",
				radius: 5,
				centerLat: 40.7128,
				centerLng: -74.006,
				deliveryFee: 4.99,
				estimatedMinutes: 30,
			});
			const result = await controller.checkDeliveryAvailability({
				lat: 40.72,
				lng: -74.0,
			});
			expect(result.available).toBe(true);
			expect(result.zone).toBeDefined();
			expect(result.deliveryFee).toBe(4.99);
			expect(result.estimatedMinutes).toBe(30);
		});

		it("returns unavailable when address is outside all zones", async () => {
			await controller.createZone({
				name: "NYC",
				radius: 1,
				centerLat: 40.7128,
				centerLng: -74.006,
				deliveryFee: 4.99,
				estimatedMinutes: 30,
			});
			const result = await controller.checkDeliveryAvailability({
				lat: 34.0522,
				lng: -118.2437,
			});
			expect(result.available).toBe(false);
			expect(result.zone).toBeUndefined();
		});

		it("ignores inactive zones", async () => {
			const zone = await controller.createZone({
				name: "Disabled",
				radius: 100,
				centerLat: 40.7128,
				centerLng: -74.006,
				deliveryFee: 4.99,
				estimatedMinutes: 30,
			});
			await controller.updateZone(zone.id, { isActive: false });

			const result = await controller.checkDeliveryAvailability({
				lat: 40.72,
				lng: -74.0,
			});
			expect(result.available).toBe(false);
		});

		it("returns unavailable when no zones exist", async () => {
			const result = await controller.checkDeliveryAvailability({
				lat: 40.72,
				lng: -74.0,
			});
			expect(result.available).toBe(false);
		});
	});
});
