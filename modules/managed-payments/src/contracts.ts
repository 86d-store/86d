import { z } from "@86d-app/core/zod";

export const STORE_RUNTIME_WORKLOAD_AUDIENCE =
	"https://86d.app/api/store-runtime" as const;

export const MANAGED_PAYMENT_WORKLOAD_SCOPES = [
	"payments.operation:submit",
	"payments.operation:read",
	"payments.outcome:read",
	"payments.outcome:acknowledge",
	"payments.connection:read",
] as const;

export type ManagedPaymentWorkloadScope =
	(typeof MANAGED_PAYMENT_WORKLOAD_SCOPES)[number];

export const managedPaymentOptionSchema = z.enum([
	"card",
	"apple_pay",
	"google_pay",
]);

export const managedPaymentModeSchema = z.enum(["sandbox", "live"]);

export const managedPaymentOperationKindSchema = z.enum([
	"authorize",
	"capture",
	"void",
	"refund",
]);

export const managedPaymentStoreOutcomeSchema = z
	.object({
		id: z.string().min(1).max(255),
		eventId: z.string().min(1).max(255),
		version: z.literal(1),
		paymentSequence: z.number().int().nonnegative(),
		storeId: z.string().min(1).max(255),
		businessId: z.string().min(1).max(255),
		bindingId: z.string().min(1).max(255),
		connectionId: z.string().min(1).max(255),
		operationId: z.string().min(1).max(255),
		paymentId: z.string().min(1).max(255),
		checkoutId: z.string().min(1).max(255),
		provider: z.string().min(1).max(100),
		mode: managedPaymentModeSchema,
		state: z.enum(["confirmed", "declined"]),
		providerReference: z.string().min(1).max(500).optional(),
		amountMinorUnits: z.number().int().positive().optional(),
		currency: z
			.string()
			.regex(/^[A-Z]{3}$/)
			.optional(),
		occurredAt: z.string().min(1).max(100),
		payloadDigest: z.string().regex(/^[a-f0-9]{64}$/),
		deliveryState: z.enum(["pending", "acknowledged"]),
	})
	.strict();

export type ManagedPaymentStoreOutcome = z.infer<
	typeof managedPaymentStoreOutcomeSchema
>;

export const submitManagedPaymentOperationInputSchema = z
	.object({
		idempotencyKey: z.string().trim().min(8).max(200),
		provider: z.string().trim().min(1).max(100),
		mode: managedPaymentModeSchema,
		kind: managedPaymentOperationKindSchema,
		businessId: z.string().trim().min(1).max(255),
		merchantPaymentAccountId: z.string().trim().min(1).max(255),
		bindingId: z.string().trim().min(1).max(255),
		connectionId: z.string().trim().min(1).max(255),
		paymentId: z.string().trim().min(1).max(255),
		checkoutId: z.string().trim().min(1).max(255),
		option: managedPaymentOptionSchema,
		amountMinorUnits: z.number().int().positive().optional(),
		currency: z
			.string()
			.regex(/^[A-Z]{3}$/)
			.optional(),
		sourceOperationId: z.string().trim().min(1).max(255).optional(),
		instrumentReference: z.string().trim().min(1).max(500).optional(),
	})
	.strict();

export type SubmitManagedPaymentOperationInput = z.infer<
	typeof submitManagedPaymentOperationInputSchema
>;

export const managedPaymentOperationSnapshotSchema = z
	.object({
		operationId: z.string().min(1).max(255),
		state: z.enum([
			"running",
			"pending",
			"confirmed",
			"declined",
			"ambiguous",
			"needs_attention",
		]),
		kind: managedPaymentOperationKindSchema,
	})
	.strict();

export type ManagedPaymentOperationSnapshot = z.infer<
	typeof managedPaymentOperationSnapshotSchema
>;

export const managedPaymentPrepareInputSchema = z
	.object({
		bindingId: z.string().trim().min(1).max(255),
		merchantPaymentAccountId: z.string().trim().min(1).max(255),
		mode: managedPaymentModeSchema,
		option: managedPaymentOptionSchema,
	})
	.strict();

export type ManagedPaymentPrepareInput = z.infer<
	typeof managedPaymentPrepareInputSchema
>;

export const managedPaymentPrepareResponseSchema = z
	.object({
		providerReference: z.string().min(1).max(500),
		option: managedPaymentOptionSchema,
		safeConfiguration: z.record(
			z.string(),
			z.union([z.string(), z.number(), z.boolean()]),
		),
	})
	.strict();

export type ManagedPaymentPrepareResponse = z.infer<
	typeof managedPaymentPrepareResponseSchema
>;
