import {
	type CapabilityDecision,
	type CapabilityRequest,
	provideCapability,
} from "@86d-app/core/capabilities";
import { taxQuoteV2Capability } from "@86d-app/core/commerce-capabilities";
import type { ModuleDataService } from "@86d-app/core/types/module";
import { z } from "zod";
import type { TaxProviderV2Result, TaxQuoteProviderV2 } from "./provider-v2";

type TaxQuoteV2Request = CapabilityRequest<typeof taxQuoteV2Capability>;
type TaxQuoteV2Decision = CapabilityDecision<typeof taxQuoteV2Capability>;
type TaxQuoteV2Reason = TaxQuoteV2Decision["reason"];

const taxPolicyV2Schema = z
	.object({
		id: z.string().min(1),
		version: z.string().min(1),
		country: z.string().length(2),
		state: z.string().min(1),
		city: z.string().min(1).optional(),
		postalCode: z.string().min(1).optional(),
		jurisdictionDecision: z.enum([
			"COLLECT",
			"NO_NEXUS",
			"MARKETPLACE_COLLECTED",
			"BLOCKED",
		]),
		calculationSource: z.enum(["RATE_PACK", "TAXJAR"]).optional(),
		ratePackId: z.string().min(1).optional(),
		sourceVersion: z.string().min(1).optional(),
		effectiveFrom: z.coerce.date(),
		effectiveTo: z.coerce.date().optional(),
		quoteTtlSeconds: z.number().int().positive().max(86_400),
		enabled: z.literal(true),
		// Written by the admin surface for list ordering. Declared here so a
		// stored record still parses; .strict() keeps rejecting unknown keys.
		createdAt: z.coerce.date().optional(),
	})
	.strict();

const taxRateV2Schema = z
	.object({
		id: z.string().min(1),
		country: z.string().length(2),
		state: z.string().min(1),
		city: z.string().min(1),
		postalCode: z.string().min(1),
		taxCategoryId: z.string().min(1),
		rateBasisPoints: z.number().int().nonnegative().max(100_000),
		shippingTaxable: z.boolean(),
	})
	.strict();

const taxRatePackV2Schema = z
	.object({
		id: z.string().min(1),
		version: z.string().min(1),
		sourceKind: z.enum(["MANUAL", "OFFICIAL_DATA"]),
		sourceName: z.string().min(1),
		sourceReference: z.string().min(1),
		effectiveFrom: z.coerce.date(),
		effectiveTo: z.coerce.date().optional(),
		enabled: z.literal(true),
		rates: z.array(taxRateV2Schema).min(1).max(10_000),
		// Written by the admin surface for list ordering. Declared here so a
		// stored record still parses; .strict() keeps rejecting unknown keys.
		createdAt: z.coerce.date().optional(),
	})
	.strict();

const taxExemptionV2Schema = z
	.object({
		id: z.string().min(1),
		version: z.string().min(1),
		customerId: z.string().min(1),
		taxCategoryId: z.string().min(1).optional(),
		reason: z.string().min(1),
		effectiveFrom: z.coerce.date(),
		effectiveTo: z.coerce.date().optional(),
		enabled: z.literal(true),
	})
	.strict();

type TaxPolicyV2 = z.infer<typeof taxPolicyV2Schema>;
type TaxRateV2 = z.infer<typeof taxRateV2Schema>;

export type TaxQuoteV2Dependencies = {
	now?: (() => Date) | undefined;
	createQuoteId?: (() => string) | undefined;
	provider?: TaxQuoteProviderV2 | undefined;
};

function isEffective(
	record: { effectiveFrom: Date; effectiveTo?: Date | undefined },
	now: Date,
) {
	return (
		record.effectiveFrom.getTime() <= now.getTime() &&
		(record.effectiveTo === undefined ||
			now.getTime() < record.effectiveTo.getTime())
	);
}

function jurisdictionScore(
	record: {
		country: string;
		state: string;
		city?: string | undefined;
		postalCode?: string | undefined;
	},
	address: TaxQuoteV2Request["address"],
) {
	if (record.country !== address.country) return -1;
	let score = 1;
	if (record.state !== "*") {
		if (record.state !== address.state) return -1;
		score += 10;
	}
	if (record.city !== undefined && record.city !== "*") {
		if (record.city.toLowerCase() !== address.city?.toLowerCase()) return -1;
		score += 100;
	}
	if (record.postalCode !== undefined && record.postalCode !== "*") {
		if (record.postalCode !== address.postalCode) return -1;
		score += 1_000;
	}
	return score;
}

