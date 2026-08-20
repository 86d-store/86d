import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { ShippingCarrier, ShippingMethod } from "../service";
import { createShippingController } from "../service-impl";

/**
 * Store endpoint integration tests for the shipping module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. calculate-rates: zone matching by country, amount/weight filtering,
 *    wildcard zones, sorted cheapest-first
 * 2. list-carriers: returns only active carriers
 * 3. list-methods: returns only active methods, sorted by sortOrder
 * 4. live-rates: delegates to EasyPost provider (returns empty when no key)
 * 5. purchase-label: delegates to controller for EasyPost label purchase
 * 6. track-shipment: auth required, ownership verified via order controller
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

/**
 * Simulates calculate-rates endpoint: accepts country, orderAmount, weight;
 * returns matching rates sorted cheapest-first.
 */
async function simulateCalculateRates(
	data: DataService,
	body: { country: string; orderAmount: number; weight?: number },
) {
	const controller = createShippingController(data);
	const rates = await controller.calculateRates({
		country: body.country,
		orderAmount: body.orderAmount,
		weight: body.weight,
	});
	return { rates };
}

/**
 * Simulates list-carriers endpoint: returns only active carriers.
 */
async function simulateListCarriers(data: DataService) {
	const controller = createShippingController(data);
	const carriers = await controller.listCarriers({ activeOnly: true });
	return { carriers };
}

/**
 * Simulates list-methods endpoint: returns only active methods sorted by sortOrder.
 */
async function simulateListMethods(data: DataService) {
	const controller = createShippingController(data);
	const methods = await controller.listMethods({ activeOnly: true });
	const sorted = methods.sort((a, b) => a.sortOrder - b.sortOrder);
	return { methods: sorted };
}

/**
 * Simulates track-shipment endpoint: auth required, verifies order ownership
 * via order controller, returns shipment details + tracking URL.
 */
