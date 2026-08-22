import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const etsyListingShape = z.object({
	id: z.string().register(col, { pk: true }),
	localProductId: z.string(),
	etsyListingId: z.string().optional(),
	title: z.string(),
	description: z.string().optional(),
	status: z.string().default("draft"),
	state: z.string().default("draft"),
	price: z.number(),
	quantity: z.int().default(0),
	renewalDate: z.coerce.date().optional(),
	whoMadeIt: z.string().default("i-did"),
	whenMadeIt: z.string().default("made_to_order"),
	isSupply: z.boolean().default(false),
	materials: z.array(z.unknown()).default([]),
	tags: z.array(z.unknown()).default([]),
	taxonomyId: z.string().optional(),
	shippingProfileId: z.string().optional(),
	views: z.int().default(0),
	favorites: z.int().default(0),
	lastSyncedAt: z.coerce.date().optional(),
	error: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const etsyEtsyOrderShape = z.object({
	id: z.string().register(col, { pk: true }),
	etsyReceiptId: z.string(),
	status: z.string().default("open"),
	items: z.array(z.unknown()).default([]),
	subtotal: z.number(),
	shippingCost: z.number(),
	etsyFee: z.number(),
	processingFee: z.number(),
	tax: z.number(),
	total: z.number(),
	buyerName: z.string().optional(),
	buyerEmail: z.string().optional(),
	shippingAddress: z.record(z.string(), z.unknown()).default({}),
	giftMessage: z.string().optional(),
	trackingNumber: z.string().optional(),
	carrier: z.string().optional(),
	shipDate: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const etsyEtsyReviewShape = z.object({
	id: z.string().register(col, { pk: true }),
	etsyTransactionId: z.string(),
	rating: z.number(),
	review: z.string().optional(),
	buyerName: z.string().optional(),
	listingId: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for etsy. */
export const etsyStorage = {
	kind: "relational",
	tables: {
		listing: {
			shape: etsyListingShape,
		},
		etsyOrder: {
			shape: etsyEtsyOrderShape,
		},
		etsyReview: {
			shape: etsyEtsyReviewShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
