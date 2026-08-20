import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { TaxController } from "../service";
import { createTaxController } from "../service-impl";

describe("TaxController", () => {
	let data: ReturnType<typeof createMockDataService>;
	let controller: TaxController;

	beforeEach(() => {
		data = createMockDataService();
		controller = createTaxController(data);
	});

	// ── Tax Rates ─────────────────────────────────────────────────────────────

	describe("createRate", () => {
		it("creates a tax rate with defaults", async () => {
			const rate = await controller.createRate({
				name: "California Sales Tax",
				country: "US",
				state: "CA",
				rate: 0.0725,
			});

			expect(rate.id).toBeDefined();
			expect(rate.name).toBe("California Sales Tax");
			expect(rate.country).toBe("US");
			expect(rate.state).toBe("CA");
			expect(rate.city).toBe("*");
			expect(rate.postalCode).toBe("*");
			expect(rate.rate).toBe(0.0725);
			expect(rate.type).toBe("percentage");
			expect(rate.categoryId).toBe("default");
			expect(rate.enabled).toBe(true);
			expect(rate.priority).toBe(0);
			expect(rate.compound).toBe(false);
			expect(rate.inclusive).toBe(false);
		});

		it("creates a rate with custom category and fixed type", async () => {
			const rate = await controller.createRate({
				name: "Digital Goods Flat Tax",
				country: "US",
				rate: 1.5,
				type: "fixed",
				categoryId: "digital",
				priority: 1,
				compound: true,
				inclusive: true,
			});

			expect(rate.type).toBe("fixed");
			expect(rate.categoryId).toBe("digital");
			expect(rate.priority).toBe(1);
			expect(rate.compound).toBe(true);
			expect(rate.inclusive).toBe(true);
		});

		it("creates a city-level rate", async () => {
			const rate = await controller.createRate({
				name: "Los Angeles City Tax",
				country: "US",
				state: "CA",
				city: "Los Angeles",
				rate: 0.0025,
			});

			expect(rate.city).toBe("Los Angeles");
			expect(rate.state).toBe("CA");
		});
	});

	describe("getRate", () => {
		it("retrieves an existing rate", async () => {
			const created = await controller.createRate({
				name: "Test Rate",
				country: "US",
				rate: 0.05,
			});
			const fetched = await controller.getRate(created.id);
			expect(fetched).toEqual(created);
		});

		it("returns null for non-existent rate", async () => {
			const result = await controller.getRate("nonexistent");
			expect(result).toBeNull();
		});
	});

	describe("listRates", () => {
		it("lists all rates", async () => {
			await controller.createRate({
				name: "Rate 1",
				country: "US",
				rate: 0.05,
			});
			await controller.createRate({
				name: "Rate 2",
				country: "CA",
				rate: 0.13,
			});

			const rates = await controller.listRates();
			expect(rates).toHaveLength(2);
		});

		it("filters by country", async () => {
			await controller.createRate({
				name: "US Rate",
				country: "US",
				rate: 0.05,
			});
			await controller.createRate({
				name: "CA Rate",
				country: "CA",
				rate: 0.13,
			});

			const usRates = await controller.listRates({ country: "US" });
			expect(usRates).toHaveLength(1);
			expect(usRates[0].country).toBe("US");
		});
	});

	describe("updateRate", () => {
		it("updates rate fields", async () => {
			const rate = await controller.createRate({
				name: "Original",
				country: "US",
				rate: 0.05,
			});

			const updated = await controller.updateRate(rate.id, {
				name: "Updated",
				rate: 0.08,
				enabled: false,
			});

			expect(updated).not.toBeNull();
			expect(updated?.name).toBe("Updated");
			expect(updated?.rate).toBe(0.08);
			expect(updated?.enabled).toBe(false);
		});

		it("returns null for non-existent rate", async () => {
			const result = await controller.updateRate("nonexistent", { rate: 0.1 });
			expect(result).toBeNull();
		});
	});

	describe("deleteRate", () => {
		it("deletes an existing rate", async () => {
			const rate = await controller.createRate({
				name: "To Delete",
				country: "US",
				rate: 0.05,
			});
			const deleted = await controller.deleteRate(rate.id);
			expect(deleted).toBe(true);

			const fetched = await controller.getRate(rate.id);
			expect(fetched).toBeNull();
		});

		it("returns false for non-existent rate", async () => {
			const result = await controller.deleteRate("nonexistent");
			expect(result).toBe(false);
		});
	});

	// ── Tax Categories ────────────────────────────────────────────────────────

	describe("createCategory", () => {
		it("creates a tax category", async () => {
			const cat = await controller.createCategory({
				name: "clothing",
				description: "Apparel and clothing items",
			});

			expect(cat.id).toBeDefined();
			expect(cat.name).toBe("clothing");
			expect(cat.description).toBe("Apparel and clothing items");
		});
	});

	describe("getCategory", () => {
		it("retrieves an existing category", async () => {
			const cat = await controller.createCategory({
				name: "electronics",
				description: "Electronic goods",
			});
			const fetched = await controller.getCategory(cat.id);
			expect(fetched).not.toBeNull();
			expect(fetched?.id).toBe(cat.id);
			expect(fetched?.name).toBe("electronics");
			expect(fetched?.description).toBe("Electronic goods");
		});

		it("returns null for non-existent category", async () => {
			const result = await controller.getCategory("nonexistent");
			expect(result).toBeNull();
		});
	});

	describe("listCategories", () => {
		it("lists all categories", async () => {
			await controller.createCategory({ name: "clothing" });
			await controller.createCategory({ name: "food" });
			await controller.createCategory({ name: "digital" });

			const categories = await controller.listCategories();
			expect(categories).toHaveLength(3);
		});
	});

	describe("deleteCategory", () => {
		it("deletes an existing category", async () => {
			const cat = await controller.createCategory({ name: "test" });
			expect(await controller.deleteCategory(cat.id)).toBe(true);
			expect(await controller.getCategory(cat.id)).toBeNull();
		});

		it("returns false for non-existent", async () => {
			expect(await controller.deleteCategory("nope")).toBe(false);
		});
	});

	// ── Tax Exemptions ────────────────────────────────────────────────────────

	describe("createExemption", () => {
		it("creates a full exemption", async () => {
			const ex = await controller.createExemption({
				customerId: "cust-1",
				taxIdNumber: "US123456789",
				reason: "Government entity",
			});

			expect(ex.id).toBeDefined();
			expect(ex.customerId).toBe("cust-1");
			expect(ex.type).toBe("full");
			expect(ex.taxIdNumber).toBe("US123456789");
			expect(ex.enabled).toBe(true);
		});

		it("creates a category-specific exemption", async () => {
			const ex = await controller.createExemption({
				customerId: "cust-2",
				type: "category",
				categoryId: "food",
				reason: "Reseller",
			});

			expect(ex.type).toBe("category");
			expect(ex.categoryId).toBe("food");
		});
	});

	describe("getExemption", () => {
		it("retrieves an existing exemption", async () => {
			const ex = await controller.createExemption({
				customerId: "cust-1",
				taxIdNumber: "TAX-987654",
				reason: "Diplomatic immunity",
			});
			const fetched = await controller.getExemption(ex.id);
			expect(fetched).not.toBeNull();
			expect(fetched?.id).toBe(ex.id);
			expect(fetched?.customerId).toBe("cust-1");
			expect(fetched?.taxIdNumber).toBe("TAX-987654");
			expect(fetched?.reason).toBe("Diplomatic immunity");
			expect(fetched?.type).toBe("full");
			expect(fetched?.enabled).toBe(true);
		});

		it("returns null for non-existent exemption", async () => {
			const result = await controller.getExemption("nonexistent");
			expect(result).toBeNull();
		});

		it("retrieves a category-specific exemption with all fields", async () => {
			const ex = await controller.createExemption({
				customerId: "cust-3",
				type: "category",
				categoryId: "food",
				reason: "Reseller certificate",
				expiresAt: new Date("2030-12-31"),
			});
			const fetched = await controller.getExemption(ex.id);
			expect(fetched).not.toBeNull();
			expect(fetched?.type).toBe("category");
			expect(fetched?.categoryId).toBe("food");
			expect(fetched?.expiresAt).toEqual(new Date("2030-12-31"));
		});
	});

	describe("listExemptions", () => {
		it("lists exemptions for a customer", async () => {
			await controller.createExemption({ customerId: "cust-1" });
			await controller.createExemption({
				customerId: "cust-1",
				type: "category",
				categoryId: "food",
			});
			await controller.createExemption({ customerId: "cust-2" });

			const exemptions = await controller.listExemptions("cust-1");
			expect(exemptions).toHaveLength(2);
		});
	});

	describe("deleteExemption", () => {
		it("deletes an exemption", async () => {
			const ex = await controller.createExemption({ customerId: "cust-1" });
			expect(await controller.deleteExemption(ex.id)).toBe(true);
			expect(await controller.getExemption(ex.id)).toBeNull();
		});
	});

	// ── Tax Calculation Engine ────────────────────────────────────────────────

	describe("calculate", () => {
		it("marks a line it has no configured rate for as unresolved", async () => {
			// A store that owes tax somewhere but has configured no matching rate has
			// not decided anything. The amount is zero because nothing could be
			// determined, which is not the same as a merchant who deliberately
			// collects nothing, so the line says so and Checkout refuses to sell.
			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});

			expect(result.totalTax).toBe(0);
			expect(result.lines[0].unresolved).toBe(true);
		});

		it("marks shipping with no configured rate as unresolved", async () => {
			// Rates configured only under a specific category leave shipping with no
			// match. The item lines resolve, so a caller checking only lines would
			// sell a zero shipping tax that nothing decided.
			await controller.createRate({
				name: "TX standard",
				country: "US",
				state: "TX",
				rate: 0.0825,
				categoryId: "clothing",
			});

			const result = await controller.calculate({
				address: { country: "US", state: "TX" },
				lineItems: [
					{ productId: "p1", amount: 100, quantity: 1, categoryId: "clothing" },
				],
				shippingAmount: 10,
			});

			expect(result.shippingTax).toBe(0);
			expect(result.shippingUnresolved).toBe(true);
			expect(result.lines[0].unresolved).toBeUndefined();
		});

		it("still returns zero where the merchant declared no nexus", async () => {
			await controller.createNexus({ country: "US", state: "NY" });

			// An explicit nexus list that excludes this address is a real decision.
			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});

			expect(result.totalTax).toBe(0);
			expect(result.lines[0].taxAmount).toBe(0);
		});

		it("calculates simple percentage tax", async () => {
			await controller.createRate({
				name: "CA Sales Tax",
				country: "US",
				state: "CA",
				rate: 0.0725,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});

			expect(result.totalTax).toBe(7.25);
			expect(result.lines[0].taxAmount).toBe(7.25);
			expect(result.lines[0].rate).toBeCloseTo(0.0725);
		});

		it("calculates tax for multiple items", async () => {
			await controller.createRate({
				name: "CA Sales Tax",
				country: "US",
				state: "CA",
				rate: 0.1,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [
					{ productId: "p1", amount: 50, quantity: 2 },
					{ productId: "p2", amount: 30, quantity: 1 },
				],
			});

			expect(result.totalTax).toBe(8); // 5 + 3
			expect(result.lines).toHaveLength(2);
			expect(result.lines[0].taxAmount).toBe(5);
			expect(result.lines[1].taxAmount).toBe(3);
		});

		it("does not apply rates from wrong jurisdiction", async () => {
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
		});

		it("matches country-wide rate when state is wildcard", async () => {
			await controller.createRate({
				name: "UK VAT",
				country: "GB",
				rate: 0.2,
			});

			const result = await controller.calculate({
				address: { country: "GB", state: "ENG" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});

			expect(result.totalTax).toBe(20);
		});

		it("prefers more specific jurisdiction", async () => {
			await controller.createRate({
				name: "US National",
				country: "US",
				rate: 0.05,
			});
			await controller.createRate({
				name: "CA State",
				country: "US",
				state: "CA",
				rate: 0.0725,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});

			// Should get both rates (state + national)
			expect(result.totalTax).toBeGreaterThan(0);
		});

		it("respects city-level rates", async () => {
			await controller.createRate({
				name: "LA City Tax",
				country: "US",
				state: "CA",
				city: "Los Angeles",
				rate: 0.0025,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA", city: "Los Angeles" },
				lineItems: [{ productId: "p1", amount: 1000, quantity: 1 }],
			});

			expect(result.totalTax).toBe(2.5);
		});

		it("applies fixed-rate tax", async () => {
			await controller.createRate({
				name: "Flat Fee",
				country: "US",
				state: "TX",
				rate: 2,
				type: "fixed",
			});

			const result = await controller.calculate({
				address: { country: "US", state: "TX" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});

			expect(result.totalTax).toBe(2);
		});

		it("calculates compound tax", async () => {
			await controller.createRate({
				name: "Base Tax",
				country: "US",
				state: "CA",
				rate: 0.1,
				priority: 0,
			});
			await controller.createRate({
				name: "Surtax",
				country: "US",
				state: "CA",
				rate: 0.05,
				priority: 1,
				compound: true,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});

			// Base: 100 * 0.1 = 10
			// Compound surtax: (100 + 10) * 0.05 = 5.5
			// Total: 15.5
			expect(result.totalTax).toBe(15.5);
		});

		it("calculates shipping tax", async () => {
			await controller.createRate({
				name: "CA Sales Tax",
				country: "US",
				state: "CA",
				rate: 0.1,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
				shippingAmount: 15,
			});

			expect(result.totalTax).toBe(11.5); // item 10 + shipping 1.5
			expect(result.shippingTax).toBe(1.5);
		});

		it("skips disabled rates", async () => {
			await controller.createRate({
				name: "Disabled Rate",
				country: "US",
				state: "CA",
				rate: 0.1,
				enabled: false,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});

			expect(result.totalTax).toBe(0);
		});

		it("respects category-specific rates", async () => {
			const cat = await controller.createCategory({ name: "clothing" });

			await controller.createRate({
				name: "Default Tax",
				country: "US",
				state: "PA",
				rate: 0.06,
			});
			await controller.createRate({
				name: "Clothing Tax",
				country: "US",
				state: "PA",
				rate: 0,
				categoryId: cat.id,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "PA" },
				lineItems: [
					{ productId: "shirt", amount: 50, quantity: 1, categoryId: cat.id },
					{ productId: "gadget", amount: 200, quantity: 1 },
				],
			});

			// Clothing: 0% = $0
			// Gadget: 6% = $12
			expect(result.lines[0].taxAmount).toBe(0);
			expect(result.lines[1].taxAmount).toBe(12);
			expect(result.totalTax).toBe(12);
		});

		it("applies full customer exemption", async () => {
			await controller.createRate({
				name: "TX Sales Tax",
				country: "US",
				state: "TX",
				rate: 0.0825,
			});

			await controller.createExemption({
				customerId: "gov-customer",
				reason: "Government entity",
			});

			const result = await controller.calculate({
				address: { country: "US", state: "TX" },
				lineItems: [{ productId: "p1", amount: 1000, quantity: 1 }],
				customerId: "gov-customer",
			});

			expect(result.totalTax).toBe(0);
		});

		it("applies category-specific customer exemption", async () => {
			const cat = await controller.createCategory({ name: "food" });

			await controller.createRate({
				name: "TX Tax",
				country: "US",
				state: "TX",
				rate: 0.0825,
			});
			await controller.createRate({
				name: "TX Food Tax",
				country: "US",
				state: "TX",
				rate: 0.02,
				categoryId: cat.id,
			});

			await controller.createExemption({
				customerId: "reseller-1",
				type: "category",
				categoryId: cat.id,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "TX" },
				lineItems: [
					{
						productId: "groceries",
						amount: 100,
						quantity: 1,
						categoryId: cat.id,
					},
					{ productId: "electronics", amount: 200, quantity: 1 },
				],
				customerId: "reseller-1",
			});

			// Food exempt for this customer, electronics taxed at default rate
			expect(result.lines[0].taxAmount).toBe(0);
			expect(result.lines[1].taxAmount).toBe(16.5); // 200 * 0.0825
			expect(result.totalTax).toBe(16.5);
		});

		it("ignores expired exemptions", async () => {
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

			expect(result.totalTax).toBe(10); // Not exempt — expired
		});

		it("returns jurisdiction info", async () => {
			await controller.createRate({
				name: "CA Tax",
				country: "US",
				state: "CA",
				rate: 0.0725,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA", city: "San Francisco" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});

			expect(result.jurisdiction.country).toBe("US");
			expect(result.jurisdiction.state).toBe("CA");
			expect(result.jurisdiction.city).toBe("San Francisco");
		});

		it("returns inclusive flag from matching rates", async () => {
			await controller.createRate({
				name: "UK VAT",
				country: "GB",
				rate: 0.2,
				inclusive: true,
			});

			const result = await controller.calculate({
				address: { country: "GB", state: "ENG" },
				lineItems: [{ productId: "p1", amount: 120, quantity: 1 }],
			});

			expect(result.inclusive).toBe(true);
			// Tax-inclusive: 120 / 1.2 = 100 base, tax = 20 (extracted, not added)
			expect(result.totalTax).toBe(20);
		});
	});

	// ── getRatesForAddress ────────────────────────────────────────────────────

	describe("getRatesForAddress", () => {
		it("returns rates matching an address", async () => {
			await controller.createRate({
				name: "CA Tax",
				country: "US",
				state: "CA",
				rate: 0.0725,
			});
			await controller.createRate({
				name: "NY Tax",
				country: "US",
				state: "NY",
				rate: 0.08,
			});
			await controller.createRate({
				name: "US National",
				country: "US",
				rate: 0.01,
			});

			const rates = await controller.getRatesForAddress({
				country: "US",
				state: "CA",
			});
			const names = rates.map((r) => r.name);

			expect(names).toContain("CA Tax");
			expect(names).toContain("US National");
			expect(names).not.toContain("NY Tax");
		});

		it("returns empty array when no rates match", async () => {
			await controller.createRate({
				name: "US Rate",
				country: "US",
				rate: 0.05,
			});

			const rates = await controller.getRatesForAddress({
				country: "JP",
				state: "TK",
			});
			expect(rates).toHaveLength(0);
		});
	});
});
