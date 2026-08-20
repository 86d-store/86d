import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { TaxController } from "../service";
import { createTaxController } from "../service-impl";

/**
 * Security regression tests for the tax module.
 *
 * Tax calculations directly impact revenue — incorrect rates, missing
 * exemption enforcement, or rounding errors can cause financial loss or
 * compliance violations. These tests verify:
 * - Tax rate validation: negative rates, extreme bounds, zero-amount items
 * - Region isolation: rates from one jurisdiction never leak into another
 * - Tax class integrity: category-specific rates only apply to their category
 * - Calculation accuracy: rounding edge cases, compound stacking
 * - Exemption enforcement: expired, category-scoped, and customer-scoped
 * - Disabled rate exclusion: disabled rates must never affect calculations
 */

describe("tax endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: TaxController;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createTaxController(mockData);
	});

	// ── Tax Rate Validation ─────────────────────────────────────────

	describe("tax rate validation", () => {
		it("stores a negative rate without implicit clamping", async () => {
			// The controller does not validate — endpoints must reject negative rates.
			// This documents the current behavior so the API layer can enforce bounds.
			const rate = await controller.createRate({
				name: "Negative Rate",
				country: "US",
				state: "CA",
				rate: -0.05,
			});
			expect(rate.rate).toBe(-0.05);
		});

		it("negative percentage rate produces a tax credit in calculation", async () => {
			await controller.createRate({
				name: "Credit Rate",
				country: "US",
				state: "CA",
				rate: -0.1,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});

			// Negative rate creates a negative tax — callers must guard against this
			expect(result.totalTax).toBe(-10);
			expect(result.lines[0].taxAmount).toBe(-10);
		});

		it("very large rate is accepted and applied literally", async () => {
			await controller.createRate({
				name: "Extreme Rate",
				country: "US",
				state: "TX",
				rate: 9.99,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "TX" },
				lineItems: [{ productId: "p1", amount: 10, quantity: 1 }],
			});

			// 10 * 9.99 = 99.9 — no upper-bound clamping at controller level
			expect(result.totalTax).toBe(99.9);
		});

		it("zero rate produces zero tax", async () => {
			await controller.createRate({
				name: "Zero Rate",
				country: "US",
				state: "OR",
				rate: 0,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "OR" },
				lineItems: [{ productId: "p1", amount: 500, quantity: 1 }],
			});

			expect(result.totalTax).toBe(0);
			expect(result.lines[0].taxAmount).toBe(0);
		});
	});

	// ── Region Isolation ────────────────────────────────────────────

	describe("region isolation", () => {
		it("state-level rate does not apply to a different state", async () => {
			await controller.createRate({
				name: "NY Sales Tax",
				country: "US",
				state: "NY",
				rate: 0.08,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});

			expect(result.totalTax).toBe(0);
			expect(result.lines[0].rateNames).toHaveLength(0);
		});

		it("city-level rate does not leak to a different city in the same state", async () => {
			await controller.createRate({
				name: "LA City Tax",
				country: "US",
				state: "CA",
				city: "Los Angeles",
				rate: 0.0025,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA", city: "San Diego" },
				lineItems: [{ productId: "p1", amount: 1000, quantity: 1 }],
			});

			expect(result.totalTax).toBe(0);
		});

		it("country-level rate does not apply to a different country", async () => {
			await controller.createRate({
				name: "UK VAT",
				country: "GB",
				rate: 0.2,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});

			expect(result.totalTax).toBe(0);
		});

		it("postal-code rate does not apply to adjacent postal code", async () => {
			await controller.createRate({
				name: "Zone Tax",
				country: "US",
				state: "CA",
				postalCode: "90210",
				rate: 0.095,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA", postalCode: "90211" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});

			expect(result.totalTax).toBe(0);
		});

		it("getRatesForAddress never returns rates from other countries", async () => {
			await controller.createRate({
				name: "US Tax",
				country: "US",
				rate: 0.05,
			});
			await controller.createRate({ name: "UK VAT", country: "GB", rate: 0.2 });
			await controller.createRate({
				name: "DE VAT",
				country: "DE",
				rate: 0.19,
			});

			const rates = await controller.getRatesForAddress({
				country: "US",
				state: "CA",
			});

			for (const r of rates) {
				expect(r.country).toBe("US");
			}
		});
	});

	// ── Tax Class Integrity ─────────────────────────────────────────

	describe("tax class integrity", () => {
		it("category-specific rate applies only to matching category items", async () => {
			const clothing = await controller.createCategory({ name: "clothing" });

			await controller.createRate({
				name: "Default Tax",
				country: "US",
				state: "PA",
				rate: 0.06,
			});
			await controller.createRate({
				name: "Clothing Exempt",
				country: "US",
				state: "PA",
				rate: 0,
				categoryId: clothing.id,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "PA" },
				lineItems: [
					{
						productId: "shirt",
						amount: 50,
						quantity: 1,
						categoryId: clothing.id,
					},
					{ productId: "laptop", amount: 1000, quantity: 1 },
				],
			});

			expect(result.lines[0].taxAmount).toBe(0);
			expect(result.lines[1].taxAmount).toBe(60);
		});

		it("deleting a category does not remove rates referencing it", async () => {
			const cat = await controller.createCategory({ name: "food" });
			const rate = await controller.createRate({
				name: "Food Tax",
				country: "US",
				state: "TX",
				rate: 0.02,
				categoryId: cat.id,
			});

			await controller.deleteCategory(cat.id);

			// Rate still exists and references the deleted category
			const fetched = await controller.getRate(rate.id);
			expect(fetched).not.toBeNull();
			expect(fetched?.categoryId).toBe(cat.id);
		});
	});

	// ── Calculation Accuracy / Rounding ─────────────────────────────

	describe("calculation accuracy and rounding", () => {
		it("rounds to 2 decimal places (banker's rounding)", async () => {
			await controller.createRate({
				name: "Odd Rate",
				country: "US",
				state: "CA",
				rate: 0.0725,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 33.33, quantity: 1 }],
			});

			// 33.33 * 0.0725 = 2.416425 → rounded to 2.42
			expect(result.lines[0].taxAmount).toBe(2.42);
		});

		it("handles sub-penny amounts without NaN or Infinity", async () => {
			await controller.createRate({
				name: "Low Rate",
				country: "US",
				state: "CA",
				rate: 0.001,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 0.01, quantity: 1 }],
			});

			expect(Number.isFinite(result.totalTax)).toBe(true);
			expect(Number.isNaN(result.totalTax)).toBe(false);
		});

		it("zero-amount item produces zero tax, not NaN", async () => {
			await controller.createRate({
				name: "CA Tax",
				country: "US",
				state: "CA",
				rate: 0.0725,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "free", amount: 0, quantity: 1 }],
			});

			expect(result.totalTax).toBe(0);
			expect(result.effectiveRate).toBe(0);
			expect(Number.isNaN(result.effectiveRate)).toBe(false);
		});

		it("compound rates stack correctly across priority levels", async () => {
			await controller.createRate({
				name: "Base",
				country: "US",
				state: "CA",
				rate: 0.1,
				priority: 0,
			});
			await controller.createRate({
				name: "Surcharge",
				country: "US",
				state: "CA",
				rate: 0.05,
				priority: 1,
				compound: true,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 200, quantity: 1 }],
			});

			// Base: 200 * 0.1 = 20
			// Compound: (200 + 20) * 0.05 = 11
			// Total: 31
			expect(result.totalTax).toBe(31);
		});

		it("multiple non-compound rates at the same priority are additive", async () => {
			await controller.createRate({
				name: "State Tax",
				country: "US",
				state: "CA",
				rate: 0.06,
				priority: 0,
			});
			await controller.createRate({
				name: "County Tax",
				country: "US",
				state: "CA",
				rate: 0.01,
				priority: 0,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});

			// 100 * 0.06 + 100 * 0.01 = 7
			expect(result.totalTax).toBe(7);
		});
	});

	// ── Exemption Enforcement ───────────────────────────────────────

	describe("exemption enforcement", () => {
		it("full exemption zeroes all line items including shipping", async () => {
			await controller.createRate({
				name: "Tax",
				country: "US",
				state: "TX",
				rate: 0.0825,
			});
			await controller.createExemption({
				customerId: "gov-buyer",
				reason: "Government entity",
			});

			const result = await controller.calculate({
				address: { country: "US", state: "TX" },
				lineItems: [
					{ productId: "p1", amount: 100, quantity: 1 },
					{ productId: "p2", amount: 200, quantity: 2 },
				],
				shippingAmount: 25,
				customerId: "gov-buyer",
			});

			expect(result.totalTax).toBe(0);
			expect(result.shippingTax).toBe(0);
			for (const line of result.lines) {
				expect(line.taxAmount).toBe(0);
			}
		});

		it("expired exemption does not suppress tax", async () => {
			await controller.createRate({
				name: "Tax",
				country: "US",
				state: "CA",
				rate: 0.1,
			});
			await controller.createExemption({
				customerId: "expired-cust",
				expiresAt: new Date("2020-01-01"),
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
				customerId: "expired-cust",
			});

			expect(result.totalTax).toBe(10);
		});

		it("category exemption only suppresses matching category, not others", async () => {
			const food = await controller.createCategory({ name: "food" });

			await controller.createRate({
				name: "TX Tax",
				country: "US",
				state: "TX",
				rate: 0.0825,
			});

			await controller.createExemption({
				customerId: "reseller",
				type: "category",
				categoryId: food.id,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "TX" },
				lineItems: [
					{ productId: "apples", amount: 50, quantity: 1, categoryId: food.id },
					{ productId: "phone", amount: 800, quantity: 1 },
				],
				customerId: "reseller",
			});

			// Food exempt, phone taxed
			expect(result.lines[0].taxAmount).toBe(0);
			expect(result.lines[1].taxAmount).toBe(66);
		});

		it("exemption for one customer does not affect another customer", async () => {
			await controller.createRate({
				name: "Tax",
				country: "US",
				state: "CA",
				rate: 0.1,
			});
			await controller.createExemption({
				customerId: "exempt-cust",
				reason: "Charity",
			});

			const exemptResult = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
				customerId: "exempt-cust",
			});
			const normalResult = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
				customerId: "normal-cust",
			});

			expect(exemptResult.totalTax).toBe(0);
			expect(normalResult.totalTax).toBe(10);
		});

		it("calculation without customerId ignores all exemptions", async () => {
			await controller.createRate({
				name: "Tax",
				country: "US",
				state: "CA",
				rate: 0.1,
			});
			await controller.createExemption({ customerId: "someone" });

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});

			expect(result.totalTax).toBe(10);
		});
	});

	// ── Disabled Rate Exclusion ─────────────────────────────────────

	describe("disabled rate exclusion", () => {
		it("disabled rate is excluded from calculation", async () => {
			await controller.createRate({
				name: "Active",
				country: "US",
				state: "CA",
				rate: 0.05,
				enabled: true,
			});
			await controller.createRate({
				name: "Disabled",
				country: "US",
				state: "CA",
				rate: 0.1,
				enabled: false,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});

			// Only the active 5% rate should apply
			expect(result.totalTax).toBe(5);
		});

		it("disabled rate is excluded from getRatesForAddress", async () => {
			await controller.createRate({
				name: "Active",
				country: "US",
				state: "CA",
				rate: 0.05,
			});
			await controller.createRate({
				name: "Disabled",
				country: "US",
				state: "CA",
				rate: 0.1,
				enabled: false,
			});

			const rates = await controller.getRatesForAddress({
				country: "US",
				state: "CA",
			});

			expect(rates).toHaveLength(1);
			expect(rates[0].name).toBe("Active");
		});

		it("re-enabling a rate makes it apply to calculations again", async () => {
			const rate = await controller.createRate({
				name: "Toggle Rate",
				country: "US",
				state: "CA",
				rate: 0.1,
				enabled: false,
			});

			const before = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});
			expect(before.totalTax).toBe(0);

			await controller.updateRate(rate.id, { enabled: true });

			const after = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});
			expect(after.totalTax).toBe(10);
		});
	});
});
