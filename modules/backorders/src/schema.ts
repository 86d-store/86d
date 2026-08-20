import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema";
import { z } from "@86d-app/core/zod";

export const backordersBackorderShape = z.object({
	id: z.string().register(col, { pk: true }),
	productId: z.string(),
	productName: z.string(),
	variantId: z.string().optional(),
	variantLabel: z.string().optional(),
	customerId: z.string(),
	customerEmail: z.string(),
	orderId: z.string().optional(),
	quantity: z.number(),
	status: z.string(),
	estimatedAvailableAt: z.coerce.date().optional(),
	allocatedAt: z.coerce.date().optional(),
	shippedAt: z.coerce.date().optional(),
	cancelledAt: z.coerce.date().optional(),
	cancelReason: z.string().optional(),
	notes: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const backordersBackorderPolicyShape = z.object({
	id: z.string().register(col, { pk: true }),
	productId: z.string(),
	enabled: z.boolean(),
	maxQuantityPerOrder: z.number().optional(),
	maxTotalBackorders: z.number().optional(),
	estimatedLeadDays: z.number().optional(),
	autoConfirm: z.boolean(),
	message: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for backorders. */
export const backordersStorage = {
	kind: "relational",
	tables: {
		backorder: {
			shape: backordersBackorderShape,
		},
		backorderPolicy: {
			shape: backordersBackorderPolicyShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
