import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const vendorsVendorShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	slug: z.string().register(col, { unique: true }),
	email: z.string(),
	phone: z.string().optional(),
	description: z.string().optional(),
	logo: z.string().optional(),
	banner: z.string().optional(),
	website: z.string().optional(),
	commissionRate: z.number(),
	status: z.string(),
	addressLine1: z.string().optional(),
	addressLine2: z.string().optional(),
	city: z.string().optional(),
	state: z.string().optional(),
	postalCode: z.string().optional(),
	country: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
	joinedAt: z.coerce.date().default(() => new Date()),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const vendorsVendorProductShape = z.object({
	id: z.string().register(col, { pk: true }),
	vendorId: z.string().register(col, { index: true }),
	productId: z.string().register(col, { index: true }),
	commissionOverride: z.number().optional(),
	status: z.string(),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const vendorsVendorPayoutShape = z.object({
	id: z.string().register(col, { pk: true }),
	vendorId: z.string().register(col, { index: true }),
	amount: z.number(),
	currency: z.string(),
	status: z.string(),
	method: z.string().optional(),
	reference: z.string().optional(),
	periodStart: z.coerce.date(),
	periodEnd: z.coerce.date(),
	notes: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	completedAt: z.coerce.date().optional(),
});

/** Native Relational storage for vendors. */
export const vendorsStorage = {
	kind: "relational",
	tables: {
		vendor: {
			shape: vendorsVendorShape,
		},
		vendorProduct: {
			shape: vendorsVendorProductShape,
		},
		vendorPayout: {
			shape: vendorsVendorPayoutShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
