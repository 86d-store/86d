import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema";
import { z } from "@86d-app/core/zod";

export const bundlesBundleShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	slug: z.string(),
	description: z.string().optional(),
	status: z.string(),
	discountType: z.string(),
	discountValue: z.number(),
	minQuantity: z.number().optional(),
	maxQuantity: z.number().optional(),
	startsAt: z.string().optional(),
	endsAt: z.string().optional(),
	imageUrl: z.string().optional(),
	sortOrder: z.number().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const bundlesBundleItemShape = z.object({
	id: z.string().register(col, { pk: true }),
	bundleId: z.string(),
	productId: z.string(),
	variantId: z.string().optional(),
	quantity: z.number(),
	sortOrder: z.number().optional(),
	productName: z.string().optional(),
	productSlug: z.string().optional(),
	productImageUrl: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for bundles. */
export const bundlesStorage = {
	kind: "relational",
	tables: {
		bundle: {
			shape: bundlesBundleShape,
		},
		bundleItem: {
			shape: bundlesBundleItemShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
