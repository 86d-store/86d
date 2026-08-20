import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { TaxController } from "../service";
import { createTaxController } from "../service-impl";

describe("TaxController – Nexus Management", () => {
	let data: ReturnType<typeof createMockDataService>;
	let controller: TaxController;

	beforeEach(() => {
		data = createMockDataService();
		controller = createTaxController(data);
	});

	// ── Nexus CRUD ──────────────────────────────────────────────────────────

	describe("createNexus", () => {
		it("creates a nexus with defaults", async () => {
			const nexus = await controller.createNexus({
				country: "US",
				state: "CA",
			});

			expect(nexus.id).toBeDefined();
			expect(nexus.country).toBe("US");
			expect(nexus.state).toBe("CA");
			expect(nexus.type).toBe("physical");
			expect(nexus.enabled).toBe(true);
			expect(nexus.notes).toBeUndefined();
			expect(nexus.createdAt).toBeInstanceOf(Date);
		});

		it("creates a nexus with custom type and notes", async () => {
			const nexus = await controller.createNexus({
				country: "US",
				state: "TX",
				type: "economic",
				notes: "Exceeded $100k sales threshold in 2025",
			});

			expect(nexus.type).toBe("economic");
			expect(nexus.notes).toBe("Exceeded $100k sales threshold in 2025");
		});

		it("creates a country-wide nexus when state is omitted", async () => {
			const nexus = await controller.createNexus({
				country: "GB",
			});

			expect(nexus.country).toBe("GB");
			expect(nexus.state).toBe("*");
		});

		it("creates a voluntary nexus", async () => {
			const nexus = await controller.createNexus({
				country: "CA",
				state: "ON",
				type: "voluntary",
			});

			expect(nexus.type).toBe("voluntary");
		});

		it("generates unique IDs", async () => {
			const n1 = await controller.createNexus({ country: "US", state: "CA" });
			const n2 = await controller.createNexus({ country: "US", state: "NY" });
			expect(n1.id).not.toBe(n2.id);
		});
	});

	describe("getNexus", () => {
		it("retrieves an existing nexus", async () => {
			const created = await controller.createNexus({
				country: "US",
				state: "CA",
				notes: "Main warehouse",
			});
			const fetched = await controller.getNexus(created.id);
			expect(fetched).not.toBeNull();
			expect(fetched?.country).toBe("US");
			expect(fetched?.state).toBe("CA");
			expect(fetched?.notes).toBe("Main warehouse");
		});

		it("returns null for non-existent", async () => {
			const result = await controller.getNexus("nonexistent");
			expect(result).toBeNull();
		});
	});

	describe("listNexus", () => {
		it("lists all nexus records", async () => {
			await controller.createNexus({ country: "US", state: "CA" });
			await controller.createNexus({ country: "US", state: "NY" });
			await controller.createNexus({ country: "CA", state: "ON" });

			const all = await controller.listNexus();
			expect(all).toHaveLength(3);
		});

		it("filters by country", async () => {
			await controller.createNexus({ country: "US", state: "CA" });
			await controller.createNexus({ country: "CA", state: "ON" });

			const usOnly = await controller.listNexus({ country: "US" });
			expect(usOnly).toHaveLength(1);
			expect(usOnly[0].country).toBe("US");
		});

		it("returns empty array when no nexus exists", async () => {
			const result = await controller.listNexus();
			expect(result).toHaveLength(0);
		});
	});

	describe("deleteNexus", () => {
		it("deletes an existing nexus", async () => {
			const nexus = await controller.createNexus({
				country: "US",
				state: "CA",
			});
			expect(await controller.deleteNexus(nexus.id)).toBe(true);
			expect(await controller.getNexus(nexus.id)).toBeNull();
		});

		it("returns false for non-existent", async () => {
			expect(await controller.deleteNexus("nonexistent")).toBe(false);
		});

		it("double-delete returns false", async () => {
			const nexus = await controller.createNexus({ country: "US" });
			expect(await controller.deleteNexus(nexus.id)).toBe(true);
			expect(await controller.deleteNexus(nexus.id)).toBe(false);
		});
	});

	// ── Nexus Enforcement in Tax Calculation ─────────────────────────────────

	describe("hasNexus", () => {
		it("returns true when no nexus records exist (enforcement off)", async () => {
			const result = await controller.hasNexus({
				country: "US",
				state: "CA",
			});
			expect(result).toBe(true);
		});

		it("returns true when nexus exists for exact country + state", async () => {
			await controller.createNexus({ country: "US", state: "CA" });
			const result = await controller.hasNexus({
				country: "US",
				state: "CA",
			});
			expect(result).toBe(true);
		});

		it("returns false when nexus exists but for different state", async () => {
			await controller.createNexus({ country: "US", state: "NY" });
			const result = await controller.hasNexus({
				country: "US",
				state: "CA",
			});
			expect(result).toBe(false);
		});

		it("returns true when country-wide nexus matches", async () => {
			await controller.createNexus({ country: "GB" }); // state = "*"
			const result = await controller.hasNexus({
				country: "GB",
				state: "ENG",
			});
			expect(result).toBe(true);
		});

		it("returns false for different country", async () => {
			await controller.createNexus({ country: "US", state: "CA" });
			const result = await controller.hasNexus({
				country: "CA",
				state: "ON",
			});
			expect(result).toBe(false);
		});

		it("disabled nexus does not count", async () => {
			const nexus = await controller.createNexus({
				country: "US",
				state: "CA",
			});
			// Manually disable by re-creating as disabled
			await data.upsert("taxNexus", nexus.id, {
				...nexus,
				enabled: false,
			} as Record<string, unknown>);

			const result = await controller.hasNexus({
				country: "US",
				state: "CA",
			});
			// There is one nexus record but it's disabled
			expect(result).toBe(false);
		});
	});

	describe("calculate – nexus enforcement", () => {
		it("returns zero tax when nexus exists but not for this jurisdiction", async () => {
			await controller.createNexus({ country: "US", state: "NY" });
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

			expect(result.totalTax).toBe(0);
			expect(result.lines[0].taxAmount).toBe(0);
			expect(result.lines[0].rateNames).toEqual([]);
		});

		it("collects tax when nexus covers the jurisdiction", async () => {
			await controller.createNexus({ country: "US", state: "CA" });
			await controller.createRate({
				name: "CA Sales Tax",
				country: "US",
				state: "CA",
				rate: 0.1,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});

			expect(result.totalTax).toBe(10);
		});

		it("collects tax everywhere when no nexus records exist", async () => {
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

			expect(result.totalTax).toBe(10);
		});

		it("country-wide nexus covers all states", async () => {
			await controller.createNexus({ country: "US" }); // state = "*"
			await controller.createRate({
				name: "TX Tax",
				country: "US",
				state: "TX",
				rate: 0.08,
			});

			const result = await controller.calculate({
				address: { country: "US", state: "TX" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});

			expect(result.totalTax).toBe(8);
		});

		it("nexus enforcement does not affect exemptions", async () => {
			await controller.createNexus({ country: "US", state: "CA" });
			await controller.createRate({
				name: "CA Tax",
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

			expect(result.totalTax).toBe(0);
		});
	});
});

describe("TaxController – Transaction Logging", () => {
	let data: ReturnType<typeof createMockDataService>;
	let controller: TaxController;

	beforeEach(() => {
		data = createMockDataService();
		controller = createTaxController(data);
	});

	describe("logTransaction", () => {
		it("logs a basic tax calculation", async () => {
			await controller.createRate({
				name: "CA Tax",
				country: "US",
				state: "CA",
				rate: 0.1,
			});

			const calculation = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
			});

			const transaction = await controller.logTransaction({
				address: { country: "US", state: "CA" },
				calculation,
				subtotal: 100,
				shippingAmount: 0,
			});

			expect(transaction.id).toBeDefined();
			expect(transaction.country).toBe("US");
			expect(transaction.state).toBe("CA");
			expect(transaction.totalTax).toBe(10);
			expect(transaction.subtotal).toBe(100);
			expect(transaction.shippingAmount).toBe(0);
			expect(transaction.effectiveRate).toBeCloseTo(0.1);
			expect(transaction.inclusive).toBe(false);
			expect(transaction.exempt).toBe(false);
			expect(transaction.rateNames).toContain("CA Tax");
			expect(transaction.lineDetails).toHaveLength(1);
			expect(transaction.createdAt).toBeInstanceOf(Date);
		});

		it("marks exempt transactions", async () => {
			await controller.createRate({
				name: "Tax",
				country: "US",
				state: "CA",
				rate: 0.1,
			});
			await controller.createExemption({ customerId: "gov-cust" });

			const calculation = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
				customerId: "gov-cust",
			});

			const transaction = await controller.logTransaction({
				customerId: "gov-cust",
				address: { country: "US", state: "CA" },
				calculation,
				subtotal: 100,
				shippingAmount: 0,
			});

			expect(transaction.exempt).toBe(true);
			expect(transaction.totalTax).toBe(0);
			expect(transaction.customerId).toBe("gov-cust");
		});

		it("logs with orderId", async () => {
			const calculation = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 50, quantity: 1 }],
			});

			const transaction = await controller.logTransaction({
				orderId: "order-123",
				address: { country: "US", state: "CA" },
				calculation,
				subtotal: 50,
				shippingAmount: 0,
			});

			expect(transaction.orderId).toBe("order-123");
		});

		it("captures shipping tax in transaction", async () => {
			await controller.createRate({
				name: "Tax",
				country: "US",
				state: "CA",
				rate: 0.1,
			});

			const calculation = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
				shippingAmount: 20,
			});

			const transaction = await controller.logTransaction({
				address: { country: "US", state: "CA" },
				calculation,
				subtotal: 100,
				shippingAmount: 20,
			});

			expect(transaction.shippingTax).toBe(2);
			expect(transaction.totalTax).toBe(12);
			expect(transaction.shippingAmount).toBe(20);
		});

		it("collects unique rate names from all lines", async () => {
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

			const calculation = await controller.calculate({
				address: { country: "US", state: "WA" },
				lineItems: [
					{
						productId: "ebook",
						amount: 100,
						quantity: 1,
						categoryId: cat.id,
					},
					{ productId: "widget", amount: 50, quantity: 1 },
				],
			});

			const transaction = await controller.logTransaction({
				address: { country: "US", state: "WA" },
				calculation,
				subtotal: 150,
				shippingAmount: 0,
			});

			expect(transaction.rateNames).toContain("Digital Tax");
			expect(transaction.rateNames).toContain("Default Tax");
		});
	});

	describe("listTransactions", () => {
		async function logSampleTransaction(
			overrides: { country?: string; state?: string; amount?: number } = {},
		) {
			const country = overrides.country ?? "US";
			const state = overrides.state ?? "CA";
			const amount = overrides.amount ?? 100;

			await controller.createRate({
				name: `${country}-${state} Tax`,
				country,
				state,
				rate: 0.1,
			});

			const calculation = await controller.calculate({
				address: { country, state },
				lineItems: [{ productId: "p1", amount, quantity: 1 }],
			});

			return controller.logTransaction({
				address: { country, state },
				calculation,
				subtotal: amount,
				shippingAmount: 0,
			});
		}

		it("lists all transactions", async () => {
			await logSampleTransaction({ state: "CA" });
			await logSampleTransaction({ state: "NY" });

			const transactions = await controller.listTransactions();
			expect(transactions).toHaveLength(2);
		});

		it("filters by country", async () => {
			await logSampleTransaction({ country: "US", state: "CA" });
			await logSampleTransaction({ country: "CA", state: "ON" });

			const usOnly = await controller.listTransactions({ country: "US" });
			expect(usOnly).toHaveLength(1);
			expect(usOnly[0].country).toBe("US");
		});

		it("filters by state", async () => {
			await logSampleTransaction({ state: "CA" });
			await logSampleTransaction({ state: "NY" });

			const caOnly = await controller.listTransactions({ state: "CA" });
			expect(caOnly).toHaveLength(1);
			expect(caOnly[0].state).toBe("CA");
		});

		it("respects limit and offset", async () => {
			for (let i = 0; i < 5; i++) {
				await logSampleTransaction({ state: "CA", amount: (i + 1) * 100 });
			}

			const page = await controller.listTransactions({
				limit: 2,
				offset: 1,
			});
			expect(page).toHaveLength(2);
		});

		it("returns empty array when no transactions exist", async () => {
			const result = await controller.listTransactions();
			expect(result).toHaveLength(0);
		});
	});

	describe("linkTransactionToOrder", () => {
		it("links a transaction to an order", async () => {
			const calculation = await controller.calculate({
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "p1", amount: 50, quantity: 1 }],
			});

			const transaction = await controller.logTransaction({
				address: { country: "US", state: "CA" },
				calculation,
				subtotal: 50,
				shippingAmount: 0,
			});

			const linked = await controller.linkTransactionToOrder(
				transaction.id,
				"order-456",
			);
			expect(linked).not.toBeNull();
			expect(linked?.orderId).toBe("order-456");
		});

		it("returns null for non-existent transaction", async () => {
			const result = await controller.linkTransactionToOrder(
				"nonexistent",
				"order-123",
			);
			expect(result).toBeNull();
		});
	});
});

