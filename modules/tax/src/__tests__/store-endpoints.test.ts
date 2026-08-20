import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createTaxController } from "../service-impl";

/**
 * Store endpoint integration tests for the tax module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. calculate-tax: jurisdiction matching, per-line tax calculation,
 *    customer exemptions (derived from session), shipping tax,
 *    compound rates, and priority ordering
 * 2. get-rates: returns only public-facing fields (name, rate, type, inclusive)
 *    for the matching jurisdiction
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

/**
 * Simulates calculate-tax endpoint: derives customerId from session
 * for exemption checks, delegates to controller.
 */
async function simulateCalculateTax(
	data: DataService,
	body: {
		address: {
			country: string;
			state: string;
			city?: string;
			postalCode?: string;
		};
		lineItems: Array<{
			productId: string;
			categoryId?: string;
			amount: number;
			quantity: number;
		}>;
		shippingAmount?: number;
	},
	opts: { customerId?: string } = {},
) {
	const controller = createTaxController(data);
	const calculation = await controller.calculate({
		address: body.address,
		lineItems: body.lineItems,
		shippingAmount: body.shippingAmount,
		customerId: opts.customerId,
	});
	if (calculation.lines.some((line) => line.unresolved)) {
		return {
			code: "TAX_REVIEW_REQUIRED" as const,
			error: "Tax requires merchant review before payment.",
			status: 422 as const,
		};
	}
	return { calculation };
}

function expectTaxCalculation(
	result: Awaited<ReturnType<typeof simulateCalculateTax>>,
) {
	if (!("calculation" in result)) {
		throw new Error(
			`expected a tax calculation, got ${JSON.stringify(result)}`,
		);
	}
	return result.calculation;
}

/**
 * Simulates get-rates endpoint: returns only public-facing fields
 * (name, rate, type, inclusive) for the given address.
 */
