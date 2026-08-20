import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import { createShippingController } from "../service-impl";

// ---------------------------------------------------------------------------
// createZone / getZone
// ---------------------------------------------------------------------------

describe("createZone", () => {
	it("creates a zone with defaults", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "Domestic" });

		expect(zone.name).toBe("Domestic");
		expect(zone.countries).toEqual([]);
		expect(zone.isActive).toBe(true);
		expect(zone.id).toBeTruthy();
	});

	it("stores country list", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({
			name: "Europe",
			countries: ["DE", "FR", "IT"],
		});
		expect(zone.countries).toEqual(["DE", "FR", "IT"]);
	});

	it("creates an inactive zone when isActive is false", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "Draft", isActive: false });
		expect(zone.isActive).toBe(false);
	});

	it("sets createdAt and updatedAt", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "Timed" });
		expect(zone.createdAt).toBeInstanceOf(Date);
		expect(zone.updatedAt).toBeInstanceOf(Date);
	});
});

describe("getZone", () => {
	it("returns null for missing zone", async () => {
		const ctrl = createShippingController(createMockDataService());
		expect(await ctrl.getZone("nope")).toBeNull();
	});

	it("returns the zone when it exists", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US" });
		const fetched = await ctrl.getZone(zone.id);
		expect(fetched?.id).toBe(zone.id);
		expect(fetched?.name).toBe("US");
	});
});

// ---------------------------------------------------------------------------
// listZones
// ---------------------------------------------------------------------------

describe("listZones", () => {
	it("lists all zones", async () => {
		const ctrl = createShippingController(createMockDataService());
		await ctrl.createZone({ name: "A" });
		await ctrl.createZone({ name: "B" });
		expect(await ctrl.listZones()).toHaveLength(2);
	});

	it("filters by activeOnly", async () => {
		const ctrl = createShippingController(createMockDataService());
		await ctrl.createZone({ name: "Active", isActive: true });
		await ctrl.createZone({ name: "Inactive", isActive: false });
		const active = await ctrl.listZones({ activeOnly: true });
		expect(active).toHaveLength(1);
		expect(active[0].name).toBe("Active");
	});

	it("returns empty array when no zones exist", async () => {
		const ctrl = createShippingController(createMockDataService());
		expect(await ctrl.listZones()).toHaveLength(0);
	});

	it("returns all zones when activeOnly is false or undefined", async () => {
		const ctrl = createShippingController(createMockDataService());
		await ctrl.createZone({ name: "Active", isActive: true });
		await ctrl.createZone({ name: "Inactive", isActive: false });
		expect(await ctrl.listZones()).toHaveLength(2);
		expect(await ctrl.listZones({ activeOnly: false })).toHaveLength(2);
	});
});

// ---------------------------------------------------------------------------
// updateZone
// ---------------------------------------------------------------------------

describe("updateZone", () => {
	it("updates zone fields", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "Old" });
		const updated = await ctrl.updateZone(zone.id, {
			name: "New",
			isActive: false,
		});
		expect(updated?.name).toBe("New");
		expect(updated?.isActive).toBe(false);
	});

	it("returns null for missing zone", async () => {
		const ctrl = createShippingController(createMockDataService());
		expect(await ctrl.updateZone("ghost", { name: "X" })).toBeNull();
	});

	it("updates only countries without changing other fields", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "EU", countries: ["DE"] });
		const updated = await ctrl.updateZone(zone.id, {
			countries: ["DE", "FR", "IT"],
		});
		expect(updated?.countries).toEqual(["DE", "FR", "IT"]);
		expect(updated?.name).toBe("EU");
		expect(updated?.isActive).toBe(true);
	});

	it("advances updatedAt timestamp", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US" });
		await new Promise((r) => setTimeout(r, 1));
		const updated = await ctrl.updateZone(zone.id, { name: "USA" });
		expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
			zone.updatedAt.getTime(),
		);
	});
});

// ---------------------------------------------------------------------------
// deleteZone (cascades rates)
// ---------------------------------------------------------------------------

