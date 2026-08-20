import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema";
import { z } from "@86d-app/core/zod";

export const collectionsCollectionShape = z.object({
	id: z.string().register(col, { pk: true }),
	title: z.string(),
	slug: z.string().register(col, { unique: true }),
	description: z.string().optional(),
	image: z.string().optional(),
	type: z.string(),
	sortOrder: z.string(),
	isActive: z.boolean(),
	isFeatured: z.boolean(),
	position: z.number(),
	conditions: z.record(z.string(), z.unknown()).optional(),
	seoTitle: z.string().optional(),
	seoDescription: z.string().optional(),
	publishedAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const collectionsCollectionProductShape = z.object({
	id: z.string().register(col, { pk: true }),
	collectionId: z.string().register(col, { index: true }),
	productId: z.string().register(col, { index: true }),
	position: z.number(),
	addedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for collections. */
export const collectionsStorage = {
	kind: "relational",
	tables: {
		collection: {
			shape: collectionsCollectionShape,
		},
		collectionProduct: {
			shape: collectionsCollectionProductShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
