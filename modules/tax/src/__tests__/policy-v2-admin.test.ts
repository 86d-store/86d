import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import {
	adminCreateTaxPolicyV2,
	adminCreateTaxRatePackV2,
	adminDisableTaxPolicyV2,
	adminListTaxPoliciesV2,
	adminListTaxRatePacksV2,
	taxPolicyV2CreateBodySchema,
	taxRatePackV2CreateBodySchema,
} from "../admin/endpoints/policy-v2";
import { handleTaxQuoteV2 } from "../capabilities-v2";

function extractHandler(
	endpoint: unknown,
): (ctx: Record<string, unknown>) => Promise<Record<string, unknown>> {
	const candidate = endpoint as Record<string, unknown>;
	const handler =
		typeof candidate.handler === "function" ? candidate.handler : endpoint;
	return handler as (
		ctx: Record<string, unknown>,
	) => Promise<Record<string, unknown>>;
}

/** A minimal owner-scoped data service with the operations these endpoints use. */
function dataService() {
	const tables = new Map<string, Map<string, Record<string, unknown>>>();
	const table = (name: string) => {
		const existing = tables.get(name);
		if (existing) return existing;
		const created = new Map<string, Record<string, unknown>>();
		tables.set(name, created);
		return created;
	};
	return {
		tables,
		data: {
			async get(name: string, id: string) {
				return table(name).get(id) ?? null;
			},
			// Mirrors ModuleDataService: upsert only, returning void. An earlier fake
			// offered create/update, which the real service does not have.
			async upsert(name: string, id: string, record: Record<string, unknown>) {
				table(name).set(id, record);
			},
			async findMany(
				name: string,
				options?: { where?: Record<string, unknown> },
			) {
				const rows = [...table(name).values()];
				const where = options?.where;
				if (!where) return rows;
				return rows.filter((row) =>
					Object.entries(where).every(([key, value]) => row[key] === value),
				);
			},
		},
	};
}

function call(endpoint: unknown, store: ReturnType<typeof dataService>) {
	return (input: Record<string, unknown>) =>
		extractHandler(endpoint)({
			...input,
			context: { data: store.data },
		});
}

const ratePack = {
	id: "pack-tx-2026",
	version: "1",
	sourceKind: "MANUAL" as const,
	sourceName: "Texas manual rates",
	sourceReference: "merchant-approved-2026-08",
	effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
	rates: [
		{
			id: "rate-tx-austin-standard",
			country: "US",
			state: "TX",
			city: "Austin",
			postalCode: "78701",
			taxCategoryId: "standard",
			rateBasisPoints: 825,
			shippingTaxable: false,
		},
	],
};

const policy = {
	id: "policy-tx-2026",
	version: "1",
	country: "US",
	state: "TX",
	jurisdictionDecision: "COLLECT" as const,
	calculationSource: "RATE_PACK" as const,
	ratePackId: ratePack.id,
	effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
	quoteTtlSeconds: 900,
};

describe("tax v2 rate pack configuration", () => {
	it("publishes a rate pack that the quote engine can read", async () => {
		const store = dataService();
		const result = await call(
			adminCreateTaxRatePackV2,
			store,
		)({ body: ratePack });

		expect(result.ratePack).toMatchObject({
			id: ratePack.id,
			sourceKind: "MANUAL",
			// The engine's schema requires literal true, so a pack written any other
			// way is invisible to it.
			enabled: true,
		});
		expect(store.tables.get("taxRatePackV2")?.size).toBe(1);
	});

	it("refuses to republish an identifier, keeping approved rates explainable", async () => {
		const store = dataService();
		await call(adminCreateTaxRatePackV2, store)({ body: ratePack });
		const result = await call(
			adminCreateTaxRatePackV2,
			store,
		)({
			body: { ...ratePack, version: "2" },
		});

		expect(result).toMatchObject({ code: "TAX_RATE_PACK_EXISTS", status: 409 });
		expect(store.tables.get("taxRatePackV2")?.get(ratePack.id)).toMatchObject({
			version: "1",
		});
	});

	it("rejects a pack whose window ends before it begins", async () => {
		const store = dataService();
		const result = await call(
			adminCreateTaxRatePackV2,
			store,
		)({
			body: {
				...ratePack,
				effectiveTo: new Date("2025-01-01T00:00:00.000Z"),
			},
		});

		expect(result).toMatchObject({
			code: "TAX_RATE_PACK_WINDOW_INVALID",
			status: 400,
		});
		expect(store.tables.get("taxRatePackV2")?.size ?? 0).toBe(0);
	});

	it("rejects duplicate rate identifiers inside one pack", async () => {
		const store = dataService();
		const [duplicated] = ratePack.rates;
		const result = await call(
			adminCreateTaxRatePackV2,
			store,
		)({
			body: { ...ratePack, rates: [duplicated, { ...duplicated }] },
		});

		expect(result).toMatchObject({
			code: "TAX_RATE_PACK_RATES_DUPLICATED",
			status: 400,
		});
	});

	it("lists published packs", async () => {
		const store = dataService();
		await call(adminCreateTaxRatePackV2, store)({ body: ratePack });
		const result = await call(
			adminListTaxRatePacksV2,
			store,
		)({
			query: { limit: 25, offset: 0 },
		});

		expect(result.ratePacks).toHaveLength(1);
	});
});