describe("deleteZone", () => {
	it("removes zone and its rates", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "Z" });
		await ctrl.addRate({ zoneId: zone.id, name: "Flat", price: 500 });
		await ctrl.addRate({ zoneId: zone.id, name: "Express", price: 1000 });

		const deleted = await ctrl.deleteZone(zone.id);
		expect(deleted).toBe(true);
		expect(await ctrl.getZone(zone.id)).toBeNull();
		expect(await ctrl.listRates({ zoneId: zone.id })).toHaveLength(0);
	});

	it("returns false for missing zone", async () => {
		const ctrl = createShippingController(createMockDataService());
		expect(await ctrl.deleteZone("nope")).toBe(false);
	});

	it("succeeds when zone has no rates", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "Empty" });
		expect(await ctrl.deleteZone(zone.id)).toBe(true);
		expect(await ctrl.getZone(zone.id)).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// addRate / getRate / listRates
// ---------------------------------------------------------------------------

describe("addRate", () => {
	it("adds a rate to a zone", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US" });
		const rate = await ctrl.addRate({
			zoneId: zone.id,
			name: "Standard",
			price: 599,
		});

		expect(rate.zoneId).toBe(zone.id);
		expect(rate.name).toBe("Standard");
		expect(rate.price).toBe(599);
		expect(rate.isActive).toBe(true);
	});

	it("stores optional weight and amount thresholds", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US" });
		const rate = await ctrl.addRate({
			zoneId: zone.id,
			name: "Heavy",
			price: 1999,
			minOrderAmount: 5000,
			maxOrderAmount: 50000,
			minWeight: 1,
			maxWeight: 100,
		});
		expect(rate.minOrderAmount).toBe(5000);
		expect(rate.maxOrderAmount).toBe(50000);
		expect(rate.minWeight).toBe(1);
		expect(rate.maxWeight).toBe(100);
	});

	it("creates an inactive rate", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US" });
		const rate = await ctrl.addRate({
			zoneId: zone.id,
			name: "Draft",
			price: 0,
			isActive: false,
		});
		expect(rate.isActive).toBe(false);
	});
});

describe("getRate", () => {
	it("returns null for missing rate", async () => {
		const ctrl = createShippingController(createMockDataService());
		expect(await ctrl.getRate("nope")).toBeNull();
	});

	it("returns an existing rate", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US" });
		const rate = await ctrl.addRate({
			zoneId: zone.id,
			name: "Standard",
			price: 599,
		});
		const fetched = await ctrl.getRate(rate.id);
		expect(fetched?.name).toBe("Standard");
		expect(fetched?.price).toBe(599);
	});
});

describe("listRates", () => {
	it("lists rates for a zone", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US" });
		await ctrl.addRate({ zoneId: zone.id, name: "A", price: 100 });
		await ctrl.addRate({ zoneId: zone.id, name: "B", price: 200 });
		const rates = await ctrl.listRates({ zoneId: zone.id });
		expect(rates).toHaveLength(2);
	});

	it("filters by activeOnly", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US" });
		await ctrl.addRate({
			zoneId: zone.id,
			name: "Active",
			price: 100,
			isActive: true,
		});
		await ctrl.addRate({
			zoneId: zone.id,
			name: "Inactive",
			price: 200,
			isActive: false,
		});
		const active = await ctrl.listRates({ zoneId: zone.id, activeOnly: true });
		expect(active).toHaveLength(1);
		expect(active[0].name).toBe("Active");
	});

	it("returns empty array for zone with no rates", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "Empty" });
		expect(await ctrl.listRates({ zoneId: zone.id })).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// updateRate / deleteRate
// ---------------------------------------------------------------------------