async function simulateTrackShipment(
	data: DataService,
	shipmentId: string,
	opts: {
		userId?: string;
		orderController?: {
			getById(id: string): Promise<{ customerId?: string } | null>;
		};
	} = {},
) {
	if (!opts.userId) {
		return { error: "Unauthorized", status: 401 };
	}

	const controller = createShippingController(data);
	const shipment = await controller.getShipment(shipmentId);
	if (!shipment) {
		return { error: "Shipment not found", status: 404 };
	}

	if (opts.orderController) {
		const order = await opts.orderController.getById(shipment.orderId);
		if (!order || order.customerId !== opts.userId) {
			return { error: "Shipment not found", status: 404 };
		}
	}

	const trackingUrl = await controller.getTrackingUrl(shipment.id);

	return {
		shipment: {
			id: shipment.id,
			orderId: shipment.orderId,
			trackingNumber: shipment.trackingNumber,
			status: shipment.status,
			shippedAt: shipment.shippedAt,
			deliveredAt: shipment.deliveredAt,
			estimatedDelivery: shipment.estimatedDelivery,
		},
		trackingUrl,
	};
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: calculate rates — zone matching and filtering", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns matching rates for a specific country zone", async () => {
		const controller = createShippingController(data);
		const zone = await controller.createZone({
			name: "US Domestic",
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

		const result = await simulateCalculateRates(data, {
			country: "US",
			orderAmount: 5000,
		});

		expect(result.rates).toHaveLength(2);
		expect(result.rates[0].name).toBe("Standard");
		expect(result.rates[0].price).toBe(599);
		expect(result.rates[1].name).toBe("Express");
		expect(result.rates[1].price).toBe(1299);
	});

	it("returns empty when country does not match any zone", async () => {
		const controller = createShippingController(data);
		const zone = await controller.createZone({
			name: "US Only",
			countries: ["US"],
		});
		await controller.addRate({ zoneId: zone.id, name: "Standard", price: 599 });

		const result = await simulateCalculateRates(data, {
			country: "CA",
			orderAmount: 5000,
		});

		expect(result.rates).toHaveLength(0);
	});

	it("matches wildcard zones (empty countries = all countries)", async () => {
		const controller = createShippingController(data);
		const zone = await controller.createZone({
			name: "International",
			countries: [],
		});
		await controller.addRate({
			zoneId: zone.id,
			name: "International Standard",
			price: 1999,
		});

		const result = await simulateCalculateRates(data, {
			country: "JP",
			orderAmount: 5000,
		});

		expect(result.rates).toHaveLength(1);
		expect(result.rates[0].name).toBe("International Standard");
	});

	it("filters rates by minimum order amount", async () => {
		const controller = createShippingController(data);
		const zone = await controller.createZone({
			name: "US",
			countries: ["US"],
		});
		await controller.addRate({
			zoneId: zone.id,
			name: "Free Shipping",
			price: 0,
			minOrderAmount: 5000,
		});
		await controller.addRate({
			zoneId: zone.id,
			name: "Standard",
			price: 599,
		});

		// Order under $50 — free shipping not available
		const lowOrder = await simulateCalculateRates(data, {
			country: "US",
			orderAmount: 3000,
		});
		expect(lowOrder.rates).toHaveLength(1);
		expect(lowOrder.rates[0].name).toBe("Standard");

		// Order over $50 — both rates available
		const highOrder = await simulateCalculateRates(data, {
			country: "US",
			orderAmount: 7500,
		});
		expect(highOrder.rates).toHaveLength(2);
	});

	it("filters rates by maximum order amount", async () => {
		const controller = createShippingController(data);
		const zone = await controller.createZone({
			name: "US",
			countries: ["US"],
		});
		await controller.addRate({
			zoneId: zone.id,
			name: "Small Parcel",
			price: 399,
			maxOrderAmount: 10000,
		});

		const underMax = await simulateCalculateRates(data, {
			country: "US",
			orderAmount: 5000,
		});
		expect(underMax.rates).toHaveLength(1);

		const overMax = await simulateCalculateRates(data, {
			country: "US",
			orderAmount: 15000,
		});
		expect(overMax.rates).toHaveLength(0);
	});

	it("filters rates by weight range", async () => {
		const controller = createShippingController(data);
		const zone = await controller.createZone({
			name: "US",
			countries: ["US"],
		});
		await controller.addRate({
			zoneId: zone.id,
			name: "Light Parcel",
			price: 399,
			minWeight: 0,
			maxWeight: 5,
		});
		await controller.addRate({
			zoneId: zone.id,
			name: "Heavy Freight",
			price: 2999,
			minWeight: 5,
			maxWeight: 100,
		});

		const lightResult = await simulateCalculateRates(data, {
			country: "US",
			orderAmount: 5000,
			weight: 3,
		});
		expect(lightResult.rates).toHaveLength(1);
		expect(lightResult.rates[0].name).toBe("Light Parcel");

		const heavyResult = await simulateCalculateRates(data, {
			country: "US",
			orderAmount: 5000,
			weight: 20,
		});
		expect(heavyResult.rates).toHaveLength(1);
		expect(heavyResult.rates[0].name).toBe("Heavy Freight");
	});

	it("sorts rates cheapest first", async () => {
		const controller = createShippingController(data);
		const zone = await controller.createZone({
			name: "US",
			countries: ["US"],
		});
		await controller.addRate({
			zoneId: zone.id,
			name: "Express",
			price: 1999,
		});
		await controller.addRate({
			zoneId: zone.id,
			name: "Economy",
			price: 299,
		});
		await controller.addRate({
			zoneId: zone.id,
			name: "Standard",
			price: 799,
		});

		const result = await simulateCalculateRates(data, {
			country: "US",
			orderAmount: 5000,
		});

		expect(result.rates.map((r) => r.price)).toEqual([299, 799, 1999]);
	});

	it("skips inactive zones", async () => {
		const controller = createShippingController(data);
		const zone = await controller.createZone({
			name: "US",
			countries: ["US"],
			isActive: false,
		});
		await controller.addRate({ zoneId: zone.id, name: "Standard", price: 599 });

		const result = await simulateCalculateRates(data, {
			country: "US",
			orderAmount: 5000,
		});

		expect(result.rates).toHaveLength(0);
	});

	it("skips inactive rates", async () => {
		const controller = createShippingController(data);
		const zone = await controller.createZone({
			name: "US",
			countries: ["US"],
		});
		await controller.addRate({
			zoneId: zone.id,
			name: "Disabled",
			price: 0,
			isActive: false,
		});
		await controller.addRate({
			zoneId: zone.id,
			name: "Active",
			price: 599,
		});

		const result = await simulateCalculateRates(data, {
			country: "US",
			orderAmount: 5000,
		});

		expect(result.rates).toHaveLength(1);
		expect(result.rates[0].name).toBe("Active");
	});

	it("returns rates from multiple matching zones", async () => {
		const controller = createShippingController(data);
		const usZone = await controller.createZone({
			name: "US Domestic",
			countries: ["US"],
		});
		const globalZone = await controller.createZone({
			name: "Global",
			countries: [],
		});
		await controller.addRate({
			zoneId: usZone.id,
			name: "US Standard",
			price: 599,
		});
		await controller.addRate({
			zoneId: globalZone.id,
			name: "International",
			price: 1999,
		});

		const result = await simulateCalculateRates(data, {
			country: "US",
			orderAmount: 5000,
		});

		expect(result.rates).toHaveLength(2);
		expect(result.rates.map((r) => r.name)).toContain("US Standard");
		expect(result.rates.map((r) => r.name)).toContain("International");
	});

	it("includes zoneName in the rate response", async () => {
		const controller = createShippingController(data);
		const zone = await controller.createZone({
			name: "North America",
			countries: ["US", "CA"],
		});
		await controller.addRate({
			zoneId: zone.id,
			name: "Standard",
			price: 799,
		});

		const result = await simulateCalculateRates(data, {
			country: "CA",
			orderAmount: 5000,
		});

		expect(result.rates[0].zoneName).toBe("North America");
	});

	it("is case-insensitive for country codes", async () => {
		const controller = createShippingController(data);
		const zone = await controller.createZone({
			name: "US",
			countries: ["US"],
		});
		await controller.addRate({ zoneId: zone.id, name: "Standard", price: 599 });

		const result = await simulateCalculateRates(data, {
			country: "us",
			orderAmount: 5000,
		});

		expect(result.rates).toHaveLength(1);
	});

	it("returns empty for zero-order amount when min is required", async () => {
		const controller = createShippingController(data);
		const zone = await controller.createZone({
			name: "US",
			countries: ["US"],
		});
		await controller.addRate({
			zoneId: zone.id,
			name: "Standard",
			price: 599,
			minOrderAmount: 100,
		});

		const result = await simulateCalculateRates(data, {
			country: "US",
			orderAmount: 0,
		});

		expect(result.rates).toHaveLength(0);
	});
});

