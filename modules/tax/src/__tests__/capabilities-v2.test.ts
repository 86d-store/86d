import { taxQuoteV2Capability } from "@86d-app/core/commerce-capabilities";
import { createMockDataService } from "@86d-app/core/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleTaxQuoteV2 } from "../capabilities-v2";
import {
	minorUnitsToTaxJarMajorUnits,
	TaxJarQuoteProviderV2,
	type TaxProviderV2Result,
	type TaxQuoteProviderV2,
	taxJarMajorUnitsToMinorUnits,
} from "../provider-v2";

const NOW = new Date("2026-08-13T12:00:00.000Z");

function quoteRequest(options?: {
	marketplaceStatus?: "NOT_MARKETPLACE" | "COLLECTED" | "UNKNOWN";
	customerId?: string;
	shippingAmount?: number;
}) {
	return {
		currency: "USD",
		address: {
			country: "US",
			state: "TX",
			city: "Austin",
			postalCode: "78701",
			normalizationVersion: "test-v1",
		},
		lineItems: [
			{
				lineId: "line-b",
				productId: "product-b",
				taxCategoryId: "general",
				quantity: 1,
				unitAmount: 5,
			},
			{
				lineId: "line-a",
				productId: "product-a",
				taxCategoryId: "general",
				quantity: 1,
				unitAmount: 5,
			},
		],
		shippingAmount: options?.shippingAmount ?? 15,
		...(options?.customerId ? { customerId: options.customerId } : {}),
		marketplaceStatus: options?.marketplaceStatus ?? "NOT_MARKETPLACE",
	};
}

function policy(options?: {
	id?: string;
	version?: string;
	jurisdictionDecision?:
		| "COLLECT"
		| "NO_NEXUS"
		| "MARKETPLACE_COLLECTED"
		| "BLOCKED";
	calculationSource?: "RATE_PACK" | "TAXJAR";
	ratePackId?: string;
	sourceVersion?: string;
	effectiveFrom?: Date;
	effectiveTo?: Date;
}) {
	return {
		id: options?.id ?? "policy-1",
		version: options?.version ?? "policy-v1",
		country: "US",
		state: "TX",
		jurisdictionDecision: options?.jurisdictionDecision ?? "COLLECT",
		calculationSource: options?.calculationSource ?? "RATE_PACK",
		...(options?.calculationSource === "TAXJAR"
			? {}
			: { ratePackId: options?.ratePackId ?? "rate-pack-1" }),
		...(options?.sourceVersion ? { sourceVersion: options.sourceVersion } : {}),
		effectiveFrom:
			options?.effectiveFrom ?? new Date("2026-01-01T00:00:00.000Z"),
		...(options?.effectiveTo ? { effectiveTo: options.effectiveTo } : {}),
		quoteTtlSeconds: 600,
		enabled: true as const,
	};
}

function ratePack(options?: {
	version?: string;
	effectiveFrom?: Date;
	effectiveTo?: Date;
	taxCategoryId?: string;
	rateBasisPoints?: number;
	shippingTaxable?: boolean;
}) {
	return {
		id: "rate-pack-1",
		version: options?.version ?? "rates-v1",
		sourceKind: "MANUAL" as const,
		sourceName: "Merchant-approved Texas rates",
		sourceReference: "merchant-policy-2026-08",
		effectiveFrom:
			options?.effectiveFrom ?? new Date("2026-01-01T00:00:00.000Z"),
		...(options?.effectiveTo ? { effectiveTo: options.effectiveTo } : {}),
		enabled: true as const,
		rates: [
			{
				id: "rate-1",
				country: "US",
				state: "TX",
				city: "*",
				postalCode: "*",
				taxCategoryId: options?.taxCategoryId ?? "default",
				rateBasisPoints: options?.rateBasisPoints ?? 1_000,
				shippingTaxable: options?.shippingTaxable ?? true,
			},
		],
	};
}