describe("TaxController – Tax Reporting", () => {
	let data: ReturnType<typeof createMockDataService>;
	let controller: TaxController;

	beforeEach(() => {
		data = createMockDataService();
		controller = createTaxController(data);
	});

	async function createRateAndLog(
		country: string,
		state: string,
		amount: number,
		shippingAmount = 0,
	) {
		// Ensure rate exists
		const rates = await controller.listRates({ country, state });
		if (rates.length === 0) {
			await controller.createRate({
				name: `${country}-${state} Tax`,
				country,
				state,
				rate: 0.1,
			});
		}

		const calculation = await controller.calculate({
			address: { country, state },
			lineItems: [{ productId: "p1", amount, quantity: 1 }],
			shippingAmount,
		});

		return controller.logTransaction({
			address: { country, state },
			calculation,
			subtotal: amount,
			shippingAmount,
		});
	}

	describe("getReport", () => {
		it("aggregates by jurisdiction", async () => {
			await createRateAndLog("US", "CA", 100);
			await createRateAndLog("US", "CA", 200);
			await createRateAndLog("US", "NY", 150);

			const report = await controller.getReport();

			expect(report).toHaveLength(2);

			const ca = report.find(
				(r) => r.jurisdiction.country === "US" && r.jurisdiction.state === "CA",
			);
			expect(ca).toBeDefined();
			expect(ca?.totalTax).toBe(30); // 10 + 20
			expect(ca?.totalSubtotal).toBe(300); // 100 + 200
			expect(ca?.transactionCount).toBe(2);

			const ny = report.find(
				(r) => r.jurisdiction.country === "US" && r.jurisdiction.state === "NY",
			);
			expect(ny).toBeDefined();
			expect(ny?.totalTax).toBe(15);
			expect(ny?.transactionCount).toBe(1);
		});

		it("includes shipping tax in report", async () => {
			await createRateAndLog("US", "CA", 100, 20);

			const report = await controller.getReport();

			expect(report).toHaveLength(1);
			expect(report[0].totalTax).toBe(12); // 10 item + 2 shipping
			expect(report[0].totalShippingTax).toBe(2);
		});

		it("calculates effective rate", async () => {
			await createRateAndLog("US", "CA", 100);

			const report = await controller.getReport();

			expect(report[0].effectiveRate).toBeCloseTo(0.1);
		});

		it("filters by country", async () => {
			await createRateAndLog("US", "CA", 100);
			await createRateAndLog("CA", "ON", 200);

			const report = await controller.getReport({ country: "US" });

			expect(report).toHaveLength(1);
			expect(report[0].jurisdiction.country).toBe("US");
		});

		it("filters by state", async () => {
			await createRateAndLog("US", "CA", 100);
			await createRateAndLog("US", "NY", 200);

			const report = await controller.getReport({ state: "CA" });

			expect(report).toHaveLength(1);
			expect(report[0].jurisdiction.state).toBe("CA");
		});

		it("returns empty array when no transactions", async () => {
			const report = await controller.getReport();
			expect(report).toHaveLength(0);
		});

		it("sorts by highest tax collected first", async () => {
			await createRateAndLog("US", "CA", 100);
			await createRateAndLog("US", "NY", 500);

			const report = await controller.getReport();

			expect(report[0].jurisdiction.state).toBe("NY");
			expect(report[1].jurisdiction.state).toBe("CA");
		});
	});
});

