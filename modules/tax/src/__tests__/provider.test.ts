import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	TaxJarProvider,
	type TaxJarRateResponse,
	type TaxJarTaxResponse,
} from "../provider";

// ── Realistic TaxJar API fixtures ────────────────────────────────────────────

const MOCK_API_KEY = "5da2f821eee4035db4771edab942a4cc";

const TAX_CALCULATION_RESPONSE: TaxJarTaxResponse = {
	tax: {
		order_total_amount: 150.0,
		shipping: 10.0,
		taxable_amount: 150.0,
		amount_to_collect: 12.19,
		rate: 0.08125,
		has_nexus: true,
		freight_taxable: false,
		tax_source: "destination",
		jurisdictions: {
			country: "US",
			state: "CA",
			county: "LOS ANGELES",
			city: "SANTA MONICA",
		},
		breakdown: {
			taxable_amount: 150.0,
			tax_collectable: 12.19,
			combined_tax_rate: 0.08125,
			state_taxable_amount: 150.0,
			state_tax_rate: 0.0625,
			state_tax_collectable: 9.38,
			county_taxable_amount: 150.0,
			county_tax_rate: 0.0025,
			county_tax_collectable: 0.38,
			city_taxable_amount: 0.0,
			city_tax_rate: 0.0,
			city_tax_collectable: 0.0,
			special_district_taxable_amount: 150.0,
			special_tax_rate: 0.01625,
			special_district_tax_collectable: 2.44,
			line_items: [
				{
					id: "item-1",
					taxable_amount: 100.0,
					tax_collectable: 8.13,
					combined_tax_rate: 0.08125,
					state_taxable_amount: 100.0,
					state_sales_tax_rate: 0.0625,
					state_amount: 6.25,
					county_taxable_amount: 100.0,
					county_tax_rate: 0.0025,
					county_amount: 0.25,
					city_taxable_amount: 0.0,
					city_tax_rate: 0.0,
					city_amount: 0.0,
					special_district_taxable_amount: 100.0,
					special_tax_rate: 0.01625,
					special_district_amount: 1.63,
				},
				{
					id: "item-2",
					taxable_amount: 50.0,
					tax_collectable: 4.06,
					combined_tax_rate: 0.08125,
					state_taxable_amount: 50.0,
					state_sales_tax_rate: 0.0625,
					state_amount: 3.13,
					county_taxable_amount: 50.0,
					county_tax_rate: 0.0025,
					county_amount: 0.13,
					city_taxable_amount: 0.0,
					city_tax_rate: 0.0,
					city_amount: 0.0,
					special_district_taxable_amount: 50.0,
					special_tax_rate: 0.01625,
					special_district_amount: 0.81,
				},
			],
		},
	},
};

const RATE_LOOKUP_RESPONSE: TaxJarRateResponse = {
	rate: {
		zip: "90404",
		state: "CA",
		state_rate: "0.0625",
		county: "LOS ANGELES",
		county_rate: "0.0025",
		city: "SANTA MONICA",
		city_rate: "0.0",
		combined_district_rate: "0.01625",
		combined_rate: "0.10250",
		freight_taxable: false,
	},
};