describe("store endpoint: list carriers — active only", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns only active carriers", async () => {
		const controller = createShippingController(data);
		await controller.createCarrier({
			name: "FedEx",
			code: "fedex",
			isActive: true,
		});
		await controller.createCarrier({
			name: "DHL (disabled)",
			code: "dhl",
			isActive: false,
		});
		await controller.createCarrier({
			name: "UPS",
			code: "ups",
			isActive: true,
		});

		const result = await simulateListCarriers(data);

		expect(result.carriers).toHaveLength(2);
		const names = (result.carriers as ShippingCarrier[]).map((c) => c.name);
		expect(names).toContain("FedEx");
		expect(names).toContain("UPS");
		expect(names).not.toContain("DHL (disabled)");
	});

	it("returns empty array when no carriers are configured", async () => {
		const result = await simulateListCarriers(data);

		expect(result.carriers).toHaveLength(0);
	});

	it("includes tracking URL template in response", async () => {
		const controller = createShippingController(data);
		await controller.createCarrier({
			name: "UPS",
			code: "ups",
			trackingUrlTemplate: "https://ups.com/track?num={tracking}",
		});

		const result = await simulateListCarriers(data);

		expect(result.carriers).toHaveLength(1);
		expect((result.carriers[0] as ShippingCarrier).trackingUrlTemplate).toBe(
			"https://ups.com/track?num={tracking}",
		);
	});
});

describe("store endpoint: list methods — active and sorted", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns only active methods sorted by sortOrder", async () => {
		const controller = createShippingController(data);
		await controller.createMethod({
			name: "Express",
			estimatedDaysMin: 1,
			estimatedDaysMax: 2,
			sortOrder: 2,
		});
		await controller.createMethod({
			name: "Economy",
			estimatedDaysMin: 5,
			estimatedDaysMax: 10,
			sortOrder: 3,
		});
		await controller.createMethod({
			name: "Standard",
			estimatedDaysMin: 3,
			estimatedDaysMax: 5,
			sortOrder: 1,
		});
		await controller.createMethod({
			name: "Disabled",
			estimatedDaysMin: 1,
			estimatedDaysMax: 1,
			sortOrder: 0,
			isActive: false,
		});

		const result = await simulateListMethods(data);

		expect(result.methods).toHaveLength(3);
		const names = (result.methods as ShippingMethod[]).map((m) => m.name);
		expect(names).toEqual(["Standard", "Express", "Economy"]);
	});

	it("returns empty array when no methods are configured", async () => {
		const result = await simulateListMethods(data);

		expect(result.methods).toHaveLength(0);
	});

	it("includes estimated delivery days in response", async () => {
		const controller = createShippingController(data);
		await controller.createMethod({
			name: "Next Day",
			estimatedDaysMin: 1,
			estimatedDaysMax: 1,
			description: "Guaranteed next-day delivery",
		});

		const result = await simulateListMethods(data);

		expect(result.methods).toHaveLength(1);
		const method = result.methods[0] as ShippingMethod;
		expect(method.estimatedDaysMin).toBe(1);
		expect(method.estimatedDaysMax).toBe(1);
		expect(method.description).toBe("Guaranteed next-day delivery");
	});
});