describe("TaxController – Tax-Inclusive Pricing", () => {
	let data: ReturnType<typeof createMockDataService>;
	let controller: TaxController;

	beforeEach(() => {
		data = createMockDataService();
		controller = createTaxController(data);
	});

	it("extracts tax from inclusive price (20% VAT)", async () => {
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

		// £120 inclusive of 20% VAT: base = 120 / 1.2 = £100, tax = £20
		expect(result.inclusive).toBe(true);
		expect(result.lines[0].taxAmount).toBe(20);
	});

	it("extracts tax from inclusive price (10% rate)", async () => {
		await controller.createRate({
			name: "AU GST",
			country: "AU",
			rate: 0.1,
			inclusive: true,
		});

		const result = await controller.calculate({
			address: { country: "AU", state: "NSW" },
			lineItems: [{ productId: "p1", amount: 110, quantity: 1 }],
		});

		// A$110 inclusive of 10% GST: base = 110 / 1.1 = A$100, tax = A$10
		expect(result.inclusive).toBe(true);
		expect(result.lines[0].taxAmount).toBe(10);
	});

	it("handles inclusive pricing for multiple items", async () => {
		await controller.createRate({
			name: "VAT",
			country: "GB",
			rate: 0.2,
			inclusive: true,
		});

		const result = await controller.calculate({
			address: { country: "GB", state: "ENG" },
			lineItems: [
				{ productId: "p1", amount: 60, quantity: 1 },
				{ productId: "p2", amount: 120, quantity: 1 },
			],
		});

		// p1: 60 / 1.2 = 50 base, 10 tax
		// p2: 120 / 1.2 = 100 base, 20 tax
		expect(result.lines[0].taxAmount).toBe(10);
		expect(result.lines[1].taxAmount).toBe(20);
		expect(result.totalTax).toBe(30);
	});

	it("handles inclusive pricing for shipping", async () => {
		await controller.createRate({
			name: "VAT",
			country: "GB",
			rate: 0.2,
			inclusive: true,
		});

		const result = await controller.calculate({
			address: { country: "GB", state: "ENG" },
			lineItems: [{ productId: "p1", amount: 120, quantity: 1 }],
			shippingAmount: 12,
		});

		// Item: 120 / 1.2 = 100 base, 20 tax
		// Shipping: 12 / 1.2 = 10 base, 2 tax
		expect(result.lines[0].taxAmount).toBe(20);
		expect(result.shippingTax).toBe(2);
		expect(result.totalTax).toBe(22);
	});

	it("exempt customer pays zero even with inclusive pricing", async () => {
		await controller.createRate({
			name: "VAT",
			country: "GB",
			rate: 0.2,
			inclusive: true,
		});
		await controller.createExemption({ customerId: "exempt-uk" });

		const result = await controller.calculate({
			address: { country: "GB", state: "ENG" },
			lineItems: [{ productId: "p1", amount: 120, quantity: 1 }],
			customerId: "exempt-uk",
		});

		expect(result.totalTax).toBe(0);
	});

	it("non-inclusive rates still add tax on top", async () => {
		await controller.createRate({
			name: "CA Sales Tax",
			country: "US",
			state: "CA",
			rate: 0.1,
			inclusive: false,
		});

		const result = await controller.calculate({
			address: { country: "US", state: "CA" },
			lineItems: [{ productId: "p1", amount: 100, quantity: 1 }],
		});

		expect(result.inclusive).toBe(false);
		expect(result.lines[0].taxAmount).toBe(10);
		// Amount is 100, tax is 10 on top = 110 total
	});

	it("rounds inclusive tax extraction correctly", async () => {
		await controller.createRate({
			name: "VAT",
			country: "GB",
			rate: 0.2,
			inclusive: true,
		});

		const result = await controller.calculate({
			address: { country: "GB", state: "ENG" },
			lineItems: [{ productId: "p1", amount: 9.99, quantity: 1 }],
		});

		// 9.99 / 1.2 = 8.325, tax = 9.99 - 8.325 = 1.665 → rounds to 1.66
		expect(result.lines[0].taxAmount).toBe(1.66);
	});
});
