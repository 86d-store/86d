import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const ebayListingShape = z.object({
	id: z.string().register(col, { pk: true }),
	localProductId: z.string(),
	ebayItemId: z.string().optional(),
	title: z.string(),
	status: z.string().default("draft"),
	listingType: z.string().default("fixed-price"),
	price: z.number(),
	auctionStartPrice: z.number().optional(),
	currentBid: z.number().optional(),
	bidCount: z.int().default(0),
	quantity: z.int().default(1),
	condition: z.string().default("new"),
	categoryId: z.string().optional(),
	duration: z.string().optional(),
	startTime: z.coerce.date().optional(),
	endTime: z.coerce.date().optional(),
	watchers: z.int().default(0),
	views: z.int().default(0),
	lastSyncedAt: z.coerce.date().optional(),
	error: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const ebayEbayOrderShape = z.object({
	id: z.string().register(col, { pk: true }),
	ebayOrderId: z.string(),
	status: z.string().default("pending"),
	items: z.array(z.unknown()).default([]),
	subtotal: z.number(),
	shippingCost: z.number(),
	ebayFee: z.number(),
	paymentProcessingFee: z.number(),
	total: z.number(),
	buyerUsername: z.string().optional(),
	buyerName: z.string().optional(),
	shippingAddress: z.record(z.string(), z.unknown()).default({}),
	trackingNumber: z.string().optional(),
	carrier: z.string().optional(),
	shipDate: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for ebay. */
export const ebayStorage = {
	kind: "relational",
	tables: {
		listing: {
			shape: ebayListingShape,
		},
		ebayOrder: {
			shape: ebayEbayOrderShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
