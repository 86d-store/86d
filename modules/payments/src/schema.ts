import type { ModuleStorageDeclaration } from "@86d-app/core/schema";
import { col } from "@86d-app/core/schema";
import { z } from "@86d-app/core/zod";

export const paymentsPaymentConnectionShape = z.object({
	id: z.string().register(col, { pk: true }),
	providerAccountId: z.string(),
	name: z.string(),
	normalizedName: z.string().register(col, { index: true }),
	provider: z.string(),
	mode: z.enum(["test", "live"]),
	capabilities: z.array(z.unknown()).default([]),
	health: z
		.enum(["unknown", "healthy", "degraded", "unhealthy"])
		.default("unknown"),
	lifecycle: z
		.enum(["draft", "enabled", "disabled", "revoked"])
		.default("draft"),
	secretReference: z.string(),
	healthCheckedAt: z.coerce.date().optional(),
	enabledAt: z.coerce.date().optional(),
	disabledAt: z.coerce.date().optional(),
	revokedAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const paymentsPaymentConnectionLockV2Shape = z.object({
	id: z.string().register(col, { pk: true }),
});

export const paymentsPaymentV2Shape = z.object({
	id: z.string().register(col, { pk: true }),
	modelVersion: z.int().default(2),
	checkoutId: z.string().register(col, { index: true }),
	orderId: z.string().register(col, { index: true }).optional(),
	connectionId: z.string().register(col, { index: true }),
	paymentOption: z.enum(["card", "apple_pay", "google_pay", "paypal"]),
	expectedAmount: z.number(),
	eligibleMerchandiseAmount: z.number(),
	currency: z.string(),
	authorizedAmount: z.int().default(0),
	capturedAmount: z.int().default(0),
	voidedAmount: z.int().default(0),
	confirmedRefundedAmount: z.int().default(0),
	providerReferences: z.array(z.unknown()).default([]),
	dispute: z.record(z.string(), z.unknown()),
	state: z
		.enum([
			"pending",
			"authorized",
			"partially_captured",
			"captured",
			"partially_refunded",
			"refunded",
			"voided",
		])
		.default("pending"),
	terminalState: z.enum(["none", "refunded", "voided"]).default("none"),
	creationIdempotencyKey: z.string().register(col, { index: true }),
	creationDigest: z.string(),
	creationDigestVersion: z.int().default(1),
	revision: z.int().default(1),
	terminalAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const paymentsPaymentV2LockShape = z.object({
	id: z.string().register(col, { pk: true }),
	paymentId: z.string().register(col, { index: true }),
});

export const paymentsPaymentDisputeFactV2Shape = z.object({
	id: z.string().register(col, { pk: true }),
	paymentId: z.string().register(col, { index: true }),
	connectionId: z.string().register(col, { index: true }),
	eventId: z.string().register(col, { index: true }),
	eventDigest: z.string(),
	providerDisputeReference: z.string().register(col, { index: true }),
	state: z.enum(["open", "won", "lost", "reversed"]),
	occurredAt: z.coerce.date(),
	appliedRevision: z.number(),
});

export const paymentsPaymentOperationV2Shape = z.object({
	id: z.string().register(col, { pk: true }),
	modelVersion: z.int().default(2),
	paymentId: z.string().register(col, { index: true }),
	connectionId: z.string().register(col, { index: true }),
	sourceOperationId: z.string().register(col, { index: true }).optional(),
	operation: z.enum(["intent", "authorization", "capture", "refund", "void"]),
	idempotencyKey: z.string().register(col, { index: true }),
	requestDigest: z.string(),
	payload: z.record(z.string(), z.unknown()),
	requestDigestVersion: z.int().default(1),
	state: z
		.enum([
			"pending",
			"requires_action",
			"running",
			"succeeded",
			"failed",
			"ambiguous",
			"needs_attention",
			"dead_letter",
		])
		.default("pending"),
	revision: z.int().default(1),
	attempt: z.int().default(1),
	reconciliationAttempts: z.int().default(0),
	manualReconciliationCount: z.int().default(0),
	providerReference: z.string().optional(),
	outcome: z.record(z.string(), z.unknown()).optional(),
	needsAttentionReason: z.string().optional(),
	needsAttentionAt: z.coerce.date().optional(),
	leaseExpiresAt: z.coerce.date().register(col, { index: true }).optional(),
	nextReconciliationAt: z.coerce
		.date()
		.register(col, { index: true })
		.optional(),
	lastReconciliationAt: z.coerce.date().optional(),
	lastReconciliationTrigger: z.enum(["scheduled", "manual"]).optional(),
	lastManualReconciliationReason: z.string().optional(),
	lastManualReconciliationAt: z.coerce.date().optional(),
	deadLetteredAt: z.coerce.date().optional(),
	completedAt: z.coerce.date().optional(),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const paymentsPaymentOperationAttemptV2Shape = z.object({
	id: z.string().register(col, { pk: true }),
	paymentOperationId: z.string().register(col, { index: true }),
	connectionId: z.string().register(col, { index: true }),
	attempt: z.number(),
	idempotencyKey: z.string().register(col, { index: true }),
	requestDigest: z.string(),
	trigger: z
		.enum(["initial", "scheduled_reconciliation", "manual_reconciliation"])
		.default("initial"),
	triggerReason: z.string().optional(),
	state: z.enum([
		"running",
		"pending",
		"requires_action",
		"succeeded",
		"failed",
		"ambiguous",
	]),
	providerReference: z.string().optional(),
	outcome: z.record(z.string(), z.unknown()).optional(),
	startedAt: z.coerce.date(),
	finishedAt: z.coerce.date().optional(),
});

export const paymentsPaymentOperationLockV2Shape = z.object({
	id: z.string().register(col, { pk: true }),
});

export const paymentsPaymentWebhookReceiptV2Shape = z.object({
	id: z.string().register(col, { pk: true }),
	modelVersion: z.int().default(2),
	storeId: z.string().register(col, { index: true }),
	connectionId: z.string().register(col, { index: true }),
	provider: z.string().register(col, { index: true }),
	providerEventId: z.string().register(col, { index: true }),
	providerEventType: z.string(),
	payloadDigest: z.string(),
	verificationKeyReference: z.string(),
	fact: z.record(z.string(), z.unknown()),
	state: z
		.enum(["verified", "processing", "applied", "rejected", "needs_attention"])
		.default("verified"),
	processingAttempts: z.int().default(0),
	revision: z.int().default(1),
	leaseExpiresAt: z.coerce.date().register(col, { index: true }).optional(),
	finalDisposition: z.string().optional(),
	lastFailureCode: z.string().optional(),
	verifiedAt: z.coerce.date(),
	appliedAt: z.coerce.date().optional(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

export const paymentsPaymentWebhookReceiptLockV2Shape = z.object({
	id: z.string().register(col, { pk: true }),
});

export const paymentsPaymentIntentShape = z.object({
	id: z.string().register(col, { pk: true }),
	providerIntentId: z.string().optional(),
	customerId: z.string().optional(),
	email: z.string().optional(),
	amount: z.number(),
	currency: z.string().default("USD"),
	status: z
		.enum([
			"pending",
			"processing",
			"succeeded",
			"failed",
			"cancelled",
			"refunded",
		])
		.default("pending"),
	paymentMethodId: z.string().optional(),
	orderId: z.string().optional(),
	checkoutSessionId: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).default({}),
	providerMetadata: z.record(z.string(), z.unknown()).default({}),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const paymentsPaymentMethodShape = z.object({
	id: z.string().register(col, { pk: true }),
	customerId: z.string(),
	providerMethodId: z.string(),
	type: z.string().default("card"),
	last4: z.string().optional(),
	brand: z.string().optional(),
	expiryMonth: z.number().optional(),
	expiryYear: z.number().optional(),
	isDefault: z.boolean().default(false),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

export const paymentsRefundShape = z.object({
	id: z.string().register(col, { pk: true }),
	paymentIntentId: z.string(),
	providerRefundId: z.string(),
	amount: z.number(),
	reason: z.string().optional(),
	status: z.enum(["pending", "succeeded", "failed"]).default("pending"),
	createdAt: z.coerce.date().default(() => new Date()),
	updatedAt: z.coerce.date().default(() => new Date()),
});

/** Native Relational storage for payments. */
export const paymentsStorage = {
	kind: "relational",
	tables: {
		paymentConnection: {
			shape: paymentsPaymentConnectionShape,
		},
		paymentConnectionLockV2: {
			shape: paymentsPaymentConnectionLockV2Shape,
		},
		paymentV2: {
			shape: paymentsPaymentV2Shape,
		},
		paymentV2Lock: {
			shape: paymentsPaymentV2LockShape,
		},
		paymentDisputeFactV2: {
			shape: paymentsPaymentDisputeFactV2Shape,
		},
		paymentOperationV2: {
			shape: paymentsPaymentOperationV2Shape,
		},
		paymentOperationAttemptV2: {
			shape: paymentsPaymentOperationAttemptV2Shape,
		},
		paymentOperationLockV2: {
			shape: paymentsPaymentOperationLockV2Shape,
		},
		paymentWebhookReceiptV2: {
			shape: paymentsPaymentWebhookReceiptV2Shape,
		},
		paymentWebhookReceiptLockV2: {
			shape: paymentsPaymentWebhookReceiptLockV2Shape,
		},
		paymentIntent: {
			shape: paymentsPaymentIntentShape,
		},
		paymentMethod: {
			shape: paymentsPaymentMethodShape,
		},
		refund: {
			shape: paymentsRefundShape,
		},
	},
} as const satisfies ModuleStorageDeclaration;
