import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import { createShippingController } from "../service-impl";

// ── Zone management — edge cases ──────────────────────────────────────────

describe("zone management — edge cases", () => {
	it("creates zone with single country", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({
			name: "Germany",
			countries: ["DE"],
		});
		expect(zone.countries).toEqual(["DE"]);
	});

	it("creates zone with many countries", async () => {
		const ctrl = createShippingController(createMockDataService());
		const countries = ["US", "CA", "MX", "BR", "AR", "CL", "CO", "PE"];
		const zone = await ctrl.createZone({ name: "Americas", countries });
		expect(zone.countries).toHaveLength(8);
		expect(zone.countries).toEqual(countries);
	});

	it("updating zone countries replaces entire list", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({
			name: "EU",
			countries: ["DE", "FR"],
		});
		const updated = await ctrl.updateZone(zone.id, {
			countries: ["IT", "ES"],
		});
		expect(updated?.countries).toEqual(["IT", "ES"]);
		expect(updated?.countries).not.toContain("DE");
	});

	it("toggling zone active/inactive preserves rates", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US", countries: ["US"] });
		await ctrl.addRate({ zoneId: zone.id, name: "Standard", price: 599 });
		await ctrl.addRate({ zoneId: zone.id, name: "Express", price: 1299 });

		// Deactivate
		await ctrl.updateZone(zone.id, { isActive: false });
		const ratesWhileInactive = await ctrl.listRates({ zoneId: zone.id });
		expect(ratesWhileInactive).toHaveLength(2);

		// Reactivate
		await ctrl.updateZone(zone.id, { isActive: true });
		const ratesAfter = await ctrl.listRates({ zoneId: zone.id });
		expect(ratesAfter).toHaveLength(2);
	});

	it("deleting zone returns false when called twice", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "Temp" });
		expect(await ctrl.deleteZone(zone.id)).toBe(true);
		expect(await ctrl.deleteZone(zone.id)).toBe(false);
	});
});

// ── Rate management — edge cases ──────────────────────────────────────────

describe("rate management — edge cases", () => {
	it("creates rate with all optional thresholds", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US", countries: ["US"] });
		const rate = await ctrl.addRate({
			zoneId: zone.id,
			name: "Conditional",
			price: 799,
			minOrderAmount: 1000,
			maxOrderAmount: 50000,
			minWeight: 0.5,
			maxWeight: 30,
		});
		expect(rate.minOrderAmount).toBe(1000);
		expect(rate.maxOrderAmount).toBe(50000);
		expect(rate.minWeight).toBe(0.5);
		expect(rate.maxWeight).toBe(30);
	});

	it("creates rate with zero price (free shipping)", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US", countries: ["US"] });
		const rate = await ctrl.addRate({
			zoneId: zone.id,
			name: "Free",
			price: 0,
		});
		expect(rate.price).toBe(0);
	});

	it("updates weight thresholds on existing rate", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US", countries: ["US"] });
		const rate = await ctrl.addRate({
			zoneId: zone.id,
			name: "Weighted",
			price: 599,
			minWeight: 0,
			maxWeight: 10,
		});
		const updated = await ctrl.updateRate(rate.id, {
			minWeight: 5,
			maxWeight: 50,
		});
		expect(updated?.minWeight).toBe(5);
		expect(updated?.maxWeight).toBe(50);
	});

	it("updates order amount thresholds", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US", countries: ["US"] });
		const rate = await ctrl.addRate({
			zoneId: zone.id,
			name: "Conditional",
			price: 599,
			minOrderAmount: 1000,
		});
		const updated = await ctrl.updateRate(rate.id, {
			minOrderAmount: 2000,
			maxOrderAmount: 10000,
		});
		expect(updated?.minOrderAmount).toBe(2000);
		expect(updated?.maxOrderAmount).toBe(10000);
	});

	it("deleting a rate does not affect other rates in the same zone", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US", countries: ["US"] });
		const rate1 = await ctrl.addRate({
			zoneId: zone.id,
			name: "Standard",
			price: 599,
		});
		await ctrl.addRate({ zoneId: zone.id, name: "Express", price: 1299 });

		await ctrl.deleteRate(rate1.id);
		const remaining = await ctrl.listRates({ zoneId: zone.id });
		expect(remaining).toHaveLength(1);
		expect(remaining[0].name).toBe("Express");
	});

	it("deleting a rate returns false when called twice", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US", countries: ["US"] });
		const rate = await ctrl.addRate({
			zoneId: zone.id,
			name: "Temp",
			price: 100,
		});
		expect(await ctrl.deleteRate(rate.id)).toBe(true);
		expect(await ctrl.deleteRate(rate.id)).toBe(false);
	});
});

