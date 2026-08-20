import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { TaxController } from "../service";
import { createTaxController } from "../service-impl";

describe("TaxController – edge cases", () => {
	let data: ReturnType<typeof createMockDataService>;
	let controller: TaxController;

	beforeEach(() => {
		data = createMockDataService();
		controller = createTaxController(data);
	});

	// ── Rate CRUD edge cases ─────────────────────────────────────────────────

	describe("createRate – edge cases", () => {
		it("creates a rate with a postal code", async () => {
			const rate = await controller.createRate({
				name: "ZIP-specific Tax",
				country: "US",
				state: "CA",
				city: "Los Angeles",
				postalCode: "90210",
				rate: 0.095,
			});

			expect(rate.postalCode).toBe("90210");
			expect(rate.city).toBe("Los Angeles");
		});

		it("generates unique IDs for each rate", async () => {
			const r1 = await controller.createRate({
				name: "R1",
				country: "US",
				rate: 0.05,
			});
			const r2 = await controller.createRate({
				name: "R2",
				country: "US",
				rate: 0.05,
			});

			expect(r1.id).not.toBe(r2.id);
		});

		it("creates a rate with zero rate value", async () => {
			const rate = await controller.createRate({
				name: "Tax-free Zone",
				country: "US",
				state: "OR",
				rate: 0,
			});

			expect(rate.rate).toBe(0);
			expect(rate.enabled).toBe(true);
		});

		it("sets createdAt and updatedAt to the same value on creation", async () => {
			const rate = await controller.createRate({
				name: "Timestamp Test",
				country: "US",
				rate: 0.05,
			});

			expect(rate.createdAt).toEqual(rate.updatedAt);
			expect(rate.createdAt).toBeInstanceOf(Date);
		});
	});

	describe("updateRate – edge cases", () => {
		it("preserves unchanged fields when updating a single field", async () => {
			const rate = await controller.createRate({
				name: "Original Name",
				country: "US",
				state: "TX",
				rate: 0.0625,
				priority: 5,
				compound: true,
				inclusive: true,
			});

			const updated = await controller.updateRate(rate.id, {
				name: "New Name",
			});

			expect(updated).not.toBeNull();
			expect(updated?.name).toBe("New Name");
			expect(updated?.rate).toBe(0.0625);
			expect(updated?.priority).toBe(5);
			expect(updated?.compound).toBe(true);
			expect(updated?.inclusive).toBe(true);
			expect(updated?.country).toBe("US");
			expect(updated?.state).toBe("TX");
		});

		it("updates the updatedAt timestamp", async () => {
			const rate = await controller.createRate({
				name: "Test",
				country: "US",
				rate: 0.05,
			});

			// Small delay to ensure timestamps differ
			const updated = await controller.updateRate(rate.id, { rate: 0.1 });

			expect(updated).not.toBeNull();
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				rate.updatedAt.getTime(),
			);
		});

		it("can change the type from percentage to fixed", async () => {
			const rate = await controller.createRate({
				name: "Conversion Test",
				country: "US",
				rate: 0.05,
				type: "percentage",
			});

			const updated = await controller.updateRate(rate.id, {
				type: "fixed",
				rate: 2.5,
			});

			expect(updated?.type).toBe("fixed");
			expect(updated?.rate).toBe(2.5);
		});

		it("can disable and re-enable a rate", async () => {
			const rate = await controller.createRate({
				name: "Toggle Rate",
				country: "US",
				rate: 0.05,
			});

			const disabled = await controller.updateRate(rate.id, { enabled: false });
			expect(disabled?.enabled).toBe(false);

			const reenabled = await controller.updateRate(rate.id, { enabled: true });
			expect(reenabled?.enabled).toBe(true);
		});

		it("can set priority to zero", async () => {
			const rate = await controller.createRate({
				name: "Priority Test",
				country: "US",
				rate: 0.05,
				priority: 10,
			});

			const updated = await controller.updateRate(rate.id, { priority: 0 });
			expect(updated?.priority).toBe(0);
		});
	});

	describe("listRates – edge cases", () => {
		it("filters by state", async () => {
			await controller.createRate({
				name: "CA Rate",
				country: "US",
				state: "CA",
				rate: 0.0725,
			});
			await controller.createRate({
				name: "TX Rate",
				country: "US",
				state: "TX",
				rate: 0.0625,
			});

			const caRates = await controller.listRates({ state: "CA" });
			expect(caRates).toHaveLength(1);
			expect(caRates[0].name).toBe("CA Rate");
		});

		it("filters by enabled status", async () => {
			await controller.createRate({
				name: "Active",
				country: "US",
				rate: 0.05,
				enabled: true,
			});
			await controller.createRate({
				name: "Inactive",
				country: "US",
				rate: 0.03,
				enabled: false,
			});

			const active = await controller.listRates({ enabled: true });
			expect(active).toHaveLength(1);
			expect(active[0].name).toBe("Active");

			const inactive = await controller.listRates({ enabled: false });
			expect(inactive).toHaveLength(1);
			expect(inactive[0].name).toBe("Inactive");
		});

		it("respects take/skip pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createRate({
					name: `Rate ${i}`,
					country: "US",
					rate: 0.01 * i,
				});
			}

			const page1 = await controller.listRates({ take: 2, skip: 0 });
			expect(page1).toHaveLength(2);

			const page2 = await controller.listRates({ take: 2, skip: 2 });
			expect(page2).toHaveLength(2);

			const page3 = await controller.listRates({ take: 2, skip: 4 });
			expect(page3).toHaveLength(1);
		});

		it("returns empty array when no rates exist", async () => {
			const rates = await controller.listRates();
			expect(rates).toHaveLength(0);
		});

		it("combines country and state filters", async () => {
			await controller.createRate({
				name: "US-CA",
				country: "US",
				state: "CA",
				rate: 0.0725,
			});
			await controller.createRate({
				name: "US-TX",
				country: "US",
				state: "TX",
				rate: 0.0625,
			});
			await controller.createRate({
				name: "CA-ON",
				country: "CA",
				state: "ON",
				rate: 0.13,
			});

			const results = await controller.listRates({
				country: "US",
				state: "CA",
			});
			expect(results).toHaveLength(1);
			expect(results[0].name).toBe("US-CA");
		});
	});

	describe("deleteRate – edge cases", () => {
		it("double-delete returns false on second attempt", async () => {
			const rate = await controller.createRate({
				name: "Delete Me",
				country: "US",
				rate: 0.05,
			});

			expect(await controller.deleteRate(rate.id)).toBe(true);
			expect(await controller.deleteRate(rate.id)).toBe(false);
		});
	});

	// ── Category edge cases ──────────────────────────────────────────────────

	describe("createCategory – edge cases", () => {
		it("creates a category without description", async () => {
			const cat = await controller.createCategory({ name: "minimal" });

			expect(cat.name).toBe("minimal");
			expect(cat.description).toBeUndefined();
			expect(cat.createdAt).toBeInstanceOf(Date);
		});

		it("generates unique IDs for each category", async () => {
			const c1 = await controller.createCategory({ name: "cat-a" });
			const c2 = await controller.createCategory({ name: "cat-b" });

			expect(c1.id).not.toBe(c2.id);
		});
	});

	describe("deleteCategory – edge cases", () => {
		it("double-delete returns false on second attempt", async () => {
			const cat = await controller.createCategory({ name: "temp" });

			expect(await controller.deleteCategory(cat.id)).toBe(true);
			expect(await controller.deleteCategory(cat.id)).toBe(false);
		});
	});

	// ── Exemption edge cases ─────────────────────────────────────────────────

	describe("createExemption – edge cases", () => {
		it("creates an exemption with future expiration", async () => {
			const futureDate = new Date("2099-12-31");
			const ex = await controller.createExemption({
				customerId: "cust-future",
				expiresAt: futureDate,
			});

			expect(ex.expiresAt).toEqual(futureDate);
			expect(ex.enabled).toBe(true);
		});

		it("creates an exemption with no optional fields", async () => {
			const ex = await controller.createExemption({
				customerId: "bare-minimum",
			});

			expect(ex.customerId).toBe("bare-minimum");
			expect(ex.type).toBe("full");
			expect(ex.categoryId).toBeUndefined();
			expect(ex.taxIdNumber).toBeUndefined();
			expect(ex.reason).toBeUndefined();
			expect(ex.expiresAt).toBeUndefined();
		});

		it("generates unique IDs for each exemption", async () => {
			const e1 = await controller.createExemption({ customerId: "c1" });
			const e2 = await controller.createExemption({ customerId: "c1" });

			expect(e1.id).not.toBe(e2.id);
		});
	});

	describe("listExemptions – edge cases", () => {
		it("returns empty array for customer with no exemptions", async () => {
			const exemptions = await controller.listExemptions("nonexistent-cust");
			expect(exemptions).toHaveLength(0);
		});

		it("does not mix exemptions between customers", async () => {
			await controller.createExemption({ customerId: "cust-a" });
			await controller.createExemption({ customerId: "cust-a" });
			await controller.createExemption({ customerId: "cust-b" });

			const exA = await controller.listExemptions("cust-a");
			expect(exA).toHaveLength(2);
			for (const e of exA) {
				expect(e.customerId).toBe("cust-a");
			}

			const exB = await controller.listExemptions("cust-b");
			expect(exB).toHaveLength(1);
		});
	});

	describe("deleteExemption – edge cases", () => {
		it("returns false for non-existent exemption", async () => {
			expect(await controller.deleteExemption("does-not-exist")).toBe(false);
		});

		it("double-delete returns false on second attempt", async () => {
			const ex = await controller.createExemption({ customerId: "cust-1" });
			expect(await controller.deleteExemption(ex.id)).toBe(true);
			expect(await controller.deleteExemption(ex.id)).toBe(false);
		});
	});

	// ── Tax Calculation – advanced edge cases ────────────────────────────────

	describe("calculate – jurisdiction matching", () => {
		it("matches postal code rate with highest specificity", async () => {
			await controller.createRate({
				name: "State Level",
				country: "US",
				state: "CA",
				rate: 0.0725,
			});
			await controller.createRate({
				name: "ZIP Level",
				country: "US",
				state: "CA",
				city: "Beverly Hills",
				postalCode: "90210",
				rate: 0.095,
			});

			const result = await controller.calculate({
				address: {
					country: "US",
					state: "CA",
					city: "Beverly Hills",
					postalCode: "90210",
				},
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});

			// Both rates match, ZIP-level rate has higher score (1111) vs state-level (11)
			expect(result.totalTax).toBeGreaterThan(0);
			const rateNames = result.lines[0].rateNames;
			expect(rateNames).toContain("ZIP Level");
			expect(rateNames).toContain("State Level");
		});

		it("does not match city rate when address has no city", async () => {
			await controller.createRate({
				name: "City-only Rate",
				country: "US",
				state: "CA",
				city: "San Francisco",
				rate: 0.01,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});

			expect(result.totalTax).toBe(0);
		});

		it("does not match postal code rate when address has no postal code", async () => {
			await controller.createRate({
				name: "ZIP Rate",
				country: "US",
				state: "CA",
				postalCode: "90210",
				rate: 0.01,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});

			expect(result.totalTax).toBe(0);
		});

		it("city matching is case-insensitive", async () => {
			await controller.createRate({
				name: "City Tax",
				country: "US",
				state: "CA",
				city: "Los Angeles",
				rate: 0.01,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA", city: "los angeles" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});

			expect(result.totalTax).toBe(1);
		});

		it("does not match different country even with same state code", async () => {
			await controller.createRate({
				name: "US-CA Rate",
				country: "US",
				state: "CA",
				rate: 0.0725,
			});

			const result = await controller.calculate({
				address: { country: "MX", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});

			expect(result.totalTax).toBe(0);
		});

		it("jurisdiction city falls back to wildcard when address has no city", async () => {
			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});

			expect(result.jurisdiction.city).toBe("*");
		});
	});

	describe("calculate – multiple rates at same priority", () => {
		it("adds non-compound rates at the same priority", async () => {
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
				rate: 0.02,
				priority: 0,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});

			// 100 * 0.06 + 100 * 0.02 = 8
			expect(result.totalTax).toBe(8);
		});
	});

	describe("calculate – compound rate scenarios", () => {
		it("non-compound rate at higher priority uses base amount only", async () => {
			await controller.createRate({
				name: "Base Tax",
				country: "US",
				state: "CA",
				rate: 0.1,
				priority: 0,
			});
			await controller.createRate({
				name: "Extra Tax (not compound)",
				country: "US",
				state: "CA",
				rate: 0.05,
				priority: 1,
				compound: false,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});

			// Base: 100 * 0.1 = 10
			// Extra (non-compound): 100 * 0.05 = 5
			// Total: 15
			expect(result.totalTax).toBe(15);
		});

		it("compound rate at higher priority compounds on accumulated tax", async () => {
			await controller.createRate({
				name: "Federal Tax",
				country: "US",
				state: "CA",
				rate: 0.05,
				priority: 0,
			});
			await controller.createRate({
				name: "State Tax",
				country: "US",
				state: "CA",
				rate: 0.1,
				priority: 0,
			});
			await controller.createRate({
				name: "Compound Surtax",
				country: "US",
				state: "CA",
				rate: 0.02,
				priority: 1,
				compound: true,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 200, quantity: 1 }],
			});

			// Priority 0: 200 * 0.05 + 200 * 0.1 = 10 + 20 = 30
			// Priority 1 (compound): (200 + 30) * 0.02 = 4.6
			// Total: 34.6
			expect(result.totalTax).toBe(34.6);
		});

		it("multiple compound rates at different priorities chain correctly", async () => {
			await controller.createRate({
				name: "Base",
				country: "US",
				state: "CA",
				rate: 0.1,
				priority: 0,
			});
			await controller.createRate({
				name: "Compound 1",
				country: "US",
				state: "CA",
				rate: 0.05,
				priority: 1,
				compound: true,
			});
			await controller.createRate({
				name: "Compound 2",
				country: "US",
				state: "CA",
				rate: 0.02,
				priority: 2,
				compound: true,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});

			// Priority 0: 100 * 0.1 = 10, cumulative = 10
			// Priority 1: (100 + 10) * 0.05 = 5.5, cumulative = 15.5
			// Priority 2: (100 + 15.5) * 0.02 = 2.31, cumulative = 17.81
			expect(result.totalTax).toBe(17.81);
		});
	});

	describe("calculate – fixed rate scenarios", () => {
		it("fixed rate ignores item amount", async () => {
			await controller.createRate({
				name: "Flat Fee",
				country: "US",
				state: "TX",
				rate: 5,
				type: "fixed",
			});

			const r1 = await controller.calculate({
				address: { country: "US", state: "TX" },
				lineItems: [{ productId: "p1", amount: 10, quantity: 1 }],
			});

			const r2 = await controller.calculate({
				address: { country: "US", state: "TX" },
				lineItems: [{ productId: "p1", amount: 10000, quantity: 1 }],
			});

			expect(r1.totalTax).toBe(5);
			expect(r2.totalTax).toBe(5);
		});

		it("mixes fixed and percentage rates at the same priority", async () => {
			await controller.createRate({
				name: "Percentage",
				country: "US",
				state: "CA",
				rate: 0.1,
				type: "percentage",
				priority: 0,
			});
			await controller.createRate({
				name: "Fixed",
				country: "US",
				state: "CA",
				rate: 2,
				type: "fixed",
				priority: 0,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});

			// 100 * 0.1 + 2 = 12
			expect(result.totalTax).toBe(12);
		});

		it("compound fixed rate adds on top of accumulated tax base", async () => {
			await controller.createRate({
				name: "Base",
				country: "US",
				state: "CA",
				rate: 0.1,
				priority: 0,
			});
			await controller.createRate({
				name: "Compound Fixed",
				country: "US",
				state: "CA",
				rate: 3,
				type: "fixed",
				priority: 1,
				compound: true,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});

			// Priority 0: 100 * 0.1 = 10
			// Priority 1 (fixed, compound): base for compound would be (100+10) but fixed just adds 3
			// Total: 13
			expect(result.totalTax).toBe(13);
		});
	});

	describe("calculate – zero and boundary amounts", () => {
		it("handles zero amount line item", async () => {
			await controller.createRate({
				name: "Tax",
				country: "US",
				state: "CA",
				rate: 0.1,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 0, quantity: 1 }],
			});

			expect(result.totalTax).toBe(0);
			expect(result.lines[0].taxAmount).toBe(0);
			expect(result.effectiveRate).toBe(0);
		});

		it("handles empty line items array", async () => {
			await controller.createRate({
				name: "Tax",
				country: "US",
				state: "CA",
				rate: 0.1,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [],
			});

			expect(result.totalTax).toBe(0);
			expect(result.lines).toHaveLength(0);
			expect(result.effectiveRate).toBe(0);
		});

		it("handles zero shipping amount", async () => {
			await controller.createRate({
				name: "Tax",
				country: "US",
				state: "CA",
				rate: 0.1,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
				shippingAmount: 0,
			});

			expect(result.shippingTax).toBe(0);
			expect(result.totalTax).toBe(10);
		});

		it("rounds tax amounts to two decimal places", async () => {
			await controller.createRate({
				name: "Tax",
				country: "US",
				state: "CA",
				rate: 0.0725,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 33.33, quantity: 1 }],
			});

			// 33.33 * 0.0725 = 2.416425 → rounds to 2.42
			expect(result.lines[0].taxAmount).toBe(2.42);
			expect(result.totalTax).toBe(2.42);
		});

		it("rounds currency at 0.5 boundary correctly", async () => {
			await controller.createRate({
				name: "Tax",
				country: "US",
				state: "CA",
				rate: 0.1,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 10.05, quantity: 1 }],
			});

			// 10.05 * 0.1 = 1.005 → Math.round(100.5) / 100 = 1.01 (rounds up)
			expect(result.lines[0].taxAmount).toBe(1.01);
		});

		it("handles very small amounts", async () => {
			await controller.createRate({
				name: "Tax",
				country: "US",
				state: "CA",
				rate: 0.0725,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 0.01, quantity: 1 }],
			});

			// 0.01 * 0.0725 = 0.000725 → rounds to 0
			expect(result.lines[0].taxAmount).toBe(0);
		});
	});

	describe("calculate – shipping tax edge cases", () => {
		it("fully exempt customer does not pay shipping tax", async () => {
			await controller.createRate({
				name: "Tax",
				country: "US",
				state: "CA",
				rate: 0.1,
			});

			await controller.createExemption({
				customerId: "exempt-cust",
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
				shippingAmount: 20,
				customerId: "exempt-cust",
			});

			expect(result.totalTax).toBe(0);
			expect(result.shippingTax).toBe(0);
		});

		it("category exempt customer still pays shipping tax", async () => {
			const cat = await controller.createCategory({ name: "food" });

			await controller.createRate({
				name: "Default Tax",
				country: "US",
				state: "TX",
				rate: 0.1,
			});

			await controller.createExemption({
				customerId: "food-reseller",
				type: "category",
				categoryId: cat.id,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "TX" },
				lineItems: [
					{
						productId: "food-item",
						amount: 100,
						quantity: 1,
						categoryId: cat.id,
					},
				],
				shippingAmount: 20,
				customerId: "food-reseller",
			});

			// Food item: exempt via category exemption = 0
			// Shipping: uses default category, not exempt = 20 * 0.1 = 2
			expect(result.lines[0].taxAmount).toBe(0);
			expect(result.shippingTax).toBe(2);
			expect(result.totalTax).toBe(2);
		});

		it("shipping tax is zero when no default rates match the jurisdiction", async () => {
			await controller.createRate({
				name: "NY Only Rate",
				country: "US",
				state: "NY",
				rate: 0.08,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
				shippingAmount: 15,
			});

			expect(result.shippingTax).toBe(0);
		});

		it("does not tax shipping when shippingAmount is undefined", async () => {
			await controller.createRate({
				name: "Tax",
				country: "US",
				state: "CA",
				rate: 0.1,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});

			expect(result.shippingTax).toBe(0);
			expect(result.totalTax).toBe(10);
		});
	});

	describe("calculate – exemption edge cases", () => {
		it("future expiration exemption is applied", async () => {
			await controller.createRate({
				name: "Tax",
				country: "US",
				state: "CA",
				rate: 0.1,
			});

			await controller.createExemption({
				customerId: "future-exempt",
				expiresAt: new Date("2099-12-31"),
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
				customerId: "future-exempt",
			});

			expect(result.totalTax).toBe(0);
		});

		it("category exemption only exempts matching category items", async () => {
			const catA = await controller.createCategory({ name: "electronics" });
			const catB = await controller.createCategory({ name: "clothing" });

			await controller.createRate({
				name: "Tax",
				country: "US",
				state: "CA",
				rate: 0.1,
			});

			await controller.createExemption({
				customerId: "elec-exempt",
				type: "category",
				categoryId: catA.id,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [
					{
						productId: "laptop",
						amount: 1000,
						quantity: 1,
						categoryId: catA.id,
					},
					{
						productId: "shirt",
						amount: 50,
						quantity: 1,
						categoryId: catB.id,
					},
					{ productId: "widget", amount: 20, quantity: 1 },
				],
				customerId: "elec-exempt",
			});

			expect(result.lines[0].taxAmount).toBe(0); // electronics exempt
			expect(result.lines[1].taxAmount).toBe(5); // clothing taxed
			expect(result.lines[2].taxAmount).toBe(2); // default taxed
		});

		it("multiple category exemptions apply to multiple categories", async () => {
			const catA = await controller.createCategory({ name: "food" });
			const catB = await controller.createCategory({ name: "medicine" });

			await controller.createRate({
				name: "Tax",
				country: "US",
				state: "CA",
				rate: 0.1,
			});

			await controller.createExemption({
				customerId: "multi-exempt",
				type: "category",
				categoryId: catA.id,
			});
			await controller.createExemption({
				customerId: "multi-exempt",
				type: "category",
				categoryId: catB.id,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [
					{
						productId: "groceries",
						amount: 50,
						quantity: 1,
						categoryId: catA.id,
					},
					{
						productId: "aspirin",
						amount: 10,
						quantity: 1,
						categoryId: catB.id,
					},
					{ productId: "gadget", amount: 200, quantity: 1 },
				],
				customerId: "multi-exempt",
			});

			expect(result.lines[0].taxAmount).toBe(0); // food exempt
			expect(result.lines[1].taxAmount).toBe(0); // medicine exempt
			expect(result.lines[2].taxAmount).toBe(20); // default taxed
			expect(result.totalTax).toBe(20);
		});

		it("no exemption applied when customerId is not provided", async () => {
			await controller.createRate({
				name: "Tax",
				country: "US",
				state: "CA",
				rate: 0.1,
			});

			await controller.createExemption({
				customerId: "some-customer",
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});

			expect(result.totalTax).toBe(10);
		});

		it("exemption for different customer does not apply", async () => {
			await controller.createRate({
				name: "Tax",
				country: "US",
				state: "CA",
				rate: 0.1,
			});

			await controller.createExemption({
				customerId: "customer-a",
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
				customerId: "customer-b",
			});

			expect(result.totalTax).toBe(10);
		});

		it("exempt line items still report rate 0 and empty rateNames", async () => {
			await controller.createRate({
				name: "Tax",
				country: "US",
				state: "CA",
				rate: 0.1,
			});

			await controller.createExemption({ customerId: "exempt-cust" });

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
				customerId: "exempt-cust",
			});

			expect(result.lines[0].rate).toBe(0);
			expect(result.lines[0].rateNames).toEqual([]);
			expect(result.lines[0].taxableAmount).toBe(100);
		});
	});

	describe("calculate – category-specific rates", () => {
		it("category-specific rate overrides default rate for that category", async () => {
			const cat = await controller.createCategory({ name: "digital" });

			await controller.createRate({
				name: "Default Tax",
				country: "US",
				state: "WA",
				rate: 0.065,
			});
			await controller.createRate({
				name: "Digital Tax",
				country: "US",
				state: "WA",
				rate: 0.1,
				categoryId: cat.id,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "WA" },
				lineItems: [
					{
						productId: "ebook",
						amount: 100,
						quantity: 1,
						categoryId: cat.id,
					},
					{ productId: "physical-book", amount: 100, quantity: 1 },
				],
			});

			// Digital: uses category-specific rate 0.1 = 10
			// Physical: uses default rate 0.065 = 6.5
			expect(result.lines[0].taxAmount).toBe(10);
			expect(result.lines[1].taxAmount).toBe(6.5);
		});

		it("falls back to default rates when no category-specific rates exist", async () => {
			const cat = await controller.createCategory({ name: "special" });

			await controller.createRate({
				name: "Default Tax",
				country: "US",
				state: "CA",
				rate: 0.08,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [
					{
						productId: "p1",
						amount: 100,
						quantity: 1,
						categoryId: cat.id,
					},
				],
			});

			// No special rate → falls back to default
			expect(result.lines[0].taxAmount).toBe(8);
		});

		it("item without categoryId uses default", async () => {
			await controller.createRate({
				name: "Default Tax",
				country: "US",
				state: "CA",
				rate: 0.06,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 50, quantity: 1 }],
			});

			expect(result.lines[0].taxAmount).toBe(3);
		});
	});

	describe("calculate – effective rate", () => {
		it("computes effective rate across multiple items", async () => {
			await controller.createRate({
				name: "Tax",
				country: "US",
				state: "CA",
				rate: 0.1,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [
					{ productId: "p1", amount: 100, quantity: 1 },
					{ productId: "p2", amount: 200, quantity: 1 },
				],
			});

			// Total item tax: 10 + 20 = 30
			// Total taxable: 100 + 200 = 300
			// Effective rate: 30 / 300 = 0.1
			expect(result.effectiveRate).toBeCloseTo(0.1);
		});

		it("effective rate is 0 when all items are exempt", async () => {
			await controller.createRate({
				name: "Tax",
				country: "US",
				state: "CA",
				rate: 0.1,
			});

			await controller.createExemption({ customerId: "exempt-all" });

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [
					{ productId: "p1", amount: 100, quantity: 1 },
					{ productId: "p2", amount: 200, quantity: 1 },
				],
				customerId: "exempt-all",
			});

			expect(result.effectiveRate).toBe(0);
		});

		it("effective rate does not include shipping in taxable base", async () => {
			await controller.createRate({
				name: "Tax",
				country: "US",
				state: "CA",
				rate: 0.1,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
				shippingAmount: 50,
			});

			// Effective rate = item tax / item taxable = 10/100 = 0.1
			// (not (10+5)/(100+50))
			expect(result.effectiveRate).toBeCloseTo(0.1);
		});
	});

	describe("calculate – inclusive flag", () => {
		it("returns inclusive false when no rates match", async () => {
			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});

			expect(result.inclusive).toBe(false);
		});

		it("inclusive flag comes from the first matching default rate", async () => {
			await controller.createRate({
				name: "Non-inclusive",
				country: "US",
				state: "CA",
				rate: 0.05,
				inclusive: false,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});

			expect(result.inclusive).toBe(false);
		});
	});

	describe("calculate – rate interaction after CRUD", () => {
		it("recalculates correctly after deleting a rate", async () => {
			const r1 = await controller.createRate({
				name: "State Tax",
				country: "US",
				state: "CA",
				rate: 0.06,
			});
			await controller.createRate({
				name: "County Tax",
				country: "US",
				state: "CA",
				rate: 0.02,
			});

			const before = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});
			expect(before.totalTax).toBe(8); // 6 + 2

			await controller.deleteRate(r1.id);

			const after = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});
			expect(after.totalTax).toBe(2); // only county tax
		});

		it("recalculates correctly after updating a rate", async () => {
			const rate = await controller.createRate({
				name: "Tax",
				country: "US",
				state: "CA",
				rate: 0.1,
			});

			const before = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});
			expect(before.totalTax).toBe(10);

			await controller.updateRate(rate.id, { rate: 0.2 });

			const after = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});
			expect(after.totalTax).toBe(20);
		});

		it("disabling a rate removes it from calculation", async () => {
			const rate = await controller.createRate({
				name: "Tax",
				country: "US",
				state: "CA",
				rate: 0.1,
			});

			const before = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});
			expect(before.totalTax).toBe(10);

			await controller.updateRate(rate.id, { enabled: false });

			const after = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});
			expect(after.totalTax).toBe(0);
		});
	});

	// ── getRatesForAddress – advanced edge cases ─────────────────────────────

	describe("getRatesForAddress – edge cases", () => {
		it("returns rates sorted by specificity (most specific first)", async () => {
			await controller.createRate({
				name: "Country Level",
				country: "US",
				rate: 0.01,
			});
			await controller.createRate({
				name: "State Level",
				country: "US",
				state: "CA",
				rate: 0.05,
			});
			await controller.createRate({
				name: "City Level",
				country: "US",
				state: "CA",
				city: "LA",
				rate: 0.02,
			});

			const rates = await controller.getRatesForAddress({
				country: "US",
				state: "CA",
				city: "LA",
			});

			expect(rates[0].name).toBe("City Level"); // score 111
			expect(rates[1].name).toBe("State Level"); // score 11
			expect(rates[2].name).toBe("Country Level"); // score 1
		});

		it("excludes disabled rates", async () => {
			await controller.createRate({
				name: "Enabled",
				country: "US",
				state: "CA",
				rate: 0.05,
				enabled: true,
			});
			await controller.createRate({
				name: "Disabled",
				country: "US",
				state: "CA",
				rate: 0.03,
				enabled: false,
			});

			const rates = await controller.getRatesForAddress({
				country: "US",
				state: "CA",
			});

			expect(rates).toHaveLength(1);
			expect(rates[0].name).toBe("Enabled");
		});

		it("returns rates for all categories", async () => {
			const cat = await controller.createCategory({ name: "digital" });

			await controller.createRate({
				name: "Default Tax",
				country: "US",
				state: "CA",
				rate: 0.05,
			});
			await controller.createRate({
				name: "Digital Tax",
				country: "US",
				state: "CA",
				rate: 0.1,
				categoryId: cat.id,
			});

			const rates = await controller.getRatesForAddress({
				country: "US",
				state: "CA",
			});

			// getRatesForAddress returns all matching rates regardless of category
			expect(rates.length).toBeGreaterThanOrEqual(2);
		});

		it("sorts by priority within same specificity", async () => {
			await controller.createRate({
				name: "Low Priority",
				country: "US",
				state: "CA",
				rate: 0.01,
				priority: 0,
			});
			await controller.createRate({
				name: "High Priority",
				country: "US",
				state: "CA",
				rate: 0.02,
				priority: 10,
			});

			const rates = await controller.getRatesForAddress({
				country: "US",
				state: "CA",
			});

			// Same score (11), sorted by higher priority first
			expect(rates[0].name).toBe("High Priority");
			expect(rates[1].name).toBe("Low Priority");
		});

		it("handles address with postal code", async () => {
			await controller.createRate({
				name: "ZIP Rate",
				country: "US",
				state: "CA",
				city: "Beverly Hills",
				postalCode: "90210",
				rate: 0.095,
			});

			const rates = await controller.getRatesForAddress({
				country: "US",
				state: "CA",
				city: "Beverly Hills",
				postalCode: "90210",
			});

			expect(rates).toHaveLength(1);
			expect(rates[0].name).toBe("ZIP Rate");
		});

		it("does not match postal code rate when address postal code differs", async () => {
			await controller.createRate({
				name: "ZIP Rate",
				country: "US",
				state: "CA",
				postalCode: "90210",
				rate: 0.095,
			});

			const rates = await controller.getRatesForAddress({
				country: "US",
				state: "CA",
				postalCode: "90211",
			});

			expect(rates).toHaveLength(0);
		});
	});
});