function effectivePolicies(
	configuredPolicies: TaxPolicyV2[],
	address: TaxQuoteV2Request["address"],
	now: Date,
) {
	return configuredPolicies
		.filter((policy) => isEffective(policy, now))
		.map((policy) => ({
			policy,
			score: jurisdictionScore(policy, address),
		}))
		.filter(({ score }) => score >= 0)
		.sort(
			(a, b) =>
				b.score - a.score ||
				b.policy.effectiveFrom.getTime() - a.policy.effectiveFrom.getTime() ||
				a.policy.id.localeCompare(b.policy.id),
		);
}

function matchingRates(
	rates: TaxRateV2[],
	address: TaxQuoteV2Request["address"],
	taxCategoryId: string,
) {
	return rates
		.filter(
			(rate) =>
				rate.taxCategoryId === taxCategoryId ||
				rate.taxCategoryId === "default",
		)
		.map((rate) => ({
			rate,
			score: jurisdictionScore(rate, address),
			categoryScore: Number(rate.taxCategoryId === taxCategoryId),
		}))
		.filter(({ score }) => score >= 0)
		.sort(
			(a, b) =>
				b.categoryScore - a.categoryScore ||
				b.score - a.score ||
				a.rate.id.localeCompare(b.rate.id),
		);
}

function roundPositiveFraction(numerator: bigint, denominator: bigint) {
	return (numerator + denominator / 2n) / denominator;
}

function toSafeNumber(value: bigint) {
	const result = Number(value);
	return Number.isSafeInteger(result) ? result : null;
}

function expiresAt(policy: TaxPolicyV2, issuedAt: Date, sourceExpiry?: Date) {
	return new Date(
		Math.min(
			issuedAt.getTime() + policy.quoteTtlSeconds * 1_000,
			policy.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY,
			sourceExpiry?.getTime() ?? Number.POSITIVE_INFINITY,
		),
	).toISOString();
}

