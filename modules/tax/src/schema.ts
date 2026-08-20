import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema";
import { z } from "@86d-app/core/zod";

export const taxTaxPolicyV2Shape = z.object({
	id: z.string().register(col, { pk: true }),
	version: z.string(),
	country: z.string(),
	state: z.string(),
	city: z.string().optional(),
	postalCode: z.string().optional(),
	jurisdictionDecision: z.enum([
		"COLLECT",
		"NO_NEXUS",
		"MARKETPLACE_COLLECTED",
		"BLOCKED",
	]),
	calculationSource: z.enum(["RATE_PACK", "TAXJAR"]).optional(),
	ratePackId: z.string().optional(),
	sourceVersion: z.string().optional(),
	effectiveFrom: z.coerce.date(),
	effectiveTo: z.coerce.date().optional(),
	quoteTtlSeconds: z.number(),
	enabled: z.boolean().default(true),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const taxTaxRatePackV2Shape = z.object({
	id: z.string().register(col, { pk: true }),
	version: z.string(),
	sourceKind: z.enum(["MANUAL", "OFFICIAL_DATA"]),
	sourceName: z.string(),
	sourceReference: z.string(),
	effectiveFrom: z.coerce.date(),
	effectiveTo: z.coerce.date().optional(),
	enabled: z.boolean().default(true),
	rates: z.record(z.string(), z.unknown()),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const taxTaxExemptionV2Shape = z.object({
	id: z.string().register(col, { pk: true }),
	version: z.string(),
	customerId: z.string(),
	taxCategoryId: z.string().optional(),
	reason: z.string(),
	effectiveFrom: z.coerce.date(),
	effectiveTo: z.coerce.date().optional(),
	enabled: z.boolean().default(true),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const taxTaxRateShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	country: z.string(),
	state: z.string().default("*"),
	city: z.string().default("*"),
	postalCode: z.string().default("*"),
	rate: z.number(),
	type: z.enum(["percentage", "fixed"]).default("percentage"),
	categoryId: z.string().default("default"),
	enabled: z.boolean().default(true),
	priority: z.int().default(0),
	compound: z.boolean().default(false),
	inclusive: z.boolean().default(false),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const taxTaxCategoryShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	description: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const taxTaxExemptionShape = z.object({
	id: z.string().register(col, { pk: true }),
	customerId: z.string(),
	type: z.enum(["full", "category"]).default("full"),
	categoryId: z.string().optional(),
	taxIdNumber: z.string().optional(),
	reason: z.string().optional(),
	expiresAt: z.coerce.date().optional(),
	enabled: z.boolean().default(true),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const taxTaxNexusShape = z.object({
	id: z.string().register(col, { pk: true }),
	country: z.string(),
	state: z.string().default("*"),
	type: z.enum(["physical", "economic", "voluntary"]).default("physical"),
	enabled: z.boolean().default(true),
	notes: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const taxTaxTransactionShape = z.object({
	id: z.string().register(col, { pk: true }),
	orderId: z.string().optional(),
	customerId: z.string().optional(),
	country: z.string(),
	state: z.string(),
	city: z.string().optional(),
	postalCode: z.string().optional(),
	subtotal: z.number(),
	shippingAmount: z.int().default(0),
	totalTax: z.number(),
	shippingTax: z.int().default(0),
	effectiveRate: z.number(),
	inclusive: z.boolean().default(false),
	exempt: z.boolean().default(false),
	lineDetails: z.record(z.string(), z.unknown()),
	rateNames: z.record(z.string(), z.unknown()),
	createdAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for tax. */
export const taxStorage = {
	kind: "relational",
	tables: {
		taxPolicyV2: {
			shape: taxTaxPolicyV2Shape,
		},
		taxRatePackV2: {
			shape: taxTaxRatePackV2Shape,
		},
		taxExemptionV2: {
			shape: taxTaxExemptionV2Shape,
		},
		taxRate: {
			shape: taxTaxRateShape,
		},
		taxCategory: {
			shape: taxTaxCategoryShape,
		},
		taxExemption: {
			shape: taxTaxExemptionShape,
		},
		taxNexus: {
			shape: taxTaxNexusShape,
		},
		taxTransaction: {
			shape: taxTaxTransactionShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
