import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema";
import { z } from "@86d-app/core/zod";

export const facebookShopListingShape = z.object({
	id: z.string().register(col, { pk: true }),
	localProductId: z.string(),
	externalProductId: z.string().optional(),
	title: z.string(),
	status: z.string().default("draft"),
	syncStatus: z.string().default("pending"),
	lastSyncedAt: z.coerce.date().optional(),
	error: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const facebookShopChannelOrderShape = z.object({
	id: z.string().register(col, { pk: true }),
	externalOrderId: z.string(),
	status: z.string().default("pending"),
	items: z.array(z.unknown()).default([]),
	subtotal: z.int().default(0),
	shippingFee: z.int().default(0),
	platformFee: z.int().default(0),
	total: z.int().default(0),
	customerName: z.string().optional(),
	shippingAddress: z.record(z.string(), z.unknown()).default({}),
	trackingNumber: z.string().optional(),
	trackingUrl: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const facebookShopCatalogSyncShape = z.object({
	id: z.string().register(col, { pk: true }),
	status: z.string().default("pending"),
	totalProducts: z.int().default(0),
	syncedProducts: z.int().default(0),
	failedProducts: z.int().default(0),
	error: z.string().optional(),
	startedAt: z.coerce.date().default(() => new Date()),
	completedAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const facebookShopCollectionShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	externalId: z.string().optional(),
	productIds: z.array(z.unknown()).default([]),
	status: z.string().default("active"),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for facebook-shop. */
export const facebookShopStorage = {
	kind: "relational",
	tables: {
		listing: {
			shape: facebookShopListingShape,
		},
		channelOrder: {
			shape: facebookShopChannelOrderShape,
		},
		catalogSync: {
			shape: facebookShopCatalogSyncShape,
		},
		collection: {
			shape: facebookShopCollectionShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