export async function handleTaxQuoteV2(
	data: ModuleDataService,
	request: TaxQuoteV2Request,
	dependencies: TaxQuoteV2Dependencies = {},
): Promise<{ ok: true; decision: TaxQuoteV2Decision }> {
	const issuedAt = dependencies.now?.() ?? new Date();
	const inputLines = request.lineItems.map((line) => {
		const grossAmount = line.unitAmount * line.quantity;
		const discountAmount = line.discountAmount ?? 0;
		return {
			lineId: line.lineId,
			productId: line.productId,
			...(line.variantId ? { variantId: line.variantId } : {}),
			taxCategoryId: line.taxCategoryId,
			quantity: line.quantity,
			grossAmount,
			discountAmount,
			taxableAmount: grossAmount - discountAmount,
		};
	});
	const subtotal = inputLines.reduce(
		(total, line) => total + line.grossAmount,
		0,
	);
	const discount = inputLines.reduce(
		(total, line) => total + line.discountAmount,
		0,
	);
	const shipping = request.shippingAmount ?? 0;
	const base = {
		quoteId: dependencies.createQuoteId?.() ?? crypto.randomUUID(),
		issuedAt: issuedAt.toISOString(),
		currency: request.currency,
	};
	const unresolved = (
		reason: TaxQuoteV2Reason,
		policy?: TaxPolicyV2,
		sourceVersion = "unconfigured",
	): { ok: true; decision: TaxQuoteV2Decision } => ({
		ok: true,
		decision: {
			...base,
			jurisdictionDecision: "BLOCKED",
			status: "REVIEW_REQUIRED",
			reason,
			policyVersion: policy?.version ?? "unconfigured",
			sourceVersion,
			expiresAt: new Date(
				issuedAt.getTime() + (policy?.quoteTtlSeconds ?? 300) * 1_000,
			).toISOString(),
			totals: {
				subtotal,
				discount,
				shipping,
				taxable: subtotal - discount,
				lineTax: null,
				shippingTax: null,
				tax: null,
				grandTotal: null,
			},
			lineAllocations: inputLines.map((line) => ({
				...line,
				taxAmount: null,
			})),
		},
	});
	const zeroDecision = (
		policy: TaxPolicyV2,
		status: "NO_NEXUS" | "MARKETPLACE_COLLECTED" | "EXEMPT",
		reason: "NO_NEXUS_POLICY" | "MARKETPLACE_POLICY" | "EXEMPTION_APPLIED",
		sourceVersion: string,
	): { ok: true; decision: TaxQuoteV2Decision } => ({
		ok: true,
		decision: {
			...base,
			jurisdictionDecision:
				status === "NO_NEXUS"
					? "NO_NEXUS"
					: status === "MARKETPLACE_COLLECTED"
						? "MARKETPLACE_COLLECTED"
						: "COLLECT",
			status,
			reason,
			policyVersion: policy.version,
			sourceVersion,
			expiresAt: expiresAt(policy, issuedAt),
			totals: {
				subtotal,
				discount,
				shipping,
				taxable: subtotal - discount,
				lineTax: 0,
				shippingTax: 0,
				tax: 0,
				grandTotal: subtotal - discount + shipping,
			},
			lineAllocations: inputLines.map((line) => ({
				...line,
				taxAmount: 0,
			})),
		},
	});

	const policyRows = await data.findMany("taxPolicyV2", {
		where: { enabled: true },
	});
	const parsedPolicies = policyRows.map((row) =>
		taxPolicyV2Schema.safeParse(row),
	);
	if (parsedPolicies.some((result) => !result.success)) {
		return unresolved("POLICY_INVALID");
	}
	const configuredPolicies = parsedPolicies
		.filter((result) => result.success)
		.map((result) => result.data);
	const policies = effectivePolicies(
		configuredPolicies,
		request.address,
		issuedAt,
	);
	const policy = policies[0]?.policy;
	if (!policy) return unresolved("POLICY_NOT_CONFIGURED");
	if (policies[1]?.score === policies[0]?.score) {
		return unresolved("POLICY_AMBIGUOUS", policy);
	}
	if (policy.jurisdictionDecision === "BLOCKED") {
		return unresolved("POLICY_BLOCKED", policy, policy.sourceVersion);
	}
	if (request.marketplaceStatus === "UNKNOWN") {
		return unresolved("MARKETPLACE_STATUS_UNRESOLVED", policy);
	}
	if (request.marketplaceStatus === "COLLECTED") {
		if (policy.jurisdictionDecision === "MARKETPLACE_COLLECTED") {
			return zeroDecision(
				policy,
				"MARKETPLACE_COLLECTED",
				"MARKETPLACE_POLICY",
				policy.sourceVersion ?? policy.version,
			);
		}
		return unresolved("MARKETPLACE_POLICY_CONFLICT", policy);
	}
	if (policy.jurisdictionDecision === "MARKETPLACE_COLLECTED") {
		return unresolved("MARKETPLACE_POLICY_CONFLICT", policy);
	}
	if (policy.jurisdictionDecision === "NO_NEXUS") {
		return zeroDecision(
			policy,
			"NO_NEXUS",
			"NO_NEXUS_POLICY",
			policy.sourceVersion ?? policy.version,
		);
	}

	if (request.customerId) {
		const exemptionRows = await data.findMany("taxExemptionV2", {
			where: { customerId: request.customerId, enabled: true },
		});
		const exemptionResults = exemptionRows.map((row) =>
			taxExemptionV2Schema.safeParse(row),
		);
		if (exemptionResults.some((result) => !result.success)) {
			return unresolved("EXEMPTION_INVALID", policy);
		}
		const exemptions = exemptionResults
			.filter((result) => result.success)
			.map((result) => result.data)
			.filter((exemption) => isEffective(exemption, issuedAt));
		const fullExemption = exemptions.find(
			(exemption) => exemption.taxCategoryId === undefined,
		);
		if (fullExemption) {
			return zeroDecision(
				policy,
				"EXEMPT",
				"EXEMPTION_APPLIED",
				fullExemption.version,
			);
		}
		if (exemptions.some((exemption) => exemption.taxCategoryId !== undefined)) {
			return unresolved("EXEMPTION_UNSUPPORTED", policy);
		}
	}

	if (policy.calculationSource === "TAXJAR") {
		if (dependencies.provider?.kind !== "TAXJAR" || !policy.sourceVersion) {
			return unresolved("PROVIDER_NOT_CONFIGURED", policy);
		}
		let providerResult: TaxProviderV2Result;
		try {
			providerResult = await dependencies.provider.quote(request);
		} catch {
			return unresolved("PROVIDER_FAILED", policy, policy.sourceVersion);
		}
		if (!providerResult.ok) {
			return unresolved(providerResult.reason, policy, policy.sourceVersion);
		}
		if (!providerResult.hasNexus) {
			return unresolved(
				"PROVIDER_NEXUS_CONFLICT",
				policy,
				policy.sourceVersion,
			);
		}
		const allocations = new Map(
			providerResult.lineAllocations.map((line) => [line.lineId, line]),
		);
		if (
			allocations.size !== inputLines.length ||
			inputLines.some((line) => !allocations.has(line.lineId))
		) {
			return unresolved(
				"PROVIDER_RESPONSE_INVALID",
				policy,
				policy.sourceVersion,
			);
		}
		const lineTax = providerResult.lineAllocations.reduce(
			(total, line) => total + line.taxAmount,
			0,
		);
		if (
			lineTax + providerResult.shippingTax !== providerResult.totalTax ||
			!Number.isSafeInteger(providerResult.totalTax)
		) {
			return unresolved(
				"PROVIDER_RESPONSE_INVALID",
				policy,
				policy.sourceVersion,
			);
		}
		return {
			ok: true,
			decision: {
				...base,
				jurisdictionDecision: "COLLECT",
				status: "CALCULATED",
				reason: "TAX_CALCULATED",
				policyVersion: policy.version,
				sourceVersion: policy.sourceVersion,
				expiresAt: expiresAt(policy, issuedAt),
				source: {
					kind: "PROVIDER",
					name: dependencies.provider.name,
					reference: providerResult.sourceReference,
					connectionId: dependencies.provider.connectionId,
				},
				totals: {
					subtotal,
					discount,
					shipping,
					taxable: subtotal - discount,
					lineTax,
					shippingTax: providerResult.shippingTax,
					tax: providerResult.totalTax,
					grandTotal: subtotal - discount + shipping + providerResult.totalTax,
				},
				lineAllocations: inputLines.flatMap((line) => {
					const allocation = allocations.get(line.lineId);
					if (!allocation) return [];
					return [
						{
							...line,
							taxableAmount: allocation.taxableAmount,
							taxAmount: allocation.taxAmount,
						},
					];
				}),
			},
		};
	}

	if (policy.calculationSource !== "RATE_PACK" || !policy.ratePackId) {
		return unresolved("RATE_PACK_NOT_CONFIGURED", policy);
	}
	const ratePackRow = await data.get("taxRatePackV2", policy.ratePackId);
	if (!ratePackRow) return unresolved("RATE_PACK_NOT_CONFIGURED", policy);
	const parsedRatePack = taxRatePackV2Schema.safeParse(ratePackRow);
	if (!parsedRatePack.success) return unresolved("RATE_PACK_INVALID", policy);
	const ratePack = parsedRatePack.data;
	if (!isEffective(ratePack, issuedAt)) {
		return unresolved("RATE_PACK_STALE", policy, ratePack.version);
	}
	const rateLines = inputLines.map((line) => {
		const candidates = matchingRates(
			ratePack.rates,
			request.address,
			line.taxCategoryId,
		);
		return {
			line,
			rate: candidates[0]?.rate ?? null,
			ambiguous:
				candidates.length > 1 &&
				candidates[0]?.score === candidates[1]?.score &&
				candidates[0]?.categoryScore === candidates[1]?.categoryScore,
		};
	});
	if (rateLines.some(({ ambiguous }) => ambiguous)) {
		return unresolved("RATE_AMBIGUOUS", policy, ratePack.version);
	}
	if (rateLines.some(({ rate }) => rate === null)) {
		return unresolved("RATE_NOT_CONFIGURED", policy, ratePack.version);
	}

	const denominator = 10_000n;
	const provisional = rateLines.map(({ line, rate }) => {
		const numerator =
			BigInt(line.taxableAmount) * BigInt(rate?.rateBasisPoints ?? 0);
		return {
			line,
			numerator,
			baseTax: numerator / denominator,
			remainder: numerator % denominator,
		};
	});
	const roundedLineTax = roundPositiveFraction(
		provisional.reduce((total, allocation) => total + allocation.numerator, 0n),
		denominator,
	);
	let remaining =
		roundedLineTax -
		provisional.reduce((total, allocation) => total + allocation.baseTax, 0n);
	const remainderRecipients = [...provisional].sort(
		(a, b) =>
			Number(b.remainder - a.remainder) ||
			a.line.lineId.localeCompare(b.line.lineId),
	);
	const taxByLineId = new Map(
		provisional.map((allocation) => [
			allocation.line.lineId,
			allocation.baseTax,
		]),
	);
	for (const allocation of remainderRecipients) {
		if (remaining <= 0n) break;
		taxByLineId.set(allocation.line.lineId, allocation.baseTax + 1n);
		remaining -= 1n;
	}
	const shippingCandidates = matchingRates(
		ratePack.rates,
		request.address,
		"default",
	);
	if (
		shippingCandidates.length > 1 &&
		shippingCandidates[0]?.score === shippingCandidates[1]?.score &&
		shippingCandidates[0]?.categoryScore ===
			shippingCandidates[1]?.categoryScore
	) {
		return unresolved("RATE_AMBIGUOUS", policy, ratePack.version);
	}
	const shippingRate = shippingCandidates[0]?.rate ?? null;
	if (shipping > 0 && !shippingRate) {
		return unresolved("RATE_NOT_CONFIGURED", policy, ratePack.version);
	}
	const shippingTaxValue =
		shipping > 0 && shippingRate?.shippingTaxable
			? roundPositiveFraction(
					BigInt(shipping) * BigInt(shippingRate.rateBasisPoints),
					denominator,
				)
			: 0n;
	const lineTax = toSafeNumber(roundedLineTax);
	const shippingTax = toSafeNumber(shippingTaxValue);
	const allocationTaxes = inputLines.map((line) =>
		toSafeNumber(taxByLineId.get(line.lineId) ?? 0n),
	);
	if (
		lineTax === null ||
		shippingTax === null ||
		allocationTaxes.some((taxAmount) => taxAmount === null)
	) {
		return unresolved("MONEY_OVERFLOW", policy, ratePack.version);
	}
	const tax = lineTax + shippingTax;
	return {
		ok: true,
		decision: {
			...base,
			jurisdictionDecision: "COLLECT",
			status: "CALCULATED",
			reason: "TAX_CALCULATED",
			policyVersion: policy.version,
			sourceVersion: ratePack.version,
			expiresAt: expiresAt(policy, issuedAt, ratePack.effectiveTo),
			source: {
				kind: ratePack.sourceKind,
				name: ratePack.sourceName,
				reference: ratePack.sourceReference,
			},
			totals: {
				subtotal,
				discount,
				shipping,
				taxable: subtotal - discount,
				lineTax,
				shippingTax,
				tax,
				grandTotal: subtotal - discount + shipping + tax,
			},
			lineAllocations: inputLines.map((line, index) => ({
				...line,
				taxAmount: allocationTaxes[index] ?? null,
			})),
		},
	};
}

