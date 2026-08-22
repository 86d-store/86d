import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";

/**
 * Merchant-approved configuration for `tax.quote` v2.
 *
 * The v2 engine answers with an explicit decision rather than an amount, and it
 * refuses to guess: with no effective policy it returns `POLICY_NOT_CONFIGURED`,
 * and with two equally specific effective policies it returns
 * `POLICY_AMBIGUOUS`. Both refusals block a Checkout. This surface is where a
 * merchant supplies the decisions that make the engine answerable, so it
 * validates at write time what the engine would otherwise reject at Checkout
 * time, when a shopper is waiting.
 */

const identifier = z
	.string()
	.min(1)
	.max(200)
	.transform(sanitizeText)
	.pipe(z.string().min(1).max(200));

const text = (max: number) =>
	z
		.string()
		.min(1)
		.max(max)
		.transform(sanitizeText)
		.pipe(z.string().min(1).max(max));

/** `*` matches any value at that level; the engine scores it as less specific. */
const jurisdictionPart = z
	.string()
	.min(1)
	.max(200)
	.transform(sanitizeText)
	.pipe(z.string().min(1).max(200));

const rateSchema = z
	.object({
		id: identifier,
		country: z.string().length(2),
		state: jurisdictionPart,
		city: jurisdictionPart,
		postalCode: jurisdictionPart,
		taxCategoryId: identifier,
		rateBasisPoints: z.number().int().nonnegative().max(100_000),
		shippingTaxable: z.boolean(),
	})
	.strict();

const effectiveWindow = {
	effectiveFrom: z.coerce.date(),
	effectiveTo: z.coerce.date().optional(),
};

function windowIsOrdered(record: {
	effectiveFrom: Date;
	effectiveTo?: Date | undefined;
}) {
	return (
		record.effectiveTo === undefined ||
		record.effectiveFrom.getTime() < record.effectiveTo.getTime()
	);
}

/** Half-open `[from, to)` overlap, where an absent end means "still effective". */
function windowsOverlap(
	left: { effectiveFrom: Date; effectiveTo?: Date | undefined },
	right: { effectiveFrom: Date; effectiveTo?: Date | undefined },
) {
	const leftEnd = left.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
	const rightEnd = right.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
	return (
		left.effectiveFrom.getTime() < rightEnd &&
		right.effectiveFrom.getTime() < leftEnd
	);
}

const storedPolicySchema = z
	.object({
		id: z.string(),
		country: z.string(),
		state: z.string(),
		city: z.string().optional(),
		postalCode: z.string().optional(),
		effectiveFrom: z.coerce.date(),
		effectiveTo: z.coerce.date().optional(),
		enabled: z.boolean(),
	})
	.passthrough();

/**
 * The jurisdiction identity the engine scores. Two enabled policies sharing it
 * over an overlapping window score identically, which is exactly the
 * `POLICY_AMBIGUOUS` condition.
 */
function jurisdictionKey(record: {
	country: string;
	state: string;
	city?: string | undefined;
	postalCode?: string | undefined;
}) {
	return [
		record.country,
		record.state,
		(record.city ?? "*").toLowerCase(),
		record.postalCode ?? "*",
	].join("|");
}

/** The approved-rates contract, exported so it can be verified on its own. */
export const taxRatePackV2CreateBodySchema = z
	.object({
		id: identifier,
		version: text(100),
		sourceKind: z.enum(["MANUAL", "OFFICIAL_DATA"]),
		sourceName: text(200),
		sourceReference: text(500),
		...effectiveWindow,
		rates: z.array(rateSchema).min(1).max(10_000),
	})
	.strict();

/**
 * The jurisdiction-decision contract.
 *
 * A merchant may decide not to collect, but may not leave a collecting decision
 * without a stated basis: the engine would have nothing to calculate from, and
 * the failure would surface to a shopper rather than to whoever configured it.
 */