describe("tax v2 policy configuration", () => {
	async function seededStore() {
		const store = dataService();
		await call(adminCreateTaxRatePackV2, store)({ body: ratePack });
		return store;
	}

	it("publishes a policy the engine can resolve", async () => {
		const store = await seededStore();
		const result = await call(adminCreateTaxPolicyV2, store)({ body: policy });

		expect(result.policy).toMatchObject({
			id: policy.id,
			jurisdictionDecision: "COLLECT",
			ratePackId: ratePack.id,
			enabled: true,
		});
	});

	it("refuses a policy naming a rate pack that does not exist", async () => {
		const store = dataService();
		const result = await call(
			adminCreateTaxPolicyV2,
			store,
		)({
			body: { ...policy, ratePackId: "pack-missing" },
		});

		// The engine would answer RATE_PACK_NOT_CONFIGURED with a shopper waiting.
		expect(result).toMatchObject({
			code: "TAX_RATE_PACK_NOT_FOUND",
			status: 400,
		});
		expect(store.tables.get("taxPolicyV2")?.size ?? 0).toBe(0);
	});

	it("refuses a policy naming a disabled rate pack", async () => {
		const store = await seededStore();
		await store.data.upsert("taxRatePackV2", ratePack.id, {
			...ratePack,
			enabled: false,
		});
		const result = await call(adminCreateTaxPolicyV2, store)({ body: policy });

		expect(result).toMatchObject({
			code: "TAX_RATE_PACK_DISABLED",
			status: 400,
		});
	});

	it("refuses a second policy that would make the same jurisdiction ambiguous", async () => {
		const store = await seededStore();
		await call(adminCreateTaxPolicyV2, store)({ body: policy });

		const result = await call(
			adminCreateTaxPolicyV2,
			store,
		)({
			body: {
				...policy,
				id: "policy-tx-2026-duplicate",
				effectiveFrom: new Date("2026-06-01T00:00:00.000Z"),
			},
		});

		// Two equally specific effective policies are exactly the engine's
		// POLICY_AMBIGUOUS condition, which blocks every Checkout in that state.
		expect(result).toMatchObject({
			code: "TAX_POLICY_AMBIGUOUS",
			status: 409,
			conflictingPolicyId: policy.id,
		});
		expect(store.tables.get("taxPolicyV2")?.size).toBe(1);
	});

	it("allows a successor policy whose window begins when the last one ends", async () => {
		const store = await seededStore();
		await call(
			adminCreateTaxPolicyV2,
			store,
		)({
			body: {
				...policy,
				effectiveTo: new Date("2027-01-01T00:00:00.000Z"),
			},
		});

		const result = await call(
			adminCreateTaxPolicyV2,
			store,
		)({
			body: {
				...policy,
				id: "policy-tx-2027",
				version: "2",
				effectiveFrom: new Date("2027-01-01T00:00:00.000Z"),
			},
		});

		expect(result.policy).toMatchObject({ id: "policy-tx-2027" });
		expect(store.tables.get("taxPolicyV2")?.size).toBe(2);
	});

	it("allows a more specific policy alongside a broader one", async () => {
		const store = await seededStore();
		await call(adminCreateTaxPolicyV2, store)({ body: policy });

		// A city-level policy scores higher than the state-level one, so the engine
		// picks it without ambiguity.
		const result = await call(
			adminCreateTaxPolicyV2,
			store,
		)({
			body: { ...policy, id: "policy-tx-austin", city: "Austin" },
		});

		expect(result.policy).toMatchObject({ id: "policy-tx-austin" });
	});

	it("ignores a disabled policy when judging ambiguity", async () => {
		const store = await seededStore();
		await call(adminCreateTaxPolicyV2, store)({ body: policy });
		await call(adminDisableTaxPolicyV2, store)({ params: { id: policy.id } });

		const result = await call(
			adminCreateTaxPolicyV2,
			store,
		)({
			body: { ...policy, id: "policy-tx-replacement" },
		});

		expect(result.policy).toMatchObject({ id: "policy-tx-replacement" });
	});

	it("withdraws a policy without deleting it", async () => {
		const store = await seededStore();
		await call(adminCreateTaxPolicyV2, store)({ body: policy });

		const result = await call(
			adminDisableTaxPolicyV2,
			store,
		)({
			params: { id: policy.id },
		});

		expect(result.policy).toMatchObject({ id: policy.id, enabled: false });
		expect(store.tables.get("taxPolicyV2")?.size).toBe(1);
	});

	it("reports a missing policy rather than creating one", async () => {
		const store = dataService();
		const result = await call(
			adminDisableTaxPolicyV2,
			store,
		)({
			params: { id: "policy-absent" },
		});

		expect(result).toMatchObject({ code: "TAX_POLICY_NOT_FOUND", status: 404 });
	});

	it("lists published policies", async () => {
		const store = await seededStore();
		await call(adminCreateTaxPolicyV2, store)({ body: policy });
		const result = await call(
			adminListTaxPoliciesV2,
			store,
		)({
			query: { limit: 25, offset: 0 },
		});

		expect(result.policies).toHaveLength(1);
	});
});

