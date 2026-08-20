import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createShippingController } from "../service-impl";

/**
 * Security regression tests for shipping endpoints.
 *
 * Shipping rates affect order totals (financial impact).
 * These tests verify:
 * - Zone matching correctness (country case, wildcard behavior)
 * - Rate condition boundaries (prevent free shipping leaks)
 * - Cascade delete integrity (zone deletion removes all rates)
 * - Inactive zone/rate filtering (deactivated items hidden from calculation)
 * - Input boundary conditions
 */

describe("shipping endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createShippingController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createShippingController(mockData);
	});

	// ── Country Matching Safety ────────────────────────────────────

	describe("country matching security", () => {
		it("case-insensitive country matching prevents bypass", async () => {
			const zone = await controller.createZone({
				name: "US Zone",
				countries: ["US"],
			});
			await controller.addRate({
				zoneId: zone.id,
				name: "Standard",
				price: 500,
			});

			// All case variants should match
			const lower = await controller.calculateRates({
				country: "us",
				orderAmount: 1000,
			});
			const upper = await controller.calculateRates({
				country: "US",
				orderAmount: 1000,
			});
			const mixed = await controller.calculateRates({
				country: "Us",
				orderAmount: 1000,
			});

			expect(lower).toHaveLength(1);
			expect(upper).toHaveLength(1);
			expect(mixed).toHaveLength(1);
		});

		it("non-matching country gets no rates", async () => {
			const zone = await controller.createZone({
				name: "US Only",
				countries: ["US"],
			});
			await controller.addRate({
				zoneId: zone.id,
				name: "Standard",
				price: 500,
			});

			const rates = await controller.calculateRates({
				country: "GB",
				orderAmount: 1000,
			});
			expect(rates).toHaveLength(0);
		});

		it("wildcard zone (empty countries) matches all countries", async () => {
			const zone = await controller.createZone({
				name: "Global",
				countries: [],
			});
			await controller.addRate({
				zoneId: zone.id,
				name: "International",
				price: 2000,
			});

			const us = await controller.calculateRates({
				country: "US",
				orderAmount: 1000,
			});
			const jp = await controller.calculateRates({
				country: "JP",
				orderAmount: 1000,
			});

			expect(us).toHaveLength(1);
			expect(jp).toHaveLength(1);
		});
	});

	// ── Rate Condition Boundaries ──────────────────────────────────

	describe("rate condition boundary safety", () => {
		it("order amount just below minimum excludes rate", async () => {
			const zone = await controller.createZone({
				name: "Zone",
				countries: [],
			});
			await controller.addRate({
				zoneId: zone.id,
				name: "Premium",
				price: 0,
				minOrderAmount: 5000,
			});

			const below = await controller.calculateRates({
				country: "US",
				orderAmount: 4999,
			});
			expect(below).toHaveLength(0);

			const exact = await controller.calculateRates({
				country: "US",
				orderAmount: 5000,
			});
			expect(exact).toHaveLength(1);
		});

		it("order amount just above maximum excludes rate", async () => {
			const zone = await controller.createZone({
				name: "Zone",
				countries: [],
			});
			await controller.addRate({
				zoneId: zone.id,
				name: "Small Order",
				price: 1000,
				maxOrderAmount: 5000,
			});

			const above = await controller.calculateRates({
				country: "US",
				orderAmount: 5001,
			});
			expect(above).toHaveLength(0);

			const exact = await controller.calculateRates({
				country: "US",
				orderAmount: 5000,
			});
			expect(exact).toHaveLength(1);
		});

		it("weight conditions only checked when weight is provided", async () => {
			const zone = await controller.createZone({
				name: "Zone",
				countries: [],
			});
			await controller.addRate({
				zoneId: zone.id,
				name: "Heavy",
				price: 2000,
				minWeight: 1000,
			});

			// No weight provided — weight conditions are skipped
			const noWeight = await controller.calculateRates({
				country: "US",
				orderAmount: 1000,
			});
			expect(noWeight).toHaveLength(1);

			// Weight provided but too low — excluded
			const tooLight = await controller.calculateRates({
				country: "US",
				orderAmount: 1000,
				weight: 500,
			});
			expect(tooLight).toHaveLength(0);
		});

		it("free shipping cannot be obtained by manipulating amount window", async () => {
			const zone = await controller.createZone({
				name: "Zone",
				countries: [],
			});
			// Free shipping only for orders >= 10000
			await controller.addRate({
				zoneId: zone.id,
				name: "Free Shipping",
				price: 0,
				minOrderAmount: 10000,
			});
			// Paid shipping for orders < 10000
			await controller.addRate({
				zoneId: zone.id,
				name: "Standard",
				price: 500,
				maxOrderAmount: 9999,
			});

			const small = await controller.calculateRates({
				country: "US",
				orderAmount: 5000,
			});
			expect(small).toHaveLength(1);
			expect(small[0].price).toBe(500);

			const big = await controller.calculateRates({
				country: "US",
				orderAmount: 10000,
			});
			expect(big).toHaveLength(1);
			expect(big[0].price).toBe(0);
		});
	});

	// ── Inactive Filtering ─────────────────────────────────────────

	describe("inactive zone/rate filtering", () => {
		it("inactive zones are excluded from rate calculation", async () => {
			const zone = await controller.createZone({
				name: "Disabled",
				countries: [],
				isActive: false,
			});
			await controller.addRate({
				zoneId: zone.id,
				name: "Should Not Appear",
				price: 100,
			});

			const rates = await controller.calculateRates({
				country: "US",
				orderAmount: 1000,
			});
			expect(rates).toHaveLength(0);
		});

		it("inactive rates within active zones are excluded", async () => {
			const zone = await controller.createZone({
				name: "Active Zone",
				countries: [],
			});
			await controller.addRate({
				zoneId: zone.id,
				name: "Active Rate",
				price: 500,
			});
			await controller.addRate({
				zoneId: zone.id,
				name: "Disabled Rate",
				price: 100,
				isActive: false,
			});

			const rates = await controller.calculateRates({
				country: "US",
				orderAmount: 1000,
			});
			expect(rates).toHaveLength(1);
			expect(rates[0].name).toBe("Active Rate");
		});

		it("deactivating a zone hides all its rates", async () => {
			const zone = await controller.createZone({
				name: "Zone",
				countries: [],
			});
			await controller.addRate({
				zoneId: zone.id,
				name: "Rate A",
				price: 500,
			});
			await controller.addRate({
				zoneId: zone.id,
				name: "Rate B",
				price: 1000,
			});

			const before = await controller.calculateRates({
				country: "US",
				orderAmount: 1000,
			});
			expect(before).toHaveLength(2);

			await controller.updateZone(zone.id, { isActive: false });

			const after = await controller.calculateRates({
				country: "US",
				orderAmount: 1000,
			});
			expect(after).toHaveLength(0);
		});
	});

	// ── Cascade Delete Integrity ───────────────────────────────────

	describe("cascade delete integrity", () => {
		it("deleting zone removes all associated rates", async () => {
			const zone = await controller.createZone({
				name: "To Delete",
				countries: [],
			});
			const rate1 = await controller.addRate({
				zoneId: zone.id,
				name: "Rate 1",
				price: 500,
			});
			const rate2 = await controller.addRate({
				zoneId: zone.id,
				name: "Rate 2",
				price: 1000,
			});

			await controller.deleteZone(zone.id);

			// Zone gone
			const zoneResult = await controller.getZone(zone.id);
			expect(zoneResult).toBeNull();

			// Rates also gone
			const rateResult1 = await controller.getRate(rate1.id);
			const rateResult2 = await controller.getRate(rate2.id);
			expect(rateResult1).toBeNull();
			expect(rateResult2).toBeNull();
		});

		it("deleting one zone does not affect another zone's rates", async () => {
			const zone1 = await controller.createZone({
				name: "Zone 1",
				countries: ["US"],
			});
			const zone2 = await controller.createZone({
				name: "Zone 2",
				countries: ["GB"],
			});
			await controller.addRate({
				zoneId: zone1.id,
				name: "US Rate",
				price: 500,
			});
			await controller.addRate({
				zoneId: zone2.id,
				name: "GB Rate",
				price: 800,
			});

			await controller.deleteZone(zone1.id);

			const gbRates = await controller.listRates({ zoneId: zone2.id });
			expect(gbRates).toHaveLength(1);
			expect(gbRates[0].name).toBe("GB Rate");
		});
	});

	// ── Multi-zone Overlap ─────────────────────────────────────────

	describe("multi-zone overlap", () => {
		it("customer sees rates from all matching zones combined", async () => {
			const domestic = await controller.createZone({
				name: "Domestic",
				countries: ["US"],
			});
			const global = await controller.createZone({
				name: "Global",
				countries: [],
			});

			await controller.addRate({
				zoneId: domestic.id,
				name: "Ground",
				price: 500,
			});
			await controller.addRate({
				zoneId: global.id,
				name: "Express",
				price: 2000,
			});

			const rates = await controller.calculateRates({
				country: "US",
				orderAmount: 1000,
			});
			expect(rates).toHaveLength(2);
			expect(rates.map((r) => r.name).sort()).toEqual(["Express", "Ground"]);
		});

		it("rates are sorted by price ascending (cheapest first)", async () => {
			const zone = await controller.createZone({
				name: "Zone",
				countries: [],
			});
			await controller.addRate({
				zoneId: zone.id,
				name: "Express",
				price: 2000,
			});
			await controller.addRate({
				zoneId: zone.id,
				name: "Economy",
				price: 300,
			});
			await controller.addRate({
				zoneId: zone.id,
				name: "Standard",
				price: 800,
			});

			const rates = await controller.calculateRates({
				country: "US",
				orderAmount: 1000,
			});
			expect(rates[0].price).toBe(300);
			expect(rates[1].price).toBe(800);
			expect(rates[2].price).toBe(2000);
		});
	});
});
