import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const ordersOrderShape = z.object({
	id: z.string().register(col, { pk: true }),
	orderNumber: z.string().register(col, { unique: true }),
	customerId: z.string().optional(),
	guestEmail: z.string().optional(),
	status: z
		.enum([
			"pending",
			"processing",
			"on_hold",
			"completed",
			"cancelled",
			"refunded",
		])
		.default("pending"),
	paymentStatus: z
		.enum(["unpaid", "paid", "partially_paid", "refunded", "voided"])
		.default("unpaid"),
	subtotal: z.number(),
	taxAmount: z.int().default(0),
	shippingAmount: z.int().default(0),
	discountAmount: z.int().default(0),
	giftCardAmount: z.int().default(0),
	storeCreditAmount: z.int().default(0),
	total: z.number(),
	currency: z.string().default("USD"),
	checkoutId: z.string().optional(),
	acceptedOfferId: z.string().optional(),
	catalogRevision: z.string().optional(),
	priceSourceVersion: z.string().optional(),
	taxQuoteId: z.string().optional(),
	shippingQuoteId: z.string().optional(),
	shippingOptionId: z.string().optional(),
	inventoryReservationIds: z.array(z.unknown()).default([]),
	paymentConnectionId: z.string().optional(),
	paymentOperationId: z.string().optional(),
	closedAt: z.coerce.date().optional(),
	closureReason: z.string().optional(),
	closurePolicyVersion: z.number().optional(),
	notes: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const ordersOrderItemShape = z.object({
	id: z.string().register(col, { pk: true }),
	orderId: z.string().register(col, {
		references: { table: "self.order", column: "id", onDelete: "cascade" },
	}),
	productId: z.string(),
	variantId: z.string().optional(),
	name: z.string(),
	sku: z.string().optional(),
	price: z.number(),
	quantity: z.number(),
	subtotal: z.number(),
	metadata: z.record(z.string(), z.unknown()).default({}),
});

export const ordersOrderAddressShape = z.object({
	id: z.string().register(col, { pk: true }),
	orderId: z.string().register(col, {
		references: { table: "self.order", column: "id", onDelete: "cascade" },
	}),
	type: z.enum(["billing", "shipping"]),
	firstName: z.string(),
	lastName: z.string(),
	company: z.string().optional(),
	line1: z.string(),
	line2: z.string().optional(),
	city: z.string(),
	state: z.string(),
	postalCode: z.string(),
	country: z.string(),
	phone: z.string().optional(),
});

export const ordersReturnRequestShape = z.object({
	id: z.string().register(col, { pk: true }),
	orderId: z.string().register(col, {
		references: { table: "self.order", column: "id", onDelete: "cascade" },
	}),
	status: z
		.enum([
			"requested",
			"approved",
			"rejected",
			"shipped_back",
			"received",
			"refunded",
			"completed",
		])
		.default("requested"),
	type: z.enum(["refund", "exchange", "store_credit"]).default("refund"),
	reason: z.string(),
	customerNotes: z.string().optional(),
	adminNotes: z.string().optional(),
	refundAmount: z.number().optional(),
	trackingNumber: z.string().optional(),
	trackingUrl: z.string().optional(),
	carrier: z.string().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const ordersReturnItemShape = z.object({
	id: z.string().register(col, { pk: true }),
	returnRequestId: z.string().register(col, {
		references: {
			table: "self.returnRequest",
			column: "id",
			onDelete: "cascade",
		},
	}),
	orderItemId: z.string(),
	quantity: z.number(),
	reason: z.string().optional(),
});

export const ordersOrderNoteShape = z.object({
	id: z.string().register(col, { pk: true }),
	orderId: z.string().register(col, {
		references: { table: "self.order", column: "id", onDelete: "cascade" },
	}),
	type: z.enum(["note", "system"]).default("note"),
	content: z.string(),
	authorId: z.string().optional(),
	authorName: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const ordersOrderCustomerAttributionShape = z.object({
	id: z.string().register(col, { pk: true }),
	orderId: z.string().register(col, { index: true }),
	fromCustomerId: z.string().optional(),
	toCustomerId: z.string(),
	reason: z.enum(["legacy_subject_rewrite", "guest_claim"]),
	createdAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for orders. */
export const ordersStorage = {
	kind: "relational",
	tables: {
		order: {
			shape: ordersOrderShape,
		},
		orderItem: {
			shape: ordersOrderItemShape,
		},
		orderAddress: {
			shape: ordersOrderAddressShape,
		},
		returnRequest: {
			shape: ordersReturnRequestShape,
		},
		returnItem: {
			shape: ordersReturnItemShape,
		},
		orderNote: {
			shape: ordersOrderNoteShape,
		},
		orderCustomerAttribution: {
			shape: ordersOrderCustomerAttributionShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