export const taxPolicyV2CreateBodySchema = z
	.object({
		id: identifier,
		version: text(100),
		country: z.string().length(2),
		state: jurisdictionPart,
		city: jurisdictionPart.optional(),
		postalCode: jurisdictionPart.optional(),
		jurisdictionDecision: z.enum([
			"COLLECT",
			"NO_NEXUS",
			"MARKETPLACE_COLLECTED",
			"BLOCKED",
		]),
		calculationSource: z.enum(["RATE_PACK", "TAXJAR"]).optional(),
		ratePackId: identifier.optional(),
		sourceVersion: text(100).optional(),
		...effectiveWindow,
		quoteTtlSeconds: z.number().int().positive().max(86_400),
	})
	.strict()
	.superRefine((policy, context) => {
		if (policy.calculationSource === "RATE_PACK" && !policy.ratePackId) {
			context.addIssue({
				code: "custom",
				message: "A rate-pack policy must name its rate pack.",
				path: ["ratePackId"],
			});
		}
		// The engine refuses a TaxJar policy with no source version
		// (PROVIDER_NOT_CONFIGURED), so accepting one here would publish a
		// configuration that returns REVIEW_REQUIRED on every quote in that
		// jurisdiction until a merchant notices and recreates it.
		if (policy.calculationSource === "TAXJAR" && !policy.sourceVersion) {
			context.addIssue({
				code: "custom",
				message: "A TaxJar policy must state its source version.",
				path: ["sourceVersion"],
			});
		}
		if (
			policy.jurisdictionDecision === "COLLECT" &&
			!policy.calculationSource
		) {
			context.addIssue({
				code: "custom",
				message: "A collecting policy must name how tax is calculated.",
				path: ["calculationSource"],
			});
		}
		if (policy.ratePackId && policy.calculationSource !== "RATE_PACK") {
			context.addIssue({
				code: "custom",
				message: "Only a rate-pack policy may name a rate pack.",
				path: ["calculationSource"],
			});
		}
	});

export const adminCreateTaxRatePackV2 = createAdminEndpoint(
	"/admin/tax/v2/rate-packs/create",
	{
		method: "POST",
		body: taxRatePackV2CreateBodySchema,
	},
	async (ctx) => {
		if (!windowIsOrdered(ctx.body)) {
			return {
				code: "TAX_RATE_PACK_WINDOW_INVALID",
				error: "A rate pack must end after it begins.",
				status: 400,
			};
		}

		const rateIds = new Set(ctx.body.rates.map((rate) => rate.id));
		if (rateIds.size !== ctx.body.rates.length) {
			return {
				code: "TAX_RATE_PACK_RATES_DUPLICATED",
				error: "Every rate in a pack must have a distinct identifier.",
				status: 400,
			};
		}

		// A pack is the provenance record for the rates a merchant approved, so it
		// is immutable. Correcting one means publishing a new version and moving
		// the policy to it, which keeps the quote that used the old rates
		// explainable.
		const existing = await ctx.context.data.get("taxRatePackV2", ctx.body.id);
		if (existing) {
			return {
				code: "TAX_RATE_PACK_EXISTS",
				error: "That rate pack identifier is already published.",
				status: 409,
			};
		}

		const ratePack = {
			...ctx.body,
			enabled: true,
			createdAt: new Date(),
		};
		await ctx.context.data.upsert("taxRatePackV2", ratePack.id, ratePack);
		return { ratePack };
	},
);

export const adminListTaxRatePacksV2 = createAdminEndpoint(
	"/admin/tax/v2/rate-packs",
	{
		method: "GET",
		query: z
			.object({
				limit: z.coerce.number().int().min(1).max(100).default(25),
				offset: z.coerce.number().int().min(0).default(0),
			})
			.strict(),
	},
	async (ctx) => {
		const ratePacks = await ctx.context.data.findMany("taxRatePackV2", {
			take: ctx.query.limit,
			skip: ctx.query.offset,
			orderBy: { createdAt: "desc" },
		});
		return { ratePacks };
	},
);