async function simulateGetRates(
	data: DataService,
	query: {
		country: string;
		state: string;
		city?: string;
		postalCode?: string;
	},
) {
	const controller = createTaxController(data);
	const rates = await controller.getRatesForAddress({
		country: query.country,
		state: query.state,
		city: query.city,
		postalCode: query.postalCode,
	});

	return {
		rates: rates.map((r) => ({
			name: r.name,
			rate: r.rate,
			type: r.type,
			inclusive: r.inclusive,
		})),
	};
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: calculate tax — jurisdiction matching", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("calculates tax using a matching state rate", async () => {
		const controller = createTaxController(data);
		await controller.createRate({
			name: "CA State Tax",
			country: "US",
			state: "CA",
			rate: 0.0725,
		});

		const result = await simulateCalculateTax(data, {
			address: { country: "US", state: "CA" },
			lineItems: [{ productId: "prod_1", amount: 10000, quantity: 1 }],
		});

		expect(expectTaxCalculation(result).totalTax).toBe(725);
		expect(expectTaxCalculation(result).effectiveRate).toBeCloseTo(0.0725, 4);
		expect(expectTaxCalculation(result).jurisdiction.country).toBe("US");
		expect(expectTaxCalculation(result).jurisdiction.state).toBe("CA");
	});

	it("fails closed with TAX_REVIEW_REQUIRED when no rates match", async () => {
		const controller = createTaxController(data);
		await controller.createRate({
			name: "CA Tax",
			country: "US",
			state: "CA",
			rate: 0.0725,
		});

		const result = await simulateCalculateTax(data, {
			address: { country: "US", state: "TX" },
			lineItems: [{ productId: "prod_1", amount: 10000, quantity: 1 }],
		});

		expect(result).toEqual({
			code: "TAX_REVIEW_REQUIRED",
			error: "Tax requires merchant review before payment.",
			status: 422,
		});
	});

	it("applies both state and city rates additively", async () => {
		const controller = createTaxController(data);
		await controller.createRate({
			name: "CA State",
			country: "US",
			state: "CA",
			rate: 0.0725,
		});
		await controller.createRate({
			name: "LA City",
			country: "US",
			state: "CA",
			city: "Los Angeles",
			rate: 0.095,
		});

		const result = await simulateCalculateTax(data, {
			address: { country: "US", state: "CA", city: "Los Angeles" },
			lineItems: [{ productId: "prod_1", amount: 10000, quantity: 1 }],
		});

		// Both rates apply: 10000 * (0.0725 + 0.095) = 1675
		expect(expectTaxCalculation(result).totalTax).toBe(1675);
		expect(expectTaxCalculation(result).lines[0].rateNames).toContain(
			"LA City",
		);
		expect(expectTaxCalculation(result).lines[0].rateNames).toContain(
			"CA State",
		);
	});

	it("calculates tax on multiple line items", async () => {
		const controller = createTaxController(data);
		await controller.createRate({
			name: "NY Tax",
			country: "US",
			state: "NY",
			rate: 0.08,
		});

		const result = await simulateCalculateTax(data, {
			address: { country: "US", state: "NY" },
			lineItems: [
				{ productId: "prod_a", amount: 5000, quantity: 1 },
				{ productId: "prod_b", amount: 3000, quantity: 2 },
			],
		});

		// Tax on prod_a: 5000 * 0.08 = 400
		// Tax on prod_b: 3000 * 0.08 = 240
		expect(expectTaxCalculation(result).lines).toHaveLength(2);
		expect(expectTaxCalculation(result).totalTax).toBe(640);
	});

	it("includes shipping tax when shippingAmount is provided", async () => {
		const controller = createTaxController(data);
		await controller.createRate({
			name: "TX Tax",
			country: "US",
			state: "TX",
			rate: 0.0625,
		});

		const result = await simulateCalculateTax(data, {
			address: { country: "US", state: "TX" },
			lineItems: [{ productId: "prod_1", amount: 10000, quantity: 1 }],
			shippingAmount: 800,
		});

		// Item tax: 10000 * 0.0625 = 625
		// Shipping tax: 800 * 0.0625 = 50
		expect(expectTaxCalculation(result).shippingTax).toBe(50);
		expect(expectTaxCalculation(result).totalTax).toBe(675);
	});

	it("returns zero shipping tax when shippingAmount is 0", async () => {
		const controller = createTaxController(data);
		await controller.createRate({
			name: "CA Tax",
			country: "US",
			state: "CA",
			rate: 0.0725,
		});

		const result = await simulateCalculateTax(data, {
			address: { country: "US", state: "CA" },
			lineItems: [{ productId: "prod_1", amount: 5000, quantity: 1 }],
			shippingAmount: 0,
		});

		expect(expectTaxCalculation(result).shippingTax).toBe(0);
	});
});

describe("store endpoint: calculate tax — customer exemptions", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("applies full exemption for exempt customers", async () => {
		const controller = createTaxController(data);
		await controller.createRate({
			name: "CA Tax",
			country: "US",
			state: "CA",
			rate: 0.0725,
		});
		await controller.createExemption({
			customerId: "cust_exempt",
			type: "full",
			reason: "Government entity",
		});

		const result = await simulateCalculateTax(
			data,
			{
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "prod_1", amount: 10000, quantity: 1 }],
			},
			{ customerId: "cust_exempt" },
		);

		expect(expectTaxCalculation(result).totalTax).toBe(0);
	});

	it("charges full tax when customerId is not provided (guest)", async () => {
		const controller = createTaxController(data);
		await controller.createRate({
			name: "CA Tax",
			country: "US",
			state: "CA",
			rate: 0.0725,
		});

		const result = await simulateCalculateTax(data, {
			address: { country: "US", state: "CA" },
			lineItems: [{ productId: "prod_1", amount: 10000, quantity: 1 }],
		});

		expect(expectTaxCalculation(result).totalTax).toBe(725);
	});

	it("charges full tax for non-exempt customers", async () => {
		const controller = createTaxController(data);
		await controller.createRate({
			name: "CA Tax",
			country: "US",
			state: "CA",
			rate: 0.0725,
		});

		const result = await simulateCalculateTax(
			data,
			{
				address: { country: "US", state: "CA" },
				lineItems: [{ productId: "prod_1", amount: 10000, quantity: 1 }],
			},
			{ customerId: "cust_regular" },
		);

		expect(expectTaxCalculation(result).totalTax).toBe(725);
	});
});