// ── calculateRates — boundary and complex scenarios ───────────────────────

describe("calculateRates — boundary conditions", () => {
	it("rate with exact min order amount match is included", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US", countries: ["US"] });
		await ctrl.addRate({
			zoneId: zone.id,
			name: "Free over 100",
			price: 0,
			minOrderAmount: 10000,
		});

		const rates = await ctrl.calculateRates({
			country: "US",
			orderAmount: 10000,
		});
		expect(rates.map((r) => r.name)).toContain("Free over 100");
	});

	it("rate with exact max order amount match is included", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US", countries: ["US"] });
		await ctrl.addRate({
			zoneId: zone.id,
			name: "Small orders",
			price: 299,
			maxOrderAmount: 5000,
		});

		const rates = await ctrl.calculateRates({
			country: "US",
			orderAmount: 5000,
		});
		expect(rates.map((r) => r.name)).toContain("Small orders");
	});

	it("rate with exact weight boundary is included", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US", countries: ["US"] });
		await ctrl.addRate({
			zoneId: zone.id,
			name: "Light",
			price: 399,
			minWeight: 0,
			maxWeight: 5,
		});

		const rates = await ctrl.calculateRates({
			country: "US",
			orderAmount: 1000,
			weight: 5,
		});
		expect(rates.map((r) => r.name)).toContain("Light");
	});

	it("multiple zones with overlapping countries return all matching rates", async () => {
		const ctrl = createShippingController(createMockDataService());
		const domestic = await ctrl.createZone({
			name: "Domestic US",
			countries: ["US"],
		});
		const northAmerica = await ctrl.createZone({
			name: "North America",
			countries: ["US", "CA", "MX"],
		});
		const world = await ctrl.createZone({ name: "Worldwide", countries: [] });

		await ctrl.addRate({
			zoneId: domestic.id,
			name: "US Standard",
			price: 499,
		});
		await ctrl.addRate({
			zoneId: northAmerica.id,
			name: "NA Express",
			price: 999,
		});
		await ctrl.addRate({
			zoneId: world.id,
			name: "Global",
			price: 1999,
		});

		const usRates = await ctrl.calculateRates({
			country: "US",
			orderAmount: 5000,
		});
		expect(usRates).toHaveLength(3);

		const caRates = await ctrl.calculateRates({
			country: "CA",
			orderAmount: 5000,
		});
		expect(caRates).toHaveLength(2);
		expect(caRates.map((r) => r.name)).not.toContain("US Standard");

		const jpRates = await ctrl.calculateRates({
			country: "JP",
			orderAmount: 5000,
		});
		expect(jpRates).toHaveLength(1);
		expect(jpRates[0].name).toBe("Global");
	});

	it("mixed active/inactive zones filter correctly", async () => {
		const ctrl = createShippingController(createMockDataService());
		const activeZone = await ctrl.createZone({
			name: "Active US",
			countries: ["US"],
			isActive: true,
		});
		const inactiveZone = await ctrl.createZone({
			name: "Inactive US",
			countries: ["US"],
			isActive: false,
		});

		await ctrl.addRate({
			zoneId: activeZone.id,
			name: "Available",
			price: 599,
		});
		await ctrl.addRate({
			zoneId: inactiveZone.id,
			name: "Hidden",
			price: 299,
		});

		const rates = await ctrl.calculateRates({
			country: "US",
			orderAmount: 5000,
		});
		expect(rates).toHaveLength(1);
		expect(rates[0].name).toBe("Available");
	});

	it("free shipping rate appears when order meets minimum", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US", countries: ["US"] });
		await ctrl.addRate({
			zoneId: zone.id,
			name: "Standard",
			price: 599,
		});
		await ctrl.addRate({
			zoneId: zone.id,
			name: "Free Shipping",
			price: 0,
			minOrderAmount: 5000,
		});

		const small = await ctrl.calculateRates({
			country: "US",
			orderAmount: 3000,
		});
		expect(small.map((r) => r.name)).toEqual(["Standard"]);

		const large = await ctrl.calculateRates({
			country: "US",
			orderAmount: 5000,
		});
		expect(large.map((r) => r.name)).toContain("Free Shipping");
		// Free should sort first (price 0 < 599)
		expect(large[0].name).toBe("Free Shipping");
	});

	it("rates with both min and max order amounts form a window", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US", countries: ["US"] });
		await ctrl.addRate({
			zoneId: zone.id,
			name: "Mid-range",
			price: 499,
			minOrderAmount: 2000,
			maxOrderAmount: 8000,
		});

		const below = await ctrl.calculateRates({
			country: "US",
			orderAmount: 1000,
		});
		expect(below).toHaveLength(0);

		const inRange = await ctrl.calculateRates({
			country: "US",
			orderAmount: 5000,
		});
		expect(inRange).toHaveLength(1);

		const above = await ctrl.calculateRates({
			country: "US",
			orderAmount: 10000,
		});
		expect(above).toHaveLength(0);
	});

	it("rates with both min and max weight form a window", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US", countries: ["US"] });
		await ctrl.addRate({
			zoneId: zone.id,
			name: "Medium Package",
			price: 799,
			minWeight: 2,
			maxWeight: 20,
		});

		const tooLight = await ctrl.calculateRates({
			country: "US",
			orderAmount: 5000,
			weight: 1,
		});
		expect(tooLight).toHaveLength(0);

		const inRange = await ctrl.calculateRates({
			country: "US",
			orderAmount: 5000,
			weight: 10,
		});
		expect(inRange).toHaveLength(1);

		const tooHeavy = await ctrl.calculateRates({
			country: "US",
			orderAmount: 5000,
			weight: 25,
		});
		expect(tooHeavy).toHaveLength(0);
	});
});