export const adminCreateTaxPolicyV2 = createAdminEndpoint(
	"/admin/tax/v2/policies/create",
	{
		method: "POST",
		body: taxPolicyV2CreateBodySchema,
	},
	async (ctx) => {
		if (!windowIsOrdered(ctx.body)) {
			return {
				code: "TAX_POLICY_WINDOW_INVALID",
				error: "A policy must end after it begins.",
				status: 400,
			};
		}

		const existing = await ctx.context.data.get("taxPolicyV2", ctx.body.id);
		if (existing) {
			return {
				code: "TAX_POLICY_EXISTS",
				error: "That policy identifier is already published.",
				status: 409,
			};
		}

		// A policy that names a missing or disabled pack would answer
		// RATE_PACK_NOT_CONFIGURED at Checkout. Refusing here turns a shopper-facing
		// failure into a merchant-facing one.
		if (ctx.body.ratePackId) {
			const ratePack = await ctx.context.data.get(
				"taxRatePackV2",
				ctx.body.ratePackId,
			);
			if (!ratePack) {
				return {
					code: "TAX_RATE_PACK_NOT_FOUND",
					error: "The referenced rate pack does not exist.",
					status: 400,
				};
			}
			if ((ratePack as { enabled?: unknown }).enabled !== true) {
				return {
					code: "TAX_RATE_PACK_DISABLED",
					error: "The referenced rate pack is disabled.",
					status: 400,
				};
			}
		}

		const storedPolicies = await ctx.context.data.findMany("taxPolicyV2", {
			where: { enabled: true },
		});
		const incomingKey = jurisdictionKey(ctx.body);
		for (const stored of storedPolicies) {
			const parsed = storedPolicySchema.safeParse(stored);
			if (!parsed.success || !parsed.data.enabled) continue;
			if (jurisdictionKey(parsed.data) !== incomingKey) continue;
			if (!windowsOverlap(parsed.data, ctx.body)) continue;
			return {
				code: "TAX_POLICY_AMBIGUOUS",
				error:
					"An enabled policy already covers that jurisdiction for an overlapping period.",
				status: 409,
				conflictingPolicyId: parsed.data.id,
			};
		}

		const policy = {
			...ctx.body,
			enabled: true,
			createdAt: new Date(),
		};
		await ctx.context.data.upsert("taxPolicyV2", policy.id, policy);
		return { policy };
	},
);

export const adminListTaxPoliciesV2 = createAdminEndpoint(
	"/admin/tax/v2/policies",
	{
		method: "GET",
		query: z
			.object({
				limit: z.coerce.number().int().min(1).max(100).default(25),
				offset: z.coerce.number().int().min(0).default(0),
			})
			.strict(),
	},
	async (ctx) => {
		const policies = await ctx.context.data.findMany("taxPolicyV2", {
			take: ctx.query.limit,
			skip: ctx.query.offset,
			orderBy: { createdAt: "desc" },
		});
		return { policies };
	},
);

export const adminDisableTaxPolicyV2 = createAdminEndpoint(
	"/admin/tax/v2/policies/:id/disable",
	{
		method: "POST",
		params: z.object({ id: identifier }).strict(),
	},
	async (ctx) => {
		const stored = await ctx.context.data.get("taxPolicyV2", ctx.params.id);
		if (!stored) {
			return {
				code: "TAX_POLICY_NOT_FOUND",
				error: "The tax policy was not found.",
				status: 404,
			};
		}
		// Disabling withdraws the decision without rewriting history: the engine
		// stops reading it, and any quote it already produced stays explainable.
		const policy = { ...(stored as Record<string, unknown>), enabled: false };
		await ctx.context.data.upsert("taxPolicyV2", ctx.params.id, policy);
		return { policy };
	},
);