describe("updateRate", () => {
	it("updates rate price", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US" });
		const rate = await ctrl.addRate({
			zoneId: zone.id,
			name: "Standard",
			price: 500,
		});
		const updated = await ctrl.updateRate(rate.id, { price: 750 });
		expect(updated?.price).toBe(750);
	});

	it("returns null for missing rate", async () => {
		const ctrl = createShippingController(createMockDataService());
		expect(await ctrl.updateRate("ghost", { price: 100 })).toBeNull();
	});

	it("updates name and isActive without changing price", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US" });
		const rate = await ctrl.addRate({
			zoneId: zone.id,
			name: "Standard",
			price: 500,
		});
		const updated = await ctrl.updateRate(rate.id, {
			name: "Premium",
			isActive: false,
		});
		expect(updated?.name).toBe("Premium");
		expect(updated?.isActive).toBe(false);
		expect(updated?.price).toBe(500);
	});

	it("advances updatedAt timestamp", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US" });
		const rate = await ctrl.addRate({
			zoneId: zone.id,
			name: "Standard",
			price: 500,
		});
		await new Promise((r) => setTimeout(r, 1));
		const updated = await ctrl.updateRate(rate.id, { price: 600 });
		expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
			rate.updatedAt.getTime(),
		);
	});
});

