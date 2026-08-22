import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const returnsReturnAuthorityOperationLockShape = z.object({
	id: z.string().register(col, { pk: true }),
	operationId: z.string().register(col, { unique: true }),
});

export const returnsReturnAuthorityOrderLockShape = z.object({
	id: z.string().register(col, { pk: true }),
	orderId: z.string().register(col, { unique: true }),
});

export const returnsReturnAuthorityRequestShape = z.object({
	id: z.string().register(col, { pk: true }),
	contractVersion: z.number(),
	operationId: z.string().register(col, { unique: true }),
	requestDigest: z.string(),
	orderId: z.string(),
	customerId: z.string(),
	actor: z.record(z.string(), z.unknown()),
	authority: z.record(z.string(), z.unknown()),
	requestedResolution: z.string(),
	reasonSnapshot: z.string(),
	items: z.record(z.string(), z.unknown()),
	requestedAt: z.coerce.date(),
});

export const returnsReturnAuthorityReceiptShape = z.object({
	id: z.string().register(col, { pk: true }),
	operationId: z.string().register(col, { unique: true }),
	requestDigest: z.string(),
	returnRequestId: z.string(),
	createdAt: z.coerce.date(),
});

export const returnsReturnRequestShape = z.object({
	id: z.string().register(col, { pk: true }),
	// Order identity is a cross-Module link (orders.order), not a self FK.
	orderId: z.string(),
	customerId: z.string(),
	customerEmail: z.string().optional(),
	status: z
		.enum([
			"requested",
			"approved",
			"rejected",
			"received",
			"completed",
			"cancelled",
		])
		.default("requested"),
	refundMethod: z
		.enum(["original_payment", "store_credit", "exchange"])
		.default("original_payment"),
	refundAmount: z.int().default(0),
	currency: z.string().default("USD"),
	reason: z.string(),
	customerNotes: z.string().optional(),
	adminNotes: z.string().optional(),
	trackingNumber: z.string().optional(),
	trackingCarrier: z.string().optional(),
	requestedAt: z.coerce.date().default(() => new Date()),
	resolvedAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const returnsReturnItemShape = z.object({
	id: z.string().register(col, { pk: true }),
	returnRequestId: z.string().register(col, {
		references: {
			table: "self.returnRequest",
			column: "id",
			onDelete: "cascade",
		},
	}),
	orderItemId: z.string(),
	productName: z.string(),
	sku: z.string().optional(),
	quantity: z.number(),
	unitPrice: z.number(),
	reason: z.enum([
		"damaged",
		"defective",
		"wrong_item",
		"not_as_described",
		"changed_mind",
		"too_small",
		"too_large",
		"other",
	]),
	condition: z
		.enum(["unopened", "opened", "used", "damaged"])
		.default("opened"),
	notes: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for returns. */
export const returnsStorage = {
	kind: "relational",
	tables: {
		returnAuthorityOperationLock: {
			shape: returnsReturnAuthorityOperationLockShape,
		},
		returnAuthorityOrderLock: {
			shape: returnsReturnAuthorityOrderLockShape,
		},
		returnAuthorityRequest: {
			shape: returnsReturnAuthorityRequestShape,
		},
		returnAuthorityReceipt: {
			shape: returnsReturnAuthorityReceiptShape,
		},
		returnRequest: {
			shape: returnsReturnRequestShape,
		},
		returnItem: {
			shape: returnsReturnItemShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