const ERROR_RESPONSE = {
	status: 401,
	error: "Unauthorized",
	detail: "Not authorized for route 'POST /v2/taxes'",
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("TaxJarProvider", () => {
	let provider: TaxJarProvider;
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		provider = new TaxJarProvider(MOCK_API_KEY, true);
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	describe("calculateTax", () => {
		it("sends POST to /taxes with addresses and line items", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(TAX_CALCULATION_RESPONSE),
			});

			const result = await provider.calculateTax({
				fromAddress: {
					country: "US",
					zip: "94104",
					state: "CA",
					city: "San Francisco",
					street: "417 Montgomery Street",
				},
				toAddress: {
					country: "US",
					zip: "90404",
					state: "CA",
					city: "Santa Monica",
					street: "123 Main St",
				},
				shipping: 10.0,
				lineItems: [
					{ id: "item-1", quantity: 1, unit_price: 100.0 },
					{
						id: "item-2",
						quantity: 1,
						unit_price: 50.0,
						product_tax_code: "20010",
					},
				],
			});

			expect(result.tax.amount_to_collect).toBe(12.19);
			expect(result.tax.rate).toBe(0.08125);
			expect(result.tax.has_nexus).toBe(true);
			expect(result.tax.jurisdictions.state).toBe("CA");
			expect(result.tax.breakdown.line_items).toHaveLength(2);
			expect(result.tax.breakdown.line_items[0].tax_collectable).toBe(8.13);

			const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
			expect(fetchCall[0]).toBe("https://api.sandbox.taxjar.com/v2/taxes");
			expect(fetchCall[1]?.method).toBe("POST");

			const body = JSON.parse(fetchCall[1]?.body as string);
			expect(body.from_country).toBe("US");
			expect(body.from_zip).toBe("94104");
			expect(body.from_city).toBe("San Francisco");
			expect(body.from_street).toBe("417 Montgomery Street");
			expect(body.to_country).toBe("US");
			expect(body.to_zip).toBe("90404");
			expect(body.to_state).toBe("CA");
			expect(body.to_city).toBe("Santa Monica");
			expect(body.to_street).toBe("123 Main St");
			expect(body.shipping).toBe(10.0);
			expect(body.amount).toBe(150.0);
			expect(body.line_items).toHaveLength(2);
			expect(body.line_items[1].product_tax_code).toBe("20010");
		});

		it("includes Bearer auth header", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(TAX_CALCULATION_RESPONSE),
			});

			await provider.calculateTax({
				fromAddress: { country: "US", zip: "94104", state: "CA" },
				toAddress: { country: "US", zip: "90404", state: "CA" },
				shipping: 0,
				lineItems: [{ id: "1", quantity: 1, unit_price: 100 }],
			});

			const headers = vi.mocked(globalThis.fetch).mock.calls[0][1]
				?.headers as Record<string, string>;
			expect(headers.Authorization).toBe(`Bearer ${MOCK_API_KEY}`);
			expect(headers["Content-Type"]).toBe("application/json");
		});

		it("uses production URL when sandbox is false", async () => {
			const prodProvider = new TaxJarProvider(MOCK_API_KEY, false);
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(TAX_CALCULATION_RESPONSE),
			});

			await prodProvider.calculateTax({
				fromAddress: { country: "US", zip: "94104", state: "CA" },
				toAddress: { country: "US", zip: "90404", state: "CA" },
				shipping: 0,
				lineItems: [{ id: "1", quantity: 1, unit_price: 100 }],
			});

			const url = vi.mocked(globalThis.fetch).mock.calls[0][0];
			expect(url).toBe("https://api.taxjar.com/v2/taxes");
		});

		it("calculates correct amount from line items", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(TAX_CALCULATION_RESPONSE),
			});

			await provider.calculateTax({
				fromAddress: { country: "US", zip: "94104", state: "CA" },
				toAddress: { country: "US", zip: "90404", state: "CA" },
				shipping: 5.0,
				lineItems: [
					{ id: "a", quantity: 2, unit_price: 25.0 },
					{ id: "b", quantity: 1, unit_price: 75.0, discount: 10.0 },
				],
			});

			const body = JSON.parse(
				vi.mocked(globalThis.fetch).mock.calls[0][1]?.body as string,
			);
			// 2*25 + 1*75 - 10 = 115
			expect(body.amount).toBe(115.0);
		});

		it("includes nexus addresses when provided", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(TAX_CALCULATION_RESPONSE),
			});

			await provider.calculateTax({
				fromAddress: { country: "US", zip: "94104", state: "CA" },
				toAddress: { country: "US", zip: "90404", state: "CA" },
				shipping: 0,
				lineItems: [{ id: "1", quantity: 1, unit_price: 100 }],
				nexusAddresses: [
					{ country: "US", zip: "94104", state: "CA" },
					{ country: "US", zip: "10001", state: "NY", city: "New York" },
				],
			});

			const body = JSON.parse(
				vi.mocked(globalThis.fetch).mock.calls[0][1]?.body as string,
			);
			expect(body.nexus_addresses).toHaveLength(2);
			expect(body.nexus_addresses[1].state).toBe("NY");
		});

		it("includes exemption type when provided", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(TAX_CALCULATION_RESPONSE),
			});

			await provider.calculateTax({
				fromAddress: { country: "US", zip: "94104", state: "CA" },
				toAddress: { country: "US", zip: "90404", state: "CA" },
				shipping: 0,
				lineItems: [{ id: "1", quantity: 1, unit_price: 100 }],
				customerExemptionType: "wholesale",
			});

			const body = JSON.parse(
				vi.mocked(globalThis.fetch).mock.calls[0][1]?.body as string,
			);
			expect(body.exemption_type).toBe("wholesale");
		});

		it("omits optional address fields when not provided", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(TAX_CALCULATION_RESPONSE),
			});

			await provider.calculateTax({
				fromAddress: { country: "US", zip: "94104", state: "CA" },
				toAddress: { country: "US", zip: "90404", state: "CA" },
				shipping: 0,
				lineItems: [{ id: "1", quantity: 1, unit_price: 100 }],
			});

			const body = JSON.parse(
				vi.mocked(globalThis.fetch).mock.calls[0][1]?.body as string,
			);
			expect(body.from_city).toBeUndefined();
			expect(body.from_street).toBeUndefined();
			expect(body.to_city).toBeUndefined();
			expect(body.to_street).toBeUndefined();
			expect(body.nexus_addresses).toBeUndefined();
			expect(body.exemption_type).toBeUndefined();
		});

		it("throws on API error with detail message", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 401,
				json: () => Promise.resolve(ERROR_RESPONSE),
			});

			await expect(
				provider.calculateTax({
					fromAddress: { country: "US", zip: "94104", state: "CA" },
					toAddress: { country: "US", zip: "90404", state: "CA" },
					shipping: 0,
					lineItems: [{ id: "1", quantity: 1, unit_price: 100 }],
				}),
			).rejects.toThrow(
				"TaxJar API error: Not authorized for route 'POST /v2/taxes'",
			);
		});

		it("throws with error field when detail is missing", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
				json: () =>
					Promise.resolve({
						status: 500,
						error: "Internal Server Error",
					}),
			});

			await expect(
				provider.calculateTax({
					fromAddress: { country: "US", zip: "94104", state: "CA" },
					toAddress: { country: "US", zip: "90404", state: "CA" },
					shipping: 0,
					lineItems: [{ id: "1", quantity: 1, unit_price: 100 }],
				}),
			).rejects.toThrow("TaxJar API error: Internal Server Error");
		});

		it("falls back to HTTP status when no error fields", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 503,
				json: () => Promise.resolve({}),
			});

			await expect(
				provider.calculateTax({
					fromAddress: { country: "US", zip: "94104", state: "CA" },
					toAddress: { country: "US", zip: "90404", state: "CA" },
					shipping: 0,
					lineItems: [{ id: "1", quantity: 1, unit_price: 100 }],
				}),
			).rejects.toThrow("TaxJar API error: HTTP 503");
		});
	});

	describe("getRateForZip", () => {
		it("sends GET to /rates/{zip}", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(RATE_LOOKUP_RESPONSE),
			});

			const result = await provider.getRateForZip("90404");

			expect(result.rate.zip).toBe("90404");
			expect(result.rate.state).toBe("CA");
			expect(result.rate.combined_rate).toBe("0.10250");
			expect(result.rate.state_rate).toBe("0.0625");
			expect(result.rate.county).toBe("LOS ANGELES");
			expect(result.rate.freight_taxable).toBe(false);

			const url = vi.mocked(globalThis.fetch).mock.calls[0][0];
			expect(url).toBe("https://api.sandbox.taxjar.com/v2/rates/90404");
			expect(vi.mocked(globalThis.fetch).mock.calls[0][1]?.method).toBe("GET");
		});

		it("includes optional query params", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(RATE_LOOKUP_RESPONSE),
			});

			await provider.getRateForZip("90404", {
				city: "Santa Monica",
				state: "CA",
				country: "US",
				street: "123 Main St",
			});

			const url = vi.mocked(globalThis.fetch).mock.calls[0][0] as string;
			expect(url).toContain("/rates/90404?");
			expect(url).toContain("city=Santa+Monica");
			expect(url).toContain("state=CA");
			expect(url).toContain("country=US");
			expect(url).toContain("street=123+Main+St");
		});

		it("omits query string when no params provided", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(RATE_LOOKUP_RESPONSE),
			});

			await provider.getRateForZip("90404");

			const url = vi.mocked(globalThis.fetch).mock.calls[0][0] as string;
			expect(url).toBe("https://api.sandbox.taxjar.com/v2/rates/90404");
			expect(url).not.toContain("?");
		});

		it("URL-encodes special characters in zip", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(RATE_LOOKUP_RESPONSE),
			});

			await provider.getRateForZip("90404-1234");

			const url = vi.mocked(globalThis.fetch).mock.calls[0][0] as string;
			expect(url).toContain("/rates/90404-1234");
		});

		it("throws on API error", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 404,
				json: () =>
					Promise.resolve({
						status: 404,
						error: "Not Found",
						detail: "Resource can not be found",
					}),
			});

			await expect(provider.getRateForZip("00000")).rejects.toThrow(
				"TaxJar API error: Resource can not be found",
			);
		});
	});

	describe("verifyConnection", () => {
		it("returns ok with category count when API responds", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						categories: [
							{
								product_tax_code: "20010",
								name: "Clothing",
								description: "All human wearing apparel",
							},
							{
								product_tax_code: "40030",
								name: "Food & Groceries",
								description: "Food for human consumption",
							},
						],
					}),
			});

			const result = await provider.verifyConnection();

			expect(result).toEqual({
				ok: true,
				accountName: "TaxJar (2 tax categories)",
			});

			const url = vi.mocked(globalThis.fetch).mock.calls[0][0];
			expect(url).toBe("https://api.sandbox.taxjar.com/v2/categories");
		});

		it("returns error when API returns 401", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 401,
				json: () =>
					Promise.resolve({
						status: 401,
						error: "Unauthorized",
						detail: "Not authorized for route 'GET /v2/categories'",
					}),
			});

			const result = await provider.verifyConnection();

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toContain(
					"Not authorized for route 'GET /v2/categories'",
				);
			}
		});

		it("returns error when fetch throws a network error", async () => {
			globalThis.fetch = vi
				.fn()
				.mockRejectedValue(new Error("Network request failed"));

			const result = await provider.verifyConnection();

			expect(result).toEqual({
				ok: false,
				error: "Network request failed",
			});
		});
	});
});
