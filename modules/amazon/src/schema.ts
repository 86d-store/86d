import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const amazonListingShape = z.object({
	id: z.string().register(col, { pk: true }),
	localProductId: z.string(),
	asin: z.string().optional(),
	sku: z.string(),
	title: z.string(),
	status: z.string().default("incomplete"),
	fulfillmentChannel: z.string().default("FBM"),
	price: z.number(),
	quantity: z.int().default(0),
	condition: z.string().default("new"),
	buyBoxOwned: z.boolean().default(false),
	lastSyncedAt: z.coerce.date().optional(),
	error: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const amazonAmazonOrderShape = z.object({
	id: z.string().register(col, { pk: true }),
	amazonOrderId: z.string(),
	status: z.string().default("pending"),
	fulfillmentChannel: z.string().default("FBM"),
	items: z.array(z.unknown()).default([]),
	orderTotal: z.number(),
	shippingTotal: z.number(),
	marketplaceFee: z.number(),
	netProceeds: z.number(),
	buyerName: z.string().optional(),
	shippingAddress: z.record(z.string(), z.unknown()).default({}),
	shipDate: z.coerce.date().optional(),
	trackingNumber: z.string().optional(),
	carrier: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const amazonInventorySyncShape = z.object({
	id: z.string().register(col, { pk: true }),
	status: z.string().default("pending"),
	totalSkus: z.int().default(0),
	updatedSkus: z.int().default(0),
	failedSkus: z.int().default(0),
	error: z.string().optional(),
	startedAt: z.coerce.date().default(() => new Date()),
	completedAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for amazon. */
export const amazonStorage = {
	kind: "relational",
	tables: {
		listing: {
			shape: amazonListingShape,
		},
		amazonOrder: {
			shape: amazonAmazonOrderShape,
		},
		inventorySync: {
			shape: amazonInventorySyncShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
