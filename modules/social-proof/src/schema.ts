import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema";
import { z } from "@86d-app/core/zod";

export const socialProofActivityEventShape = z.object({
	id: z.string().register(col, { pk: true }),
	productId: z.string(),
	productName: z.string(),
	productSlug: z.string(),
	productImage: z.string().optional(),
	eventType: z.string(),
	region: z.string().optional(),
	country: z.string().optional(),
	city: z.string().optional(),
	quantity: z.number().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const socialProofTrustBadgeShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	description: z.string().optional(),
	icon: z.string(),
	url: z.string().optional(),
	position: z.string(),
	priority: z.number(),
	isActive: z.boolean(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for social-proof. */
export const socialProofStorage = {
	kind: "relational",
	tables: {
		activityEvent: {
			shape: socialProofActivityEventShape,
		},
		trustBadge: {
			shape: socialProofTrustBadgeShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