async function seedRateDecision(
	data: ReturnType<typeof createMockDataService>,
	options?: {
		policy?: ReturnType<typeof policy>;
		ratePack?: ReturnType<typeof ratePack>;
	},
) {
	await data.upsert(
		"taxPolicyV2",
		options?.policy?.id ?? "policy-1",
		options?.policy ?? policy(),
	);
	await data.upsert(
		"taxRatePackV2",
		options?.ratePack?.id ?? "rate-pack-1",
		options?.ratePack ?? ratePack(),
	);
}

const dependencies = {
	now: () => NOW,
	createQuoteId: () => "tax-quote-1",
};

describe("Tax v2 native decisions", () => {
	it("allocates integer-minor-unit rounding deterministically", async () => {
		const data = createMockDataService();
		await seedRateDecision(data);
		const result = await handleTaxQuoteV2(data, quoteRequest(), dependencies);
		const allocations = Object.fromEntries(
			result.decision.lineAllocations.map(({ lineId, taxAmount }) => [
				lineId,
				taxAmount,
			]),
		);

		expect(result.decision).toMatchObject({
			quoteId: "tax-quote-1",
			jurisdictionDecision: "COLLECT",
			status: "CALCULATED",
			reason: "TAX_CALCULATED",
			policyVersion: "policy-v1",
			sourceVersion: "rates-v1",
			issuedAt: "2026-08-13T12:00:00.000Z",
			expiresAt: "2026-08-13T12:10:00.000Z",
			totals: {
				subtotal: 10,
				discount: 0,
				shipping: 15,
				taxable: 10,
				lineTax: 1,
				shippingTax: 2,
				tax: 3,
				grandTotal: 28,
			},
		});
		expect(allocations).toEqual({ "line-a": 1, "line-b": 0 });
	});

	it.each([
		{
			label: "NO_NEXUS",
			configuredPolicy: policy({ jurisdictionDecision: "NO_NEXUS" }),
			request: quoteRequest(),
			reason: "NO_NEXUS_POLICY",
			status: "NO_NEXUS",
		},
		{
			label: "MARKETPLACE_COLLECTED",
			configuredPolicy: policy({
				jurisdictionDecision: "MARKETPLACE_COLLECTED",
			}),
			request: quoteRequest({ marketplaceStatus: "COLLECTED" }),
			reason: "MARKETPLACE_POLICY",
			status: "MARKETPLACE_COLLECTED",
		},
	] as const)(
		"returns an explicit versioned zero for $label",
		async ({ configuredPolicy, request, reason, status }) => {
			const data = createMockDataService();
			await seedRateDecision(data, { policy: configuredPolicy });
			const result = await handleTaxQuoteV2(data, request, dependencies);

			expect(result.decision).toMatchObject({
				status,
				reason,
				policyVersion: "policy-v1",
				totals: {
					lineTax: 0,
					shippingTax: 0,
					tax: 0,
					grandTotal: 25,
				},
			});
		},
	);

	it("returns an explicit versioned zero only for an effective full exemption", async () => {
		const data = createMockDataService();
		await seedRateDecision(data);
		await data.upsert("taxExemptionV2", "exemption-1", {
			id: "exemption-1",
			version: "exemption-v2",
			customerId: "customer-1",
			reason: "Valid resale certificate",
			effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
			enabled: true,
		});
		const result = await handleTaxQuoteV2(
			data,
			quoteRequest({ customerId: "customer-1" }),
			dependencies,
		);

		expect(result.decision).toMatchObject({
			jurisdictionDecision: "COLLECT",
			status: "EXEMPT",
			reason: "EXEMPTION_APPLIED",
			sourceVersion: "exemption-v2",
			totals: { tax: 0, grandTotal: 25 },
		});
	});

	it("fails closed when no applicable policy exists", async () => {
		const result = await handleTaxQuoteV2(
			createMockDataService(),
			quoteRequest(),
			dependencies,
		);

		expect(result.decision).toMatchObject({
			jurisdictionDecision: "BLOCKED",
			status: "REVIEW_REQUIRED",
			reason: "POLICY_NOT_CONFIGURED",
			policyVersion: "unconfigured",
			sourceVersion: "unconfigured",
			totals: {
				lineTax: null,
				shippingTax: null,
				tax: null,
				grandTotal: null,
			},
		});
	});

	const reviewRequiredCases = [
		[
			"invalid policy",
			async (data: ReturnType<typeof createMockDataService>) => {
				await data.upsert("taxPolicyV2", "invalid", {
					id: "invalid",
					enabled: true,
				});
			},
			quoteRequest(),
			"POLICY_INVALID",
		],
		[
			"ambiguous policy",
			async (data: ReturnType<typeof createMockDataService>) => {
				await seedRateDecision(data);
				await data.upsert(
					"taxPolicyV2",
					"policy-2",
					policy({ id: "policy-2", version: "policy-v2" }),
				);
			},
			quoteRequest(),
			"POLICY_AMBIGUOUS",
		],
		[
			"blocked policy",
			async (data: ReturnType<typeof createMockDataService>) => {
				await seedRateDecision(data, {
					policy: policy({ jurisdictionDecision: "BLOCKED" }),
				});
			},
			quoteRequest(),
			"POLICY_BLOCKED",
		],
		[
			"unknown marketplace status",
			async (data: ReturnType<typeof createMockDataService>) => {
				await seedRateDecision(data);
			},
			quoteRequest({ marketplaceStatus: "UNKNOWN" }),
			"MARKETPLACE_STATUS_UNRESOLVED",
		],
		[
			"stale rate pack",
			async (data: ReturnType<typeof createMockDataService>) => {
				await seedRateDecision(data, {
					ratePack: ratePack({
						effectiveTo: new Date("2026-08-13T11:59:59.000Z"),
					}),
				});
			},
			quoteRequest(),
			"RATE_PACK_STALE",
		],
		[
			"missing category rate",
			async (data: ReturnType<typeof createMockDataService>) => {
				await seedRateDecision(data, {
					ratePack: ratePack({ taxCategoryId: "clothing" }),
				});
			},
			quoteRequest(),
			"RATE_NOT_CONFIGURED",
		],
		[
			"unsupported category exemption",
			async (data: ReturnType<typeof createMockDataService>) => {
				await seedRateDecision(data);
				await data.upsert("taxExemptionV2", "exemption-1", {
					id: "exemption-1",
					version: "exemption-v1",
					customerId: "customer-1",
					taxCategoryId: "general",
					reason: "Category certificate",
					effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
					enabled: true,
				});
			},
			quoteRequest({ customerId: "customer-1" }),
			"EXEMPTION_UNSUPPORTED",
		],
	] as const;
	it.each(reviewRequiredCases)(
		"returns REVIEW_REQUIRED for %s",
		async (_label, setup, request, reason) => {
			const data = createMockDataService();
			await setup(data);
			const result = await handleTaxQuoteV2(data, request, dependencies);

			expect(result.decision).toMatchObject({
				jurisdictionDecision: "BLOCKED",
				status: "REVIEW_REQUIRED",
				reason,
				totals: { tax: null, grandTotal: null },
			});
		},
	);

	it("rejects duplicate lines, discounts above gross, and unsafe money at the capability boundary", () => {
		const request = quoteRequest();
		expect(
			taxQuoteV2Capability.request.safeParse({
				...request,
				lineItems: [request.lineItems[0], request.lineItems[0]],
			}),
		).toMatchObject({ success: false });
		expect(
			taxQuoteV2Capability.request.safeParse({
				...request,
				lineItems: [{ ...request.lineItems[0], discountAmount: 6 }],
			}),
		).toMatchObject({ success: false });
		expect(
			taxQuoteV2Capability.request.safeParse({
				...request,
				lineItems: [
					{
						...request.lineItems[0],
						unitAmount: Number.MAX_SAFE_INTEGER,
						quantity: 2,
					},
				],
			}),
		).toMatchObject({ success: false });
	});
});

