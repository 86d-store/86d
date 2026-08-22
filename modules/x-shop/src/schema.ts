import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const xShopListingShape = z.object({
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

export const xShopChannelOrderShape = z.object({
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

export const xShopProductDropShape = z.object({
	id: z.string().register(col, { pk: true }),
	name: z.string(),
	description: z.string().optional(),
	productIds: z.array(z.unknown()).default([]),
	launchDate: z.coerce.date().default(() => new Date()),
	endDate: z.coerce.date().optional(),
	status: z.string().default("scheduled"),
	tweetId: z.string().optional(),
	impressions: z.int().default(0),
	clicks: z.int().default(0),
	conversions: z.int().default(0),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for x-shop. */
export const xShopStorage = {
	kind: "relational",
	tables: {
		listing: {
			shape: xShopListingShape,
		},
		channelOrder: {
			shape: xShopChannelOrderShape,
		},
		productDrop: {
			shape: xShopProductDropShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