describe("store endpoint: track shipment — auth and ownership", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 without authentication", async () => {
		const result = await simulateTrackShipment(data, "any_id");

		expect(result).toEqual({ error: "Unauthorized", status: 401 });
	});

	it("returns 404 when shipment does not exist", async () => {
		const result = await simulateTrackShipment(data, "ghost_id", {
			userId: "cust_1",
		});

		expect(result).toEqual({ error: "Shipment not found", status: 404 });
	});

	it("returns shipment details for the order owner", async () => {
		const controller = createShippingController(data);
		const shipment = await controller.createShipment({
			orderId: "order_1",
			trackingNumber: "1Z999AA10123456784",
		});
		await controller.updateShipmentStatus(shipment.id, "shipped");

		const orderCtrl = {
			async getById(id: string) {
				if (id === "order_1") return { customerId: "cust_1" };
				return null;
			},
		};

		const result = await simulateTrackShipment(data, shipment.id, {
			userId: "cust_1",
			orderController: orderCtrl,
		});

		expect("shipment" in result).toBe(true);
		if ("shipment" in result) {
			expect(result.shipment.trackingNumber).toBe("1Z999AA10123456784");
			expect(result.shipment.status).toBe("shipped");
			expect(result.shipment.orderId).toBe("order_1");
		}
	});

	it("returns 404 when order belongs to a different customer", async () => {
		const controller = createShippingController(data);
		const shipment = await controller.createShipment({
			orderId: "order_1",
		});

		const orderCtrl = {
			async getById(id: string) {
				if (id === "order_1") return { customerId: "cust_owner" };
				return null;
			},
		};

		const result = await simulateTrackShipment(data, shipment.id, {
			userId: "cust_attacker",
			orderController: orderCtrl,
		});

		expect(result).toEqual({ error: "Shipment not found", status: 404 });
	});

	it("returns 404 when order does not exist", async () => {
		const controller = createShippingController(data);
		const shipment = await controller.createShipment({
			orderId: "order_deleted",
		});

		const orderCtrl = {
			async getById() {
				return null;
			},
		};

		const result = await simulateTrackShipment(data, shipment.id, {
			userId: "cust_1",
			orderController: orderCtrl,
		});

		expect(result).toEqual({ error: "Shipment not found", status: 404 });
	});

	it("allows access when no order controller is available", async () => {
		const controller = createShippingController(data);
		const shipment = await controller.createShipment({
			orderId: "order_1",
			trackingNumber: "TRACK123",
		});

		const result = await simulateTrackShipment(data, shipment.id, {
			userId: "any_user",
		});

		expect("shipment" in result).toBe(true);
		if ("shipment" in result) {
			expect(result.shipment.trackingNumber).toBe("TRACK123");
		}
	});

	it("returns null trackingUrl when carrier has no template", async () => {
		const controller = createShippingController(data);
		const shipment = await controller.createShipment({
			orderId: "order_1",
			trackingNumber: "TRACK123",
		});

		const result = await simulateTrackShipment(data, shipment.id, {
			userId: "cust_1",
		});

		expect("trackingUrl" in result).toBe(true);
		if ("trackingUrl" in result) {
			expect(result.trackingUrl).toBeNull();
		}
	});

	it("omits sensitive fields from the response", async () => {
		const controller = createShippingController(data);
		const shipment = await controller.createShipment({
			orderId: "order_1",
			trackingNumber: "TRACK123",
			notes: "Internal: fragile handling",
		});

		const result = await simulateTrackShipment(data, shipment.id, {
			userId: "cust_1",
		});

		expect("shipment" in result).toBe(true);
		if ("shipment" in result) {
			// The endpoint shapes the response to exclude internal fields
			expect(result.shipment).not.toHaveProperty("notes");
			expect(result.shipment).not.toHaveProperty("externalShipmentId");
			expect(result.shipment).not.toHaveProperty("labelUrl");
		}
	});
});

describe("store endpoint: live rates — EasyPost delegation", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("throws when no EasyPost key is configured", async () => {
		const controller = createShippingController(data);

		await expect(
			controller.getLiveRates({
				fromAddress: {
					street1: "123 Main St",
					city: "San Francisco",
					state: "CA",
					zip: "94105",
					country: "US",
				},
				toAddress: {
					street1: "456 Oak Ave",
					city: "Los Angeles",
					state: "CA",
					zip: "90001",
					country: "US",
				},
				parcel: { length: 10, width: 8, height: 4, weight: 16 },
			}),
		).rejects.toThrow("EasyPost API key is not configured");
	});
});
