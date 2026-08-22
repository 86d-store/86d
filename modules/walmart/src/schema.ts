import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const walmartItemShape = z.object({
	id: z.string().register(col, { pk: true }),
	localProductId: z.string(),
	walmartItemId: z.string().optional(),
	sku: z.string(),
	title: z.string(),
	status: z.string().default("unpublished"),
	lifecycleStatus: z.string().default("active"),
	price: z.number(),
	quantity: z.int().default(0),
	upc: z.string().optional(),
	gtin: z.string().optional(),
	brand: z.string().optional(),
	category: z.string().optional(),
	fulfillmentType: z.string().default("seller"),
	publishStatus: z.string().optional(),
	lastSyncedAt: z.coerce.date().optional(),
	error: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const walmartWalmartOrderShape = z.object({
	id: z.string().register(col, { pk: true }),
	purchaseOrderId: z.string(),
	status: z.string().default("created"),
	items: z.array(z.unknown()).default([]),
	orderTotal: z.number(),
	shippingTotal: z.number(),
	walmartFee: z.number(),
	tax: z.number(),
	customerName: z.string().optional(),
	shippingAddress: z.record(z.string(), z.unknown()).default({}),
	trackingNumber: z.string().optional(),
	carrier: z.string().optional(),
	shipDate: z.coerce.date().optional(),
	estimatedDelivery: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const walmartFeedSubmissionShape = z.object({
	id: z.string().register(col, { pk: true }),
	feedId: z.string().optional(),
	feedType: z.string(),
	status: z.string().default("pending"),
	totalItems: z.int().default(0),
	successItems: z.int().default(0),
	errorItems: z.int().default(0),
	error: z.string().optional(),
	submittedAt: z.coerce.date().default(() => new Date()),
	completedAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for walmart. */
export const walmartStorage = {
	kind: "relational",
	tables: {
		item: {
			shape: walmartItemShape,
		},
		walmartOrder: {
			shape: walmartWalmartOrderShape,
		},
		feedSubmission: {
			shape: walmartFeedSubmissionShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
