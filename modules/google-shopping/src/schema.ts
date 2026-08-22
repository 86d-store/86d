import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const googleShoppingProductFeedShape = z.object({
	id: z.string().register(col, { pk: true }),
	localProductId: z.string(),
	googleProductId: z.string().optional(),
	title: z.string(),
	description: z.string().optional(),
	status: z.string().default("pending"),
	disapprovalReasons: z.array(z.unknown()).default([]),
	googleCategory: z.string().optional(),
	condition: z.string().default("new"),
	availability: z.string().default("in-stock"),
	price: z.number(),
	salePrice: z.number().optional(),
	link: z.string(),
	imageLink: z.string(),
	gtin: z.string().optional(),
	mpn: z.string().optional(),
	brand: z.string().optional(),
	lastSyncedAt: z.coerce.date().optional(),
	expiresAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const googleShoppingChannelOrderShape = z.object({
	id: z.string().register(col, { pk: true }),
	googleOrderId: z.string(),
	status: z.string().default("pending"),
	items: z.array(z.unknown()).default([]),
	subtotal: z.number(),
	shippingCost: z.number(),
	tax: z.number(),
	total: z.number(),
	shippingAddress: z.record(z.string(), z.unknown()).default({}),
	trackingNumber: z.string().optional(),
	carrier: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const googleShoppingFeedSubmissionShape = z.object({
	id: z.string().register(col, { pk: true }),
	status: z.string().default("pending"),
	totalProducts: z.int().default(0),
	approvedProducts: z.int().default(0),
	disapprovedProducts: z.int().default(0),
	error: z.string().optional(),
	submittedAt: z.coerce.date().default(() => new Date()),
	completedAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for google-shopping. */
export const googleShoppingStorage = {
	kind: "relational",
	tables: {
		productFeed: {
			shape: googleShoppingProductFeedShape,
		},
		channelOrder: {
			shape: googleShoppingChannelOrderShape,
		},
		feedSubmission: {
			shape: googleShoppingFeedSubmissionShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