describe("Tax v2 provider decisions", () => {
	async function taxJarPolicyData() {
		const data = createMockDataService();
		await data.upsert(
			"taxPolicyV2",
			"policy-1",
			policy({ calculationSource: "TAXJAR", sourceVersion: "taxjar-v2" }),
		);
		return data;
	}

	it("fails closed when the configured provider is absent or throws", async () => {
		const data = await taxJarPolicyData();
		const absent = await handleTaxQuoteV2(data, quoteRequest(), dependencies);
		const failedProvider = {
			kind: "TAXJAR",
			connectionId: "tax-connection-1",
			name: "TaxJar",
			quote: async () => {
				throw new Error("timeout");
			},
		} satisfies TaxQuoteProviderV2;
		const failed = await handleTaxQuoteV2(data, quoteRequest(), {
			...dependencies,
			provider: failedProvider,
		});

		expect(absent.decision).toMatchObject({
			status: "REVIEW_REQUIRED",
			reason: "PROVIDER_NOT_CONFIGURED",
		});
		expect(failed.decision).toMatchObject({
			status: "REVIEW_REQUIRED",
			reason: "PROVIDER_FAILED",
		});
	});

	const invalidTaxProviderCases = [
		[
			"missing provider nexus",
			{
				ok: true,
				hasNexus: false,
				totalTax: 1,
				shippingTax: 0,
				lineAllocations: [
					{ lineId: "line-a", taxableAmount: 5, taxAmount: 1 },
					{ lineId: "line-b", taxableAmount: 5, taxAmount: 0 },
				],
				sourceReference: "destination",
			},
			"PROVIDER_NEXUS_CONFLICT",
		],
		[
			"incomplete provider allocation",
			{
				ok: true,
				hasNexus: true,
				totalTax: 1,
				shippingTax: 0,
				lineAllocations: [{ lineId: "line-a", taxableAmount: 5, taxAmount: 1 }],
				sourceReference: "destination",
			},
			"PROVIDER_RESPONSE_INVALID",
		],
		[
			"inconsistent provider total",
			{
				ok: true,
				hasNexus: true,
				totalTax: 99,
				shippingTax: 0,
				lineAllocations: [
					{ lineId: "line-a", taxableAmount: 5, taxAmount: 1 },
					{ lineId: "line-b", taxableAmount: 5, taxAmount: 0 },
				],
				sourceReference: "destination",
			},
			"PROVIDER_RESPONSE_INVALID",
		],
	] satisfies Array<[string, TaxProviderV2Result, string]>;

	it.each(invalidTaxProviderCases)(
		"rejects %s",
		async (_label, providerResult, reason) => {
			const data = await taxJarPolicyData();
			const provider = {
				kind: "TAXJAR",
				connectionId: "tax-connection-1",
				name: "TaxJar",
				quote: async () => providerResult,
			} satisfies TaxQuoteProviderV2;
			const result = await handleTaxQuoteV2(data, quoteRequest(), {
				...dependencies,
				provider,
			});

			expect(result.decision).toMatchObject({
				status: "REVIEW_REQUIRED",
				reason,
				totals: { tax: null, grandTotal: null },
			});
		},
	);

	it("persists a complete canonical provider decision", async () => {
		const data = await taxJarPolicyData();
		const provider = {
			kind: "TAXJAR",
			connectionId: "tax-connection-1",
			name: "TaxJar",
			quote: async () => ({
				ok: true as const,
				hasNexus: true,
				totalTax: 3,
				shippingTax: 2,
				lineAllocations: [
					{ lineId: "line-a", taxableAmount: 5, taxAmount: 1 },
					{ lineId: "line-b", taxableAmount: 5, taxAmount: 0 },
				],
				sourceReference: "destination",
			}),
		} satisfies TaxQuoteProviderV2;
		const result = await handleTaxQuoteV2(data, quoteRequest(), {
			...dependencies,
			provider,
		});

		expect(result.decision).toMatchObject({
			jurisdictionDecision: "COLLECT",
			status: "CALCULATED",
			source: {
				kind: "PROVIDER",
				name: "TaxJar",
				connectionId: "tax-connection-1",
				reference: "destination",
			},
			totals: { lineTax: 1, shippingTax: 2, tax: 3, grandTotal: 28 },
		});
	});
});