// ── calculateRates — comprehensive multi-rate scenarios ───────────────────

describe("calculateRates — multi-rate scenarios", () => {
	it("tiered shipping: economy, standard, express sorted by price", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US", countries: ["US"] });
		await ctrl.addRate({
			zoneId: zone.id,
			name: "Express",
			price: 1999,
		});
		await ctrl.addRate({
			zoneId: zone.id,
			name: "Economy",
			price: 299,
		});
		await ctrl.addRate({
			zoneId: zone.id,
			name: "Standard",
			price: 799,
		});

		const rates = await ctrl.calculateRates({
			country: "US",
			orderAmount: 5000,
		});
		expect(rates).toHaveLength(3);
		expect(rates[0].name).toBe("Economy");
		expect(rates[1].name).toBe("Standard");
		expect(rates[2].name).toBe("Express");
	});

	it("only active rates from active zones appear", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US", countries: ["US"] });
		await ctrl.addRate({
			zoneId: zone.id,
			name: "Visible",
			price: 599,
			isActive: true,
		});
		await ctrl.addRate({
			zoneId: zone.id,
			name: "Draft",
			price: 399,
			isActive: false,
		});
		await ctrl.addRate({
			zoneId: zone.id,
			name: "Also Visible",
			price: 799,
			isActive: true,
		});

		const rates = await ctrl.calculateRates({
			country: "US",
			orderAmount: 5000,
		});
		expect(rates).toHaveLength(2);
		const names = rates.map((r) => r.name);
		expect(names).toContain("Visible");
		expect(names).toContain("Also Visible");
		expect(names).not.toContain("Draft");
	});

	it("zone with no active rates returns empty", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({ name: "US", countries: ["US"] });
		await ctrl.addRate({
			zoneId: zone.id,
			name: "Only Draft",
			price: 599,
			isActive: false,
		});

		const rates = await ctrl.calculateRates({
			country: "US",
			orderAmount: 5000,
		});
		expect(rates).toHaveLength(0);
	});

	it("calculated rate includes id and zoneName", async () => {
		const ctrl = createShippingController(createMockDataService());
		const zone = await ctrl.createZone({
			name: "North America",
			countries: ["US"],
		});
		const rate = await ctrl.addRate({
			zoneId: zone.id,
			name: "Standard",
			price: 599,
		});

		const calculated = await ctrl.calculateRates({
			country: "US",
			orderAmount: 5000,
		});
		expect(calculated).toHaveLength(1);
		expect(calculated[0].id).toBe(rate.id);
		expect(calculated[0].zoneName).toBe("North America");
		expect(calculated[0].name).toBe("Standard");
		expect(calculated[0].price).toBe(599);
	});
});
