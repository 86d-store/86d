import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const brandsBrandShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	slug: z.string().register(col, { unique: true }),
	description: z.string().optional(),
	logo: z.string().optional(),
	bannerImage: z.string().optional(),
	website: z.string().optional(),
	isActive: z.boolean(),
	isFeatured: z.boolean(),
	position: z.number(),
	seoTitle: z.string().optional(),
	seoDescription: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const brandsBrandProductShape = z.object({
	id: z.string().register(col, { pk: true }),
	brandId: z.string().register(col, { index: true }),
	productId: z.string().register(col, { index: true }),
	assignedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for brands. */
export const brandsStorage = {
	kind: "relational",
	tables: {
		brand: {
			shape: brandsBrandShape,
		},
		brandProduct: {
			shape: brandsBrandProductShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