describe("store endpoint: calculate tax — inclusive rates", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("reports inclusive flag in calculation result", async () => {
		const controller = createTaxController(data);
		await controller.createRate({
			name: "VAT",
			country: "GB",
			state: "*",
			rate: 0.2,
			inclusive: true,
		});

		const result = await simulateCalculateTax(data, {
			address: { country: "GB", state: "England" },
			lineItems: [{ productId: "prod_1", amount: 12000, quantity: 1 }],
		});

		expect(expectTaxCalculation(result).inclusive).toBe(true);
	});
});

describe("store endpoint: get rates — public-facing fields only", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns matching rates with only public fields", async () => {
		const controller = createTaxController(data);
		await controller.createRate({
			name: "CA State Tax",
			country: "US",
			state: "CA",
			rate: 0.0725,
			type: "percentage",
			inclusive: false,
		});

		const result = await simulateGetRates(data, {
			country: "US",
			state: "CA",
		});

		expect(result.rates).toHaveLength(1);
		expect(result.rates[0]).toEqual({
			name: "CA State Tax",
			rate: 0.0725,
			type: "percentage",
			inclusive: false,
		});
		// Internal fields should NOT be present
		expect(result.rates[0]).not.toHaveProperty("id");
		expect(result.rates[0]).not.toHaveProperty("country");
		expect(result.rates[0]).not.toHaveProperty("state");
		expect(result.rates[0]).not.toHaveProperty("priority");
		expect(result.rates[0]).not.toHaveProperty("compound");
	});

	it("returns empty array for non-matching jurisdiction", async () => {
		const controller = createTaxController(data);
		await controller.createRate({
			name: "CA Tax",
			country: "US",
			state: "CA",
			rate: 0.0725,
		});

		const result = await simulateGetRates(data, {
			country: "US",
			state: "OR",
		});

		expect(result.rates).toHaveLength(0);
	});

	it("returns multiple rates for multi-rate jurisdictions", async () => {
		const controller = createTaxController(data);
		await controller.createRate({
			name: "State Tax",
			country: "US",
			state: "CA",
			rate: 0.06,
		});
		await controller.createRate({
			name: "County Surtax",
			country: "US",
			state: "CA",
			rate: 0.0125,
		});

		const result = await simulateGetRates(data, {
			country: "US",
			state: "CA",
		});

		expect(result.rates).toHaveLength(2);
		const names = result.rates.map((r) => r.name);
		expect(names).toContain("State Tax");
		expect(names).toContain("County Surtax");
	});

	it("does not return disabled rates", async () => {
		const controller = createTaxController(data);
		await controller.createRate({
			name: "Active Rate",
			country: "US",
			state: "CA",
			rate: 0.0725,
			enabled: true,
		});
		await controller.createRate({
			name: "Disabled Rate",
			country: "US",
			state: "CA",
			rate: 0.02,
			enabled: false,
		});

		const result = await simulateGetRates(data, {
			country: "US",
			state: "CA",
		});

		expect(result.rates).toHaveLength(1);
		expect(result.rates[0].name).toBe("Active Rate");
	});

	it("returns inclusive VAT rates correctly", async () => {
		const controller = createTaxController(data);
		await controller.createRate({
			name: "UK VAT",
			country: "GB",
			state: "*",
			rate: 0.2,
			inclusive: true,
		});

		const result = await simulateGetRates(data, {
			country: "GB",
			state: "England",
		});

		expect(result.rates).toHaveLength(1);
		expect(result.rates[0].inclusive).toBe(true);
		expect(result.rates[0].rate).toBe(0.2);
	});
});