describe("deleteRate", () => {
	it("removes a rate", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US" });
		const rate = await ctrl.addRate({
			zoneId: zone.id,
			name: "Standard",
			price: 500,
		});
		expect(await ctrl.deleteRate(rate.id)).toBe(true);
		expect(await ctrl.getRate(rate.id)).toBeNull();
	});

	it("returns false for missing rate", async () => {
		const ctrl = createShippingController(createMockDataService());
		expect(await ctrl.deleteRate("nope")).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// calculateRates
// ---------------------------------------------------------------------------

describe("calculateRates", () => {
	it("returns rates for a matching country", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US", countries: ["US"] });
		await ctrl.addRate({ zoneId: zone.id, name: "Standard", price: 599 });

		const rates = await ctrl.calculateRates({
			country: "US",
			orderAmount: 5000,
		});
		expect(rates).toHaveLength(1);
		expect(rates[0].name).toBe("Standard");
	});

	it("wildcard zone (no countries) matches all destinations", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "World", countries: [] });
		await ctrl.addRate({ zoneId: zone.id, name: "Flat", price: 999 });

		const rates = await ctrl.calculateRates({
			country: "JP",
			orderAmount: 3000,
		});
		expect(rates).toHaveLength(1);
	});

	it("excludes rates for non-matching country", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "CA", countries: ["CA"] });
		await ctrl.addRate({ zoneId: zone.id, name: "Standard", price: 699 });

		const rates = await ctrl.calculateRates({
			country: "US",
			orderAmount: 5000,
		});
		expect(rates).toHaveLength(0);
	});

	it("filters rates by minimum order amount", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US", countries: ["US"] });
		await ctrl.addRate({
			zoneId: zone.id,
			name: "Free",
			price: 0,
			minOrderAmount: 10000,
		});
		await ctrl.addRate({ zoneId: zone.id, name: "Standard", price: 599 });

		const small = await ctrl.calculateRates({
			country: "US",
			orderAmount: 5000,
		});
		expect(small.map((r) => r.name)).not.toContain("Free");
		expect(small.map((r) => r.name)).toContain("Standard");

		const large = await ctrl.calculateRates({
			country: "US",
			orderAmount: 15000,
		});
		expect(large.map((r) => r.name)).toContain("Free");
	});

	it("filters rates by maximum order amount", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US", countries: ["US"] });
		await ctrl.addRate({
			zoneId: zone.id,
			name: "Small only",
			price: 299,
			maxOrderAmount: 5000,
		});
		await ctrl.addRate({ zoneId: zone.id, name: "Standard", price: 599 });

		const small = await ctrl.calculateRates({
			country: "US",
			orderAmount: 3000,
		});
		expect(small.map((r) => r.name)).toContain("Small only");

		const large = await ctrl.calculateRates({
			country: "US",
			orderAmount: 8000,
		});
		expect(large.map((r) => r.name)).not.toContain("Small only");
		expect(large.map((r) => r.name)).toContain("Standard");
	});

	it("filters rates by weight range", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US", countries: ["US"] });
		await ctrl.addRate({
			zoneId: zone.id,
			name: "Light",
			price: 399,
			minWeight: 0,
			maxWeight: 5,
		});
		await ctrl.addRate({
			zoneId: zone.id,
			name: "Heavy",
			price: 1299,
			minWeight: 5,
			maxWeight: 50,
		});

		const light = await ctrl.calculateRates({
			country: "US",
			orderAmount: 3000,
			weight: 2,
		});
		expect(light.map((r) => r.name)).toContain("Light");
		expect(light.map((r) => r.name)).not.toContain("Heavy");

		const heavy = await ctrl.calculateRates({
			country: "US",
			orderAmount: 3000,
			weight: 10,
		});
		expect(heavy.map((r) => r.name)).toContain("Heavy");
		expect(heavy.map((r) => r.name)).not.toContain("Light");
	});

	it("skips weight checks when weight is not provided", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US", countries: ["US"] });
		await ctrl.addRate({
			zoneId: zone.id,
			name: "WeightLimited",
			price: 599,
			minWeight: 1,
			maxWeight: 50,
		});

		const rates = await ctrl.calculateRates({
			country: "US",
			orderAmount: 5000,
		});
		expect(rates.map((r) => r.name)).toContain("WeightLimited");
	});

	it("matches country case-insensitively", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US", countries: ["US"] });
		await ctrl.addRate({ zoneId: zone.id, name: "Standard", price: 599 });

		const rates = await ctrl.calculateRates({
			country: "us",
			orderAmount: 5000,
		});
		expect(rates).toHaveLength(1);
	});

	it("combines rates from multiple matching zones", async () => {
		const ctrl = createShippingController(createMockDataService());
		const usZone = await ctrl.createZone({ name: "US", countries: ["US"] });
		const worldZone = await ctrl.createZone({ name: "World", countries: [] });
		await ctrl.addRate({
			zoneId: usZone.id,
			name: "US Standard",
			price: 599,
		});
		await ctrl.addRate({
			zoneId: worldZone.id,
			name: "World Flat",
			price: 1499,
		});

		const rates = await ctrl.calculateRates({
			country: "US",
			orderAmount: 5000,
		});
		expect(rates).toHaveLength(2);
		expect(rates[0].price).toBeLessThanOrEqual(rates[1].price);
	});

	it("excludes inactive rates within an active zone", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US", countries: ["US"] });
		await ctrl.addRate({
			zoneId: zone.id,
			name: "Active",
			price: 599,
			isActive: true,
		});
		await ctrl.addRate({
			zoneId: zone.id,
			name: "Disabled",
			price: 299,
			isActive: false,
		});

		const rates = await ctrl.calculateRates({
			country: "US",
			orderAmount: 5000,
		});
		expect(rates).toHaveLength(1);
		expect(rates[0].name).toBe("Active");
	});

	it("sorts rates cheapest first", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US", countries: ["US"] });
		await ctrl.addRate({ zoneId: zone.id, name: "Express", price: 1499 });
		await ctrl.addRate({ zoneId: zone.id, name: "Standard", price: 499 });
		await ctrl.addRate({ zoneId: zone.id, name: "Economy", price: 299 });

		const rates = await ctrl.calculateRates({
			country: "US",
			orderAmount: 1000,
		});
		expect(rates[0].price).toBe(299);
		expect(rates[1].price).toBe(499);
		expect(rates[2].price).toBe(1499);
	});

	it("does not return rates from inactive zones", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({
			name: "US",
			countries: ["US"],
			isActive: false,
		});
		await ctrl.addRate({ zoneId: zone.id, name: "Standard", price: 599 });

		const rates = await ctrl.calculateRates({
			country: "US",
			orderAmount: 5000,
		});
		expect(rates).toHaveLength(0);
	});

	it("returns empty array when no zones exist", async () => {
		const ctrl = createShippingController(createMockDataService());
		const rates = await ctrl.calculateRates({
			country: "US",
			orderAmount: 5000,
		});
		expect(rates).toHaveLength(0);
	});

	it("includes zone name in calculated rate", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({
			name: "North America",
			countries: ["US"],
		});
		await ctrl.addRate({ zoneId: zone.id, name: "Standard", price: 599 });

		const rates = await ctrl.calculateRates({
			country: "US",
			orderAmount: 5000,
		});
		expect(rates[0].zoneName).toBe("North America");
		expect(rates[0].id).toBeTruthy();
	});
});