describe("TaxJar v2 minor-unit conversion", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("sends major units and converts the realistic response back to minor units", async () => {
		const fetchMock = vi.fn(
			async (_input: string | URL | Request, _init?: RequestInit) => ({
				ok: true,
				json: async () => ({
					tax: {
						amount_to_collect: 2.26,
						has_nexus: true,
						tax_source: "destination",
						jurisdictions: {
							country: "US",
							state: "TX",
							county: "TRAVIS",
							city: "AUSTIN",
						},
						breakdown: {
							line_items: [
								{
									id: "line-1",
									taxable_amount: 24.34,
									tax_collectable: 2.01,
								},
							],
						},
					},
				}),
			}),
		);
		vi.stubGlobal("fetch", fetchMock);
		const provider = new TaxJarQuoteProviderV2({
			apiKey: "taxjar-test-key",
			sandbox: true,
			connectionId: "tax-connection-1",
			origin: { country: "US", state: "TX", postalCode: "78701" },
		});
		const result = await provider.quote({
			currency: "USD",
			address: quoteRequest().address,
			lineItems: [
				{
					lineId: "line-1",
					productId: "product-1",
					taxCategoryId: "general",
					quantity: 2,
					unitAmount: 1_234,
					discountAmount: 34,
				},
			],
			shippingAmount: 250,
			marketplaceStatus: "NOT_MARKETPLACE",
		});
		const body = fetchMock.mock.calls[0]?.[1]?.body;
		if (typeof body !== "string")
			throw new Error("Expected a JSON request body");

		expect(JSON.parse(body)).toMatchObject({
			amount: 24.34,
			shipping: 2.5,
			line_items: [
				{ id: "line-1", quantity: 2, unit_price: 12.34, discount: 0.34 },
			],
		});
		expect(result).toEqual({
			ok: true,
			hasNexus: true,
			totalTax: 226,
			shippingTax: 25,
			lineAllocations: [
				{ lineId: "line-1", taxableAmount: 2_434, taxAmount: 201 },
			],
			sourceReference: "destination",
		});
	});

	it("rejects unsupported currencies and malformed sub-cent provider amounts", async () => {
		const fetchMock = vi.fn(async () => ({
			ok: true,
			json: async () => ({
				tax: {
					amount_to_collect: 0.001,
					has_nexus: true,
					tax_source: "destination",
					jurisdictions: {
						country: "US",
						state: "TX",
						county: "TRAVIS",
						city: "AUSTIN",
					},
					breakdown: {
						line_items: [
							{
								id: "line-b",
								taxable_amount: 0.05,
								tax_collectable: 0.001,
							},
							{
								id: "line-a",
								taxable_amount: 0.05,
								tax_collectable: 0,
							},
						],
					},
				},
			}),
		}));
		vi.stubGlobal("fetch", fetchMock);
		const provider = new TaxJarQuoteProviderV2({
			apiKey: "taxjar-test-key",
			sandbox: true,
			connectionId: "tax-connection-1",
			origin: { country: "US", state: "TX", postalCode: "78701" },
		});

		expect(
			await provider.quote({ ...quoteRequest(), currency: "CAD" }),
		).toEqual({ ok: false, reason: "UNSUPPORTED_CURRENCY" });
		expect(await provider.quote(quoteRequest())).toEqual({
			ok: false,
			reason: "PROVIDER_RESPONSE_INVALID",
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("accepts exact cents and rejects unsafe or fractional minor-unit conversions", () => {
		expect(minorUnitsToTaxJarMajorUnits(1_234)).toBe(12.34);
		expect(taxJarMajorUnitsToMinorUnits(12.34)).toBe(1_234);
		expect(taxJarMajorUnitsToMinorUnits(0.001)).toBeNull();
		expect(taxJarMajorUnitsToMinorUnits(Number.POSITIVE_INFINITY)).toBeNull();
	});
});
