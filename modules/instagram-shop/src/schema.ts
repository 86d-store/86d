import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const instagramShopListingShape = z.object({
	id: z.string().register(col, { pk: true }),
	localProductId: z.string(),
	externalProductId: z.string().optional(),
	title: z.string(),
	status: z.string().default("draft"),
	syncStatus: z.string().default("pending"),
	lastSyncedAt: z.coerce.date().optional(),
	error: z.string().optional(),
	instagramMediaIds: z.array(z.unknown()).default([]),
	metadata: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const instagramShopChannelOrderShape = z.object({
	id: z.string().register(col, { pk: true }),
	externalOrderId: z.string(),
	instagramOrderId: z.string(),
	igUsername: z.string().optional(),
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

export const instagramShopCatalogSyncShape = z.object({
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

/** Native Relational storage for instagram-shop. */
export const instagramShopStorage = {
	kind: "relational",
	tables: {
		listing: {
			shape: instagramShopListingShape,
		},
		channelOrder: {
			shape: instagramShopChannelOrderShape,
		},
		catalogSync: {
			shape: instagramShopCatalogSyncShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
