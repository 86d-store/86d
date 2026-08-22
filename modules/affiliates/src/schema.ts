import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const affiliatesAffiliateShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	email: z.string(),
	website: z.string().optional(),
	code: z.string(),
	commissionRate: z.number(),
	status: z.string().default("pending"),
	totalClicks: z.int().default(0),
	totalConversions: z.int().default(0),
	totalRevenue: z.int().default(0),
	totalCommission: z.int().default(0),
	totalPaid: z.int().default(0),
	customerId: z.string().optional(),
	notes: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const affiliatesAffiliateLinkShape = z.object({
	id: z.string().register(col, { pk: true }),
	affiliateId: z.string(),
	targetUrl: z.string(),
	slug: z.string(),
	clicks: z.int().default(0),
	conversions: z.int().default(0),
	revenue: z.int().default(0),
	active: z.boolean().default(true),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const affiliatesAffiliateConversionShape = z.object({
	id: z.string().register(col, { pk: true }),
	affiliateId: z.string(),
	linkId: z.string().optional(),
	orderId: z.string(),
	orderAmount: z.number(),
	commissionRate: z.number(),
	commissionAmount: z.number(),
	status: z.string().default("pending"),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const affiliatesAffiliatePayoutShape = z.object({
	id: z.string().register(col, { pk: true }),
	affiliateId: z.string(),
	amount: z.number(),
	method: z.string(),
	reference: z.string().optional(),
	notes: z.string().optional(),
	status: z.string().default("pending"),
	paidAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for affiliates. */
export const affiliatesStorage = {
	kind: "relational",
	tables: {
		affiliate: {
			shape: affiliatesAffiliateShape,
		},
		affiliateLink: {
			shape: affiliatesAffiliateLinkShape,
		},
		affiliateConversion: {
			shape: affiliatesAffiliateConversionShape,
		},
		affiliatePayout: {
			shape: affiliatesAffiliatePayoutShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