describe("tax v2 configuration contracts", () => {
	it("requires a collecting policy to state how tax is calculated", () => {
		const { calculationSource: _dropped, ...withoutSource } = policy;
		expect(taxPolicyV2CreateBodySchema.safeParse(withoutSource).success).toBe(
			false,
		);
	});

	it("requires a rate-pack policy to name its pack", () => {
		const { ratePackId: _dropped, ...withoutPack } = policy;
		expect(taxPolicyV2CreateBodySchema.safeParse(withoutPack).success).toBe(
			false,
		);
	});

	it("refuses a rate pack named by a policy that does not calculate from one", () => {
		expect(
			taxPolicyV2CreateBodySchema.safeParse({
				...policy,
				calculationSource: "TAXJAR",
			}).success,
		).toBe(false);
	});

	it("accepts a non-collecting policy with no calculation basis", () => {
		const { calculationSource: _source, ratePackId: _pack, ...base } = policy;
		expect(
			taxPolicyV2CreateBodySchema.safeParse({
				...base,
				jurisdictionDecision: "NO_NEXUS",
			}).success,
		).toBe(true);
	});

	it("rejects an unknown field rather than storing it", () => {
		expect(
			taxPolicyV2CreateBodySchema.safeParse({ ...policy, taxAmount: 0 })
				.success,
		).toBe(false);
		expect(
			taxRatePackV2CreateBodySchema.safeParse({ ...ratePack, discount: 1 })
				.success,
		).toBe(false);
	});

	it("bounds a rate to a real percentage and requires a shipping decision", () => {
		const [rate] = ratePack.rates;
		expect(
			taxRatePackV2CreateBodySchema.safeParse({
				...ratePack,
				rates: [{ ...rate, rateBasisPoints: 100_001 }],
			}).success,
		).toBe(false);
		const { shippingTaxable: _dropped, ...withoutShipping } = rate;
		expect(
			taxRatePackV2CreateBodySchema.safeParse({
				...ratePack,
				rates: [withoutShipping],
			}).success,
		).toBe(false);
	});
});

describe("admin configuration round-trips through the quote engine", () => {
	it("produces a CALCULATED quote from a pack and policy created by the admin surface", async () => {
		// The admin endpoints and the engine share storage but validated
		// independently, so a record the surface wrote could be one the engine
		// refuses. Only invoking the engine on admin-written rows proves the two
		// agree; asserting on the endpoint response alone cannot.
		const data = createMockDataService();
		const store = { tables: new Map(), data } as unknown as ReturnType<
			typeof dataService
		>;

		await call(adminCreateTaxRatePackV2, store)({ body: ratePack });
		await call(adminCreateTaxPolicyV2, store)({ body: policy });

		const result = await handleTaxQuoteV2(
			data,
			{
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
						lineId: "line-a",
						productId: "product-a",
						taxCategoryId: "standard",
						quantity: 1,
						unitAmount: 1_000,
					},
				],
				shippingAmount: 0,
				marketplaceStatus: "NOT_MARKETPLACE" as const,
			},
			{
				now: () => new Date("2026-08-13T12:00:00.000Z"),
				createQuoteId: () => "tax-quote-round-trip",
			},
		);

		expect(result).toMatchObject({
			ok: true,
			decision: {
				status: "CALCULATED",
				jurisdictionDecision: "COLLECT",
				// 8.25% of 1000 minor units, rounded half up.
				lineAllocations: [{ lineId: "line-a", taxAmount: 83 }],
			},
		});
	});

	it("refuses a TaxJar policy that does not state its source version", () => {
		const { ratePackId: _unused, ...base } = policy;
		expect(
			taxPolicyV2CreateBodySchema.safeParse({
				...base,
				calculationSource: "TAXJAR",
			}).success,
		).toBe(false);
		expect(
			taxPolicyV2CreateBodySchema.safeParse({
				...base,
				calculationSource: "TAXJAR",
				sourceVersion: "2026-08-01",
			}).success,
		).toBe(true);
	});
});
