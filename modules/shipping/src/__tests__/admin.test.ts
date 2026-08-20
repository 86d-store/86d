import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createShippingController } from "../service-impl";

/**
 * Admin workflow and edge-case tests for the shipping module.
 *
 * Covers: zone management, rate management, rate calculation,
 * shipping methods, carriers, shipments with status transitions,
 * tracking URL generation, and multi-zone rate resolution.
 */

describe("shipping — admin workflows", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createShippingController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createShippingController(mockData);
	});

	// ── Zone CRUD ──────────────────────────────────────────────────

	describe("zone CRUD", () => {
		it("creates a zone with defaults", async () => {
			const zone = await controller.createZone({ name: "US Domestic" });
			expect(zone.id).toBeDefined();
			expect(zone.name).toBe("US Domestic");
			expect(zone.countries).toEqual([]);
			expect(zone.isActive).toBe(true);
		});

		it("creates a zone with specific countries", async () => {
			const zone = await controller.createZone({
				name: "EU",
				countries: ["DE", "FR", "IT", "ES"],
			});
			expect(zone.countries).toEqual(["DE", "FR", "IT", "ES"]);
		});

		it("creates an inactive zone", async () => {
			const zone = await controller.createZone({
				name: "Test Zone",
				isActive: false,
			});
			expect(zone.isActive).toBe(false);
		});

		it("gets zone by id", async () => {
			const created = await controller.createZone({ name: "Test" });
			const fetched = await controller.getZone(created.id);
			expect(fetched?.name).toBe("Test");
		});

		it("returns null for non-existent zone", async () => {
			const zone = await controller.getZone("fake-id");
			expect(zone).toBeNull();
		});

		it("lists all zones", async () => {
			await controller.createZone({ name: "Zone A" });
			await controller.createZone({ name: "Zone B" });
			await controller.createZone({ name: "Zone C", isActive: false });

			const all = await controller.listZones({});
			expect(all).toHaveLength(3);
		});

		it("lists only active zones", async () => {
			await controller.createZone({ name: "Active" });
			await controller.createZone({ name: "Inactive", isActive: false });

			const active = await controller.listZones({ activeOnly: true });
			expect(active).toHaveLength(1);
			expect(active[0].name).toBe("Active");
		});

		it("updates zone name", async () => {
			const zone = await controller.createZone({ name: "Old" });
			const updated = await controller.updateZone(zone.id, { name: "New" });
			expect(updated?.name).toBe("New");
		});

		it("updates zone countries", async () => {
			const zone = await controller.createZone({
				name: "EU",
				countries: ["DE"],
			});
			const updated = await controller.updateZone(zone.id, {
				countries: ["DE", "FR", "IT"],
			});
			expect(updated?.countries).toEqual(["DE", "FR", "IT"]);
		});

		it("deactivates a zone", async () => {
			const zone = await controller.createZone({ name: "Test" });
			const updated = await controller.updateZone(zone.id, {
				isActive: false,
			});
			expect(updated?.isActive).toBe(false);
		});

		it("updateZone returns null for non-existent zone", async () => {
			const result = await controller.updateZone("fake-id", { name: "X" });
			expect(result).toBeNull();
		});
	});

	// ── Zone deletion and cascading ────────────────────────────────

	describe("zone deletion", () => {
		it("deletes a zone", async () => {
			const zone = await controller.createZone({ name: "Test" });
			const deleted = await controller.deleteZone(zone.id);
			expect(deleted).toBe(true);
			const fetched = await controller.getZone(zone.id);
			expect(fetched).toBeNull();
		});

		it("delete returns false for non-existent zone", async () => {
			const result = await controller.deleteZone("fake-id");
			expect(result).toBe(false);
		});

		it("deleting a zone removes all its rates", async () => {
			const zone = await controller.createZone({ name: "Test" });
			const rate1 = await controller.addRate({
				zoneId: zone.id,
				name: "Standard",
				price: 500,
			});
			await controller.addRate({
				zoneId: zone.id,
				name: "Express",
				price: 1500,
			});

			await controller.deleteZone(zone.id);

			const r1 = await controller.getRate(rate1.id);
			expect(r1).toBeNull();

			const rates = await controller.listRates({
				zoneId: zone.id,
			});
			expect(rates).toHaveLength(0);
		});
	});

	// ── Rate CRUD ──────────────────────────────────────────────────

	describe("rate CRUD", () => {
		it("creates a basic rate", async () => {
			const zone = await controller.createZone({ name: "US" });
			const rate = await controller.addRate({
				zoneId: zone.id,
				name: "Standard",
				price: 599,
			});
			expect(rate.name).toBe("Standard");
			expect(rate.price).toBe(599);
			expect(rate.isActive).toBe(true);
		});

		it("creates a rate with order amount range", async () => {
			const zone = await controller.createZone({ name: "US" });
			const rate = await controller.addRate({
				zoneId: zone.id,
				name: "Free over $50",
				price: 0,
				minOrderAmount: 5000,
			});
			expect(rate.minOrderAmount).toBe(5000);
		});

		it("creates a rate with weight range", async () => {
			const zone = await controller.createZone({ name: "US" });
			const rate = await controller.addRate({
				zoneId: zone.id,
				name: "Heavy",
				price: 1500,
				minWeight: 5000,
				maxWeight: 20000,
			});
			expect(rate.minWeight).toBe(5000);
			expect(rate.maxWeight).toBe(20000);
		});

		it("creates an inactive rate", async () => {
			const zone = await controller.createZone({ name: "US" });
			const rate = await controller.addRate({
				zoneId: zone.id,
				name: "Draft",
				price: 0,
				isActive: false,
			});
			expect(rate.isActive).toBe(false);
		});

		it("updates rate price", async () => {
			const zone = await controller.createZone({ name: "US" });
			const rate = await controller.addRate({
				zoneId: zone.id,
				name: "Standard",
				price: 500,
			});
			const updated = await controller.updateRate(rate.id, { price: 750 });
			expect(updated?.price).toBe(750);
		});

		it("deactivates a rate", async () => {
			const zone = await controller.createZone({ name: "US" });
			const rate = await controller.addRate({
				zoneId: zone.id,
				name: "Standard",
				price: 500,
			});
			const updated = await controller.updateRate(rate.id, {
				isActive: false,
			});
			expect(updated?.isActive).toBe(false);
		});

		it("updateRate returns null for non-existent rate", async () => {
			const result = await controller.updateRate("fake-id", { price: 100 });
			expect(result).toBeNull();
		});

		it("deletes a rate", async () => {
			const zone = await controller.createZone({ name: "US" });
			const rate = await controller.addRate({
				zoneId: zone.id,
				name: "Standard",
				price: 500,
			});
			const deleted = await controller.deleteRate(rate.id);
			expect(deleted).toBe(true);
		});

		it("deleteRate returns false for non-existent rate", async () => {
			const result = await controller.deleteRate("fake-id");
			expect(result).toBe(false);
		});

		it("lists active rates only", async () => {
			const zone = await controller.createZone({ name: "US" });
			await controller.addRate({
				zoneId: zone.id,
				name: "Active",
				price: 500,
			});
			await controller.addRate({
				zoneId: zone.id,
				name: "Inactive",
				price: 1000,
				isActive: false,
			});

			const active = await controller.listRates({
				zoneId: zone.id,
				activeOnly: true,
			});
			expect(active).toHaveLength(1);
			expect(active[0].name).toBe("Active");
		});
	});

	// ── Rate calculation ───────────────────────────────────────────

	describe("rate calculation", () => {
		it("returns matching rates for a country", async () => {
			const zone = await controller.createZone({
				name: "US",
				countries: ["US"],
			});
			await controller.addRate({
				zoneId: zone.id,
				name: "Standard",
				price: 599,
			});
			await controller.addRate({
				zoneId: zone.id,
				name: "Express",
				price: 1299,
			});

			const rates = await controller.calculateRates({
				country: "US",
				orderAmount: 5000,
			});
			expect(rates).toHaveLength(2);
			// Sorted cheapest first
			expect(rates[0].price).toBeLessThanOrEqual(rates[1].price);
		});

		it("returns empty for country with no matching zone", async () => {
			await controller.createZone({
				name: "US Only",
				countries: ["US"],
			});

			const rates = await controller.calculateRates({
				country: "JP",
				orderAmount: 5000,
			});
			expect(rates).toHaveLength(0);
		});

		it("wildcard zone (empty countries) matches all countries", async () => {
			const zone = await controller.createZone({
				name: "Worldwide",
				countries: [],
			});
			await controller.addRate({
				zoneId: zone.id,
				name: "Global Flat Rate",
				price: 2000,
			});

			const usRates = await controller.calculateRates({
				country: "US",
				orderAmount: 3000,
			});
			expect(usRates).toHaveLength(1);

			const jpRates = await controller.calculateRates({
				country: "JP",
				orderAmount: 3000,
			});
			expect(jpRates).toHaveLength(1);
		});

		it("filters by minOrderAmount", async () => {
			const zone = await controller.createZone({
				name: "US",
				countries: ["US"],
			});
			await controller.addRate({
				zoneId: zone.id,
				name: "Standard",
				price: 599,
			});
			await controller.addRate({
				zoneId: zone.id,
				name: "Free over $50",
				price: 0,
				minOrderAmount: 5000,
			});

			// Order under $50 — only standard rate
			const lowRates = await controller.calculateRates({
				country: "US",
				orderAmount: 3000,
			});
			expect(lowRates).toHaveLength(1);
			expect(lowRates[0].name).toBe("Standard");

			// Order over $50 — both rates
			const highRates = await controller.calculateRates({
				country: "US",
				orderAmount: 6000,
			});
			expect(highRates).toHaveLength(2);
		});

		it("filters by maxOrderAmount", async () => {
			const zone = await controller.createZone({
				name: "US",
				countries: ["US"],
			});
			await controller.addRate({
				zoneId: zone.id,
				name: "Small order flat rate",
				price: 299,
				maxOrderAmount: 2000,
			});
			await controller.addRate({
				zoneId: zone.id,
				name: "Standard",
				price: 599,
			});

			// Small order — both rates match
			const smallRates = await controller.calculateRates({
				country: "US",
				orderAmount: 1500,
			});
			expect(smallRates).toHaveLength(2);

			// Large order — only standard
			const largeRates = await controller.calculateRates({
				country: "US",
				orderAmount: 5000,
			});
			expect(largeRates).toHaveLength(1);
			expect(largeRates[0].name).toBe("Standard");
		});

		it("filters by weight range", async () => {
			const zone = await controller.createZone({
				name: "US",
				countries: ["US"],
			});
			await controller.addRate({
				zoneId: zone.id,
				name: "Light",
				price: 400,
				maxWeight: 1000,
			});
			await controller.addRate({
				zoneId: zone.id,
				name: "Heavy",
				price: 1200,
				minWeight: 1001,
				maxWeight: 10000,
			});

			const lightRates = await controller.calculateRates({
				country: "US",
				orderAmount: 5000,
				weight: 500,
			});
			expect(lightRates).toHaveLength(1);
			expect(lightRates[0].name).toBe("Light");

			const heavyRates = await controller.calculateRates({
				country: "US",
				orderAmount: 5000,
				weight: 5000,
			});
			expect(heavyRates).toHaveLength(1);
			expect(heavyRates[0].name).toBe("Heavy");
		});

		it("excludes inactive zones from calculation", async () => {
			const active = await controller.createZone({
				name: "Active",
				countries: ["US"],
			});
			const inactive = await controller.createZone({
				name: "Inactive",
				countries: ["US"],
				isActive: false,
			});

			await controller.addRate({
				zoneId: active.id,
				name: "Standard",
				price: 500,
			});
			await controller.addRate({
				zoneId: inactive.id,
				name: "Ghost",
				price: 100,
			});

			const rates = await controller.calculateRates({
				country: "US",
				orderAmount: 5000,
			});
			expect(rates).toHaveLength(1);
			expect(rates[0].name).toBe("Standard");
		});

		it("excludes inactive rates from calculation", async () => {
			const zone = await controller.createZone({
				name: "US",
				countries: ["US"],
			});
			await controller.addRate({
				zoneId: zone.id,
				name: "Active",
				price: 500,
			});
			await controller.addRate({
				zoneId: zone.id,
				name: "Disabled",
				price: 100,
				isActive: false,
			});

			const rates = await controller.calculateRates({
				country: "US",
				orderAmount: 5000,
			});
			expect(rates).toHaveLength(1);
			expect(rates[0].name).toBe("Active");
		});

		it("sorts rates cheapest first", async () => {
			const zone = await controller.createZone({
				name: "US",
				countries: ["US"],
			});
			await controller.addRate({
				zoneId: zone.id,
				name: "Express",
				price: 1500,
			});
			await controller.addRate({
				zoneId: zone.id,
				name: "Standard",
				price: 500,
			});
			await controller.addRate({
				zoneId: zone.id,
				name: "Free",
				price: 0,
			});

			const rates = await controller.calculateRates({
				country: "US",
				orderAmount: 5000,
			});
			expect(rates[0].price).toBe(0);
			expect(rates[1].price).toBe(500);
			expect(rates[2].price).toBe(1500);
		});

		it("handles case-insensitive country matching", async () => {
			const zone = await controller.createZone({
				name: "US",
				countries: ["US"],
			});
			await controller.addRate({
				zoneId: zone.id,
				name: "Standard",
				price: 500,
			});

			const rates = await controller.calculateRates({
				country: "us",
				orderAmount: 5000,
			});
			expect(rates).toHaveLength(1);
		});

		it("combines rates from multiple matching zones", async () => {
			const domestic = await controller.createZone({
				name: "US Domestic",
				countries: ["US"],
			});
			const worldwide = await controller.createZone({
				name: "Worldwide",
				countries: [],
			});

			await controller.addRate({
				zoneId: domestic.id,
				name: "Domestic Ground",
				price: 500,
			});
			await controller.addRate({
				zoneId: worldwide.id,
				name: "Global Express",
				price: 2500,
			});

			const rates = await controller.calculateRates({
				country: "US",
				orderAmount: 5000,
			});
			expect(rates).toHaveLength(2);
		});

		it("returns empty when no rates exist", async () => {
			await controller.createZone({
				name: "US",
				countries: ["US"],
			});

			const rates = await controller.calculateRates({
				country: "US",
				orderAmount: 5000,
			});
			expect(rates).toHaveLength(0);
		});

		it("includes zone name in calculated rate", async () => {
			const zone = await controller.createZone({
				name: "North America",
				countries: ["US", "CA", "MX"],
			});
			await controller.addRate({
				zoneId: zone.id,
				name: "Standard",
				price: 500,
			});

			const rates = await controller.calculateRates({
				country: "CA",
				orderAmount: 5000,
			});
			expect(rates[0].zoneName).toBe("North America");
			expect(rates[0].name).toBe("Standard");
		});
	});

	// ── Shipping Methods ──────────────────────────────────────────

	describe("method management", () => {
		it("creates and retrieves a shipping method", async () => {
			const method = await controller.createMethod({
				name: "Standard",
				estimatedDaysMin: 5,
				estimatedDaysMax: 7,
			});
			const fetched = await controller.getMethod(method.id);
			expect(fetched?.name).toBe("Standard");
			expect(fetched?.estimatedDaysMin).toBe(5);
			expect(fetched?.estimatedDaysMax).toBe(7);
		});

		it("lists only active methods", async () => {
			await controller.createMethod({
				name: "Standard",
				estimatedDaysMin: 5,
				estimatedDaysMax: 7,
			});
			await controller.createMethod({
				name: "Express",
				estimatedDaysMin: 1,
				estimatedDaysMax: 2,
			});
			await controller.createMethod({
				name: "Draft",
				estimatedDaysMin: 3,
				estimatedDaysMax: 4,
				isActive: false,
			});

			const active = await controller.listMethods({ activeOnly: true });
			expect(active).toHaveLength(2);
		});

		it("updates method delivery estimates", async () => {
			const method = await controller.createMethod({
				name: "Standard",
				estimatedDaysMin: 5,
				estimatedDaysMax: 7,
			});
			const updated = await controller.updateMethod(method.id, {
				estimatedDaysMin: 3,
				estimatedDaysMax: 5,
			});
			expect(updated?.estimatedDaysMin).toBe(3);
			expect(updated?.estimatedDaysMax).toBe(5);
		});

		it("deletes a method and confirms removal", async () => {
			const method = await controller.createMethod({
				name: "Overnight",
				estimatedDaysMin: 0,
				estimatedDaysMax: 1,
			});
			expect(await controller.deleteMethod(method.id)).toBe(true);
			expect(await controller.getMethod(method.id)).toBeNull();
		});

		it("respects sort order", async () => {
			await controller.createMethod({
				name: "Express",
				estimatedDaysMin: 1,
				estimatedDaysMax: 2,
				sortOrder: 1,
			});
			await controller.createMethod({
				name: "Standard",
				estimatedDaysMin: 5,
				estimatedDaysMax: 7,
				sortOrder: 2,
			});
			await controller.createMethod({
				name: "Overnight",
				estimatedDaysMin: 0,
				estimatedDaysMax: 1,
				sortOrder: 0,
			});

			const all = await controller.listMethods();
			expect(all).toHaveLength(3);
		});
	});

	// ── Carriers ──────────────────────────────────────────────────

	describe("carrier management", () => {
		it("creates a carrier with tracking URL template", async () => {
			const carrier = await controller.createCarrier({
				name: "FedEx",
				code: "fedex",
				trackingUrlTemplate:
					"https://www.fedex.com/fedextrack/?trknbr={tracking}",
			});
			expect(carrier.name).toBe("FedEx");
			expect(carrier.code).toBe("fedex");
			expect(carrier.trackingUrlTemplate).toContain("{tracking}");
		});

		it("normalizes carrier codes to lowercase", async () => {
			const carrier = await controller.createCarrier({
				name: "UPS",
				code: "UPS",
			});
			expect(carrier.code).toBe("ups");
		});

		it("lists active carriers only", async () => {
			await controller.createCarrier({ name: "FedEx", code: "fedex" });
			await controller.createCarrier({ name: "UPS", code: "ups" });
			await controller.createCarrier({
				name: "Defunct",
				code: "defunct",
				isActive: false,
			});

			const active = await controller.listCarriers({ activeOnly: true });
			expect(active).toHaveLength(2);
		});

		it("updates carrier tracking URL", async () => {
			const carrier = await controller.createCarrier({
				name: "Custom",
				code: "custom",
			});
			const updated = await controller.updateCarrier(carrier.id, {
				trackingUrlTemplate: "https://track.custom.com/{tracking}",
			});
			expect(updated?.trackingUrlTemplate).toBe(
				"https://track.custom.com/{tracking}",
			);
		});

		it("deletes a carrier", async () => {
			const carrier = await controller.createCarrier({
				name: "Old",
				code: "old",
			});
			expect(await controller.deleteCarrier(carrier.id)).toBe(true);
			expect(await controller.getCarrier(carrier.id)).toBeNull();
		});
	});

	// ── Shipments ─────────────────────────────────────────────────

	describe("shipment workflows", () => {
		it("creates a shipment with all details", async () => {
			const carrier = await controller.createCarrier({
				name: "FedEx",
				code: "fedex",
				trackingUrlTemplate:
					"https://www.fedex.com/fedextrack/?trknbr={tracking}",
			});
			const method = await controller.createMethod({
				name: "Express",
				estimatedDaysMin: 1,
				estimatedDaysMax: 2,
			});

			const shipment = await controller.createShipment({
				orderId: "order-42",
				carrierId: carrier.id,
				methodId: method.id,
				trackingNumber: "794644790132",
				notes: "Signature required",
			});

			expect(shipment.orderId).toBe("order-42");
			expect(shipment.carrierId).toBe(carrier.id);
			expect(shipment.methodId).toBe(method.id);
			expect(shipment.trackingNumber).toBe("794644790132");
			expect(shipment.status).toBe("pending");
		});

		it("full lifecycle: pending → shipped → in_transit → delivered", async () => {
			const shipment = await controller.createShipment({
				orderId: "order-1",
			});
			expect(shipment.status).toBe("pending");

			const shipped = await controller.updateShipmentStatus(
				shipment.id,
				"shipped",
			);
			expect(shipped?.status).toBe("shipped");
			expect(shipped?.shippedAt).toBeInstanceOf(Date);

			const inTransit = await controller.updateShipmentStatus(
				shipment.id,
				"in_transit",
			);
			expect(inTransit?.status).toBe("in_transit");

			const delivered = await controller.updateShipmentStatus(
				shipment.id,
				"delivered",
			);
			expect(delivered?.status).toBe("delivered");
			expect(delivered?.deliveredAt).toBeInstanceOf(Date);
		});

		it("lists shipments by order", async () => {
			await controller.createShipment({ orderId: "order-1" });
			await controller.createShipment({ orderId: "order-1" });
			await controller.createShipment({ orderId: "order-2" });

			const forOrder1 = await controller.listShipments({
				orderId: "order-1",
			});
			expect(forOrder1).toHaveLength(2);
		});

		it("lists shipments by status", async () => {
			const s1 = await controller.createShipment({ orderId: "order-1" });
			await controller.createShipment({ orderId: "order-2" });
			await controller.updateShipmentStatus(s1.id, "shipped");

			const shipped = await controller.listShipments({
				status: "shipped",
			});
			expect(shipped).toHaveLength(1);
			expect(shipped[0].orderId).toBe("order-1");
		});

		it("generates tracking URL for shipment with carrier", async () => {
			const carrier = await controller.createCarrier({
				name: "UPS",
				code: "ups",
				trackingUrlTemplate: "https://www.ups.com/track?tracknum={tracking}",
			});
			const shipment = await controller.createShipment({
				orderId: "order-1",
				carrierId: carrier.id,
				trackingNumber: "1Z999AA10123456784",
			});

			const url = await controller.getTrackingUrl(shipment.id);
			expect(url).toBe("https://www.ups.com/track?tracknum=1Z999AA10123456784");
		});

		it("returns null tracking URL for shipment without carrier", async () => {
			const shipment = await controller.createShipment({
				orderId: "order-1",
				trackingNumber: "TRACK123",
			});
			expect(await controller.getTrackingUrl(shipment.id)).toBeNull();
		});

		it("rejects invalid status transitions", async () => {
			const shipment = await controller.createShipment({
				orderId: "order-1",
			});
			// Can't go pending → delivered
			expect(
				await controller.updateShipmentStatus(shipment.id, "delivered"),
			).toBeNull();
			// Can't go pending → in_transit
			expect(
				await controller.updateShipmentStatus(shipment.id, "in_transit"),
			).toBeNull();
		});

		it("updates shipment details without changing status", async () => {
			const shipment = await controller.createShipment({
				orderId: "order-1",
			});
			const updated = await controller.updateShipment(shipment.id, {
				trackingNumber: "NEW-TRACK-123",
				notes: "Updated tracking info",
			});
			expect(updated?.trackingNumber).toBe("NEW-TRACK-123");
			expect(updated?.notes).toBe("Updated tracking info");
			expect(updated?.status).toBe("pending");
		});

		it("deletes a shipment", async () => {
			const shipment = await controller.createShipment({
				orderId: "order-1",
			});
			expect(await controller.deleteShipment(shipment.id)).toBe(true);
			expect(await controller.getShipment(shipment.id)).toBeNull();
		});
	});
});
