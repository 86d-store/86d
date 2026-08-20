import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema";
import { z } from "@86d-app/core/zod";

export const pinterestShopCatalogItemShape = z.object({
	id: z.string().register(col, { pk: true }),
	localProductId: z.string(),
	pinterestItemId: z.string().optional(),
	title: z.string(),
	description: z.string().optional(),
	status: z.string().default("active"),
	link: z.string(),
	imageUrl: z.string(),
	price: z.number(),
	salePrice: z.number().optional(),
	availability: z.string().default("in-stock"),
	googleCategory: z.string().optional(),
	lastSyncedAt: z.coerce.date().optional(),
	error: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const pinterestShopShoppingPinShape = z.object({
	id: z.string().register(col, { pk: true }),
	catalogItemId: z.string(),
	pinId: z.string().optional(),
	boardId: z.string().optional(),
	title: z.string(),
	description: z.string().optional(),
	link: z.string(),
	imageUrl: z.string(),
	impressions: z.int().default(0),
	saves: z.int().default(0),
	clicks: z.int().default(0),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const pinterestShopCatalogSyncShape = z.object({
	id: z.string().register(col, { pk: true }),
	status: z.string().default("pending"),
	totalItems: z.int().default(0),
	syncedItems: z.int().default(0),
	failedItems: z.int().default(0),
	error: z.string().optional(),
	startedAt: z.coerce.date().default(() => new Date()),
	completedAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for pinterest-shop. */
export const pinterestShopStorage = {
	kind: "relational",
	tables: {
		catalogItem: {
			shape: pinterestShopCatalogItemShape,
		},
		shoppingPin: {
			shape: pinterestShopShoppingPinShape,
		},
		catalogSync: {
			shape: pinterestShopCatalogSyncShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
