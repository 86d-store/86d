import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const wishWishProductShape = z.object({
	id: z.string().register(col, { pk: true }),
	localProductId: z.string(),
	wishProductId: z.string().optional(),
	title: z.string(),
	status: z.string().default("active"),
	price: z.number(),
	shippingPrice: z.number(),
	quantity: z.int().default(0),
	parentSku: z.string().optional(),
	tags: z.array(z.unknown()).default([]),
	lastSyncedAt: z.coerce.date().optional(),
	reviewStatus: z.string().optional(),
	error: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const wishWishOrderShape = z.object({
	id: z.string().register(col, { pk: true }),
	wishOrderId: z.string(),
	status: z.string().default("pending"),
	items: z.array(z.unknown()).default([]),
	orderTotal: z.number(),
	shippingTotal: z.number(),
	wishFee: z.number(),
	customerName: z.string().optional(),
	shippingAddress: z.record(z.string(), z.unknown()).default({}),
	trackingNumber: z.string().optional(),
	carrier: z.string().optional(),
	shipByDate: z.coerce.date().optional(),
	deliverByDate: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for wish. */
export const wishStorage = {
	kind: "relational",
	tables: {
		wishProduct: {
			shape: wishWishProductShape,
		},
		wishOrder: {
			shape: wishWishOrderShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
