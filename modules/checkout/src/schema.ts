import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema/col";
import { z } from "zod";

export const checkoutCheckoutSessionShape = z.object({
	id: z.string().register(col, { pk: true }),
	revision: z.int().default(1),
	cartId: z.string().optional(),
	customerId: z.string().optional(),
	guestEmail: z.string().optional(),
	status: z
		.enum(["pending", "processing", "completed", "expired", "abandoned"])
		.default("pending"),
	subtotal: z.number(),
	taxAmount: z.int().default(0),
	shippingAmount: z.int().default(0),
	discountAmount: z.int().default(0),
	giftCardAmount: z.int().default(0),
	storeCreditAmount: z.int().default(0),
	total: z.number(),
	currency: z.string().default("USD"),
	discountCode: z.string().optional(),
	giftCardCode: z.string().optional(),
	shippingAddress: z.record(z.string(), z.unknown()).optional(),
	billingAddress: z.record(z.string(), z.unknown()).optional(),
	shippingMethodName: z.string().optional(),
	paymentMethod: z.string().optional(),
	paymentIntentId: z.string().optional(),
	paymentStatus: z.string().optional(),
	orderId: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).default({}),
	expiresAt: z.coerce.date(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const checkoutCheckoutLineItemShape = z.object({
	id: z.string().register(col, { pk: true }),
	sessionId: z.string().register(col, {
		references: {
			table: "self.checkoutSession",
			column: "id",
			onDelete: "cascade",
		},
	}),
	productId: z.string(),
	variantId: z.string().optional(),
	name: z.string(),
	sku: z.string().optional(),
	price: z.number(),
	quantity: z.int().default(1),
	createdAt: z.coerce.date().default(() => new Date()),
});

export const checkoutCheckoutFinalizationShape = z.object({
	id: z.string().register(col, { pk: true }),
	checkoutId: z.string().register(col, {
		references: {
			table: "self.checkoutSession",
			column: "id",
			onDelete: "restrict",
		},
	}),
	operationKey: z.string(),
	inputDigest: z.string(),
	inputDigestVersion: z.number(),
	expectedRevision: z.number(),
	state: z.enum(["pending", "running", "compensating", "needs_attention"]),
	currentStep: z.enum([
		"checkout_revision",
		"accepted_offer",
		"shipping_and_tax",
		"inventory",
		"payment_connection",
		"payment_outcome",
		"order",
		"commerce_commit",
		"payment_settlement",
		"checkout_completion",
		"compensation",
	]),
	attemptCount: z.number(),
	compensationCount: z.number(),
	acceptedInput: z.record(z.string(), z.unknown()),
	result: z.record(z.string(), z.unknown()),
	needsAttention: z.record(z.string(), z.unknown()).optional(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export const checkoutCheckoutFinalizationAttemptShape = z.object({
	id: z.string().register(col, { pk: true }),
	finalizationId: z.string().register(col, {
		references: {
			table: "self.checkoutFinalization",
			column: "id",
			onDelete: "restrict",
		},
	}),
	attemptKey: z.string(),
	operationDigest: z.string(),
	operationDigestVersion: z.number(),
	sequence: z.number(),
	stateBefore: z.enum(["pending", "running"]),
	stateAfter: z.enum(["pending", "running", "compensating", "needs_attention"]),
	step: z.enum([
		"checkout_revision",
		"accepted_offer",
		"shipping_and_tax",
		"inventory",
		"payment_connection",
		"payment_outcome",
		"order",
		"commerce_commit",
		"payment_settlement",
		"checkout_completion",
	]),
	nextStep: z.enum([
		"checkout_revision",
		"accepted_offer",
		"shipping_and_tax",
		"inventory",
		"payment_connection",
		"payment_outcome",
		"order",
		"commerce_commit",
		"payment_settlement",
		"checkout_completion",
		"compensation",
	]),
	outcome: z.record(z.string(), z.unknown()),
	result: z.record(z.string(), z.unknown()).optional(),
	recordedAt: z.coerce.date(),
});

export const checkoutCheckoutFinalizationCompensationShape = z.object({
	id: z.string().register(col, { pk: true }),
	finalizationId: z.string().register(col, {
		references: {
			table: "self.checkoutFinalization",
			column: "id",
			onDelete: "restrict",
		},
	}),
	compensationKey: z.string(),
	operationDigest: z.string(),
	operationDigestVersion: z.number(),
	sequence: z.number(),
	action: z.enum([
		"release_inventory_reservation",
		"reverse_discount_redemption",
		"reverse_gift_card_redemption",
		"reverse_store_credit_debit",
		"cancel_or_reconcile_payment",
		"cancel_order",
		"adjust_tax",
		"void_shipping",
		"other_reconciliation",
	]),
	target: z.record(z.string(), z.unknown()),
	outcome: z.record(z.string(), z.unknown()),
	recordedAt: z.coerce.date(),
});

export const checkoutCheckoutFinalizationLockShape = z.object({
	id: z.string().register(col, { pk: true }),
	checkoutId: z.string(),
});

export const checkoutCheckoutRequestShape = z.object({
	id: z.string().register(col, { pk: true }),
	requestDigest: z.string(),
	requestDigestVersion: z.number(),
	owner: z.record(z.string(), z.unknown()),
	accessProofDigest: z.string().optional(),
	reason: z.record(z.string(), z.unknown()),
	contact: z.record(z.string(), z.unknown()),
	cartSnapshot: z.record(z.string(), z.unknown()),
	invitationState: z
		.enum(["not_invited", "invited", "reminded", "expired"])
		.default("not_invited"),
	invitedAt: z.coerce.date().optional(),
	remindedAt: z.coerce.date().optional(),
	invitationExpiresAt: z.coerce.date().optional(),
	auditActor: z.record(z.string(), z.unknown()),
	expiresAt: z.coerce.date().register(col, { index: true }),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export const checkoutCheckoutRequestOperationShape = z.object({
	id: z.string().register(col, { pk: true }),
	operationKey: z.string(),
	requestDigest: z.string(),
	requestDigestVersion: z.number(),
	checkoutRequestId: z.string().register(col, {
		references: {
			table: "self.checkoutRequest",
			column: "id",
			onDelete: "restrict",
		},
	}),
	createdAt: z.coerce.date(),
});

export const checkoutCheckoutRequestLockShape = z.object({
	id: z.string().register(col, { pk: true }),
});

/** Native Relational storage for checkout. */
export const checkoutStorage = {
	kind: "relational",
	tables: {
		checkoutSession: {
			shape: checkoutCheckoutSessionShape,
		},
		checkoutLineItem: {
			shape: checkoutCheckoutLineItemShape,
		},
		checkoutFinalization: {
			shape: checkoutCheckoutFinalizationShape,
		},
		checkoutFinalizationAttempt: {
			shape: checkoutCheckoutFinalizationAttemptShape,
		},
		checkoutFinalizationCompensation: {
			shape: checkoutCheckoutFinalizationCompensationShape,
		},
		checkoutFinalizationLock: {
			shape: checkoutCheckoutFinalizationLockShape,
		},
		checkoutRequest: {
			shape: checkoutCheckoutRequestShape,
		},
		checkoutRequestOperation: {
			shape: checkoutCheckoutRequestOperationShape,
		},
		checkoutRequestLock: {
			shape: checkoutCheckoutRequestLockShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