export function createTaxQuoteV2Provider(
	dependencies: TaxQuoteV2Dependencies = {},
) {
	return provideCapability(taxQuoteV2Capability, async (context, request) => {
		try {
			return await handleTaxQuoteV2(context.data, request, dependencies);
		} catch {
			const unavailableAt = new Date();
			const unavailableLines = request.lineItems.map((line) => {
				const grossAmount = line.unitAmount * line.quantity;
				const discountAmount = line.discountAmount ?? 0;
				return {
					lineId: line.lineId,
					productId: line.productId,
					...(line.variantId ? { variantId: line.variantId } : {}),
					taxCategoryId: line.taxCategoryId,
					quantity: line.quantity,
					grossAmount,
					discountAmount,
					taxableAmount: grossAmount - discountAmount,
					taxAmount: null,
				};
			});
			const subtotal = unavailableLines.reduce(
				(total, line) => total + line.grossAmount,
				0,
			);
			const discount = unavailableLines.reduce(
				(total, line) => total + line.discountAmount,
				0,
			);
			const decision = taxQuoteV2Capability.decision.parse({
				quoteId: dependencies.createQuoteId?.() ?? crypto.randomUUID(),
				jurisdictionDecision: "BLOCKED",
				status: "REVIEW_REQUIRED",
				reason: "TAX_DATA_UNAVAILABLE",
				policyVersion: "unavailable",
				sourceVersion: "unavailable",
				issuedAt: unavailableAt.toISOString(),
				expiresAt: new Date(
					unavailableAt.getTime() + 5 * 60 * 1_000,
				).toISOString(),
				currency: request.currency,
				totals: {
					subtotal,
					discount,
					shipping: request.shippingAmount ?? 0,
					taxable: subtotal - discount,
					lineTax: null,
					shippingTax: null,
					tax: null,
					grandTotal: null,
				},
				lineAllocations: unavailableLines,
			});
			return {
				ok: true,
				decision,
			};
		}
	});
}
