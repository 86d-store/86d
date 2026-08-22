import {
	defineDurableEvent,
	type LockingModuleDataTransaction,
	type ModuleDataTransaction,
	type ModuleTransactionRunner,
} from "@86d-app/core/durable-events";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

const identifier = z
	.string()
	.max(255)
	.transform(sanitizeText)
	.pipe(z.string().min(1).max(255));

const operationKey = z
	.string()
	.max(200)
	.transform(sanitizeText)
	.pipe(z.string().min(8).max(200));

const referenceList = z
	.array(identifier)
	.max(1_000)
	.superRefine((references, context) => {
		const unique = new Set(references);
		if (unique.size !== references.length) {
			context.addIssue({
				code: "custom",
				message: "Finalization references must be unique.",
			});
		}
	})
	.transform((references) => [...references].sort());

export const checkoutFinalizationStateSchema = z.enum([
	"pending",
	"running",
	"completed",
	"compensating",
	"needs_attention",
]);

/**
 * Names the checkpoints the future finalizer must coordinate. This enum is a
 * ledger vocabulary, not an executable step-order policy.
 */
export const checkoutFinalizationStepSchema = z.enum([
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
]);

/** Immutable identities from the shopper-accepted Checkout input. */
export const checkoutFinalizationAcceptedInputSchema = z
	.object({
		acceptedOfferId: identifier,
		acceptanceId: identifier,
		catalogRevisionId: identifier,
		pricingDecisionId: identifier,
		discountDecisionIds: referenceList.default([]),
		shippingQuoteId: identifier.optional(),
		shippingOptionId: identifier.optional(),
		taxQuoteId: identifier.optional(),
		inventoryReservationIds: referenceList.default([]),
		paymentConnectionId: identifier.optional(),
		paymentPolicyId: identifier.optional(),
	})
	.strict()
	.superRefine((input, context) => {
		if (input.shippingOptionId && !input.shippingQuoteId) {
			context.addIssue({
				code: "custom",
				message: "A Shipping option reference requires its quote reference.",
				path: ["shippingOptionId"],
			});
		}
		if (input.paymentPolicyId && !input.paymentConnectionId) {
			context.addIssue({
				code: "custom",
				message:
					"A Payment policy reference requires its Connection reference.",
				path: ["paymentPolicyId"],
			});
		}
	});

const paymentResultReferenceSchema = z
	.object({
		connectionId: identifier,
		paymentId: identifier,
		authorizationOperationId: identifier.optional(),
		captureOperationId: identifier.optional(),
		reconciliationOperationId: identifier.optional(),
	})
	.strict();

/** Owner-issued result identities only; monetary values are intentionally absent. */
export const checkoutFinalizationResultSchema = z
	.object({
		orderId: identifier.optional(),
		payment: paymentResultReferenceSchema.optional(),
	})
	.strict();

const checkoutFinalizationResultUpdateSchema =
	checkoutFinalizationResultSchema.refine(
		(result) => result.orderId !== undefined || result.payment !== undefined,
		{
			message:
				"A Finalization result update must contain an owner-issued reference.",
		},
	);

export const checkoutFinalizationAttentionSchema = z
	.object({
		code: z
			.string()
			.max(100)
			.transform(sanitizeText)
			.pipe(z.string().min(1).max(100)),
		detail: z
			.string()
			.max(500)
			.transform(sanitizeText)
			.pipe(z.string().min(1).max(500))
			.optional(),
	})
	.strict();

export const checkoutFinalizationAttemptOutcomeSchema = z.discriminatedUnion(
	"type",
	[
		z
			.object({
				type: z.literal("advanced"),
				nextStep: checkoutFinalizationStepSchema.exclude(["compensation"]),
			})
			.strict(),
		z.object({ type: z.literal("completed") }).strict(),
		z
			.object({
				type: z.literal("retryable_failure"),
				reason: checkoutFinalizationAttentionSchema,
			})
			.strict(),
		z
			.object({
				type: z.literal("compensation_required"),
				reason: checkoutFinalizationAttentionSchema,
			})
			.strict(),
		z
			.object({
				type: z.literal("ambiguous"),
				reason: checkoutFinalizationAttentionSchema,
			})
			.strict(),
		z
			.object({
				type: z.literal("needs_attention"),
				reason: checkoutFinalizationAttentionSchema,
			})
			.strict(),
	],
);

export const checkoutFinalizationCompensationActionSchema = z.enum([
	"release_inventory_reservation",
	"reverse_discount_redemption",
	"reverse_gift_card_redemption",
	"reverse_store_credit_debit",
	"cancel_or_reconcile_payment",
	"cancel_order",
	"adjust_tax",
	"void_shipping",
	"other_reconciliation",
]);

export const checkoutFinalizationCompensationTargetSchema = z
	.object({
		ownerModule: identifier,
		resourceType: identifier,
		resourceId: identifier,
		operationId: identifier,
	})
	.strict();

export const checkoutFinalizationCompensationOutcomeSchema =
	z.discriminatedUnion("type", [
		z.object({ type: z.literal("planned") }).strict(),
		z.object({ type: z.literal("succeeded") }).strict(),
		z
			.object({
				type: z.literal("retryable_failure"),
				reason: checkoutFinalizationAttentionSchema,
			})
			.strict(),
		z
			.object({
				type: z.literal("ambiguous"),
				reason: checkoutFinalizationAttentionSchema,
			})
			.strict(),
	]);

export const admitCheckoutFinalizationInputSchema = z
	.object({
		operationKey,
		checkoutId: identifier,
		expectedRevision: z.number().int().positive().safe(),
		acceptedInput: checkoutFinalizationAcceptedInputSchema,
	})
	.strict();

export const recordCheckoutFinalizationAttemptInputSchema = z
	.object({
		finalizationId: identifier,
		attemptKey: operationKey,
		expectedAttemptCount: z.number().int().nonnegative().safe(),
		expectedState: z.enum(["pending", "running"]),
		expectedStep: checkoutFinalizationStepSchema.exclude(["compensation"]),
		outcome: checkoutFinalizationAttemptOutcomeSchema,
		result: checkoutFinalizationResultUpdateSchema.optional(),
	})
	.strict();

export const recordCheckoutFinalizationCompensationInputSchema = z
	.object({
		finalizationId: identifier,
		compensationKey: operationKey,
		expectedCompensationCount: z.number().int().nonnegative().safe(),
		action: checkoutFinalizationCompensationActionSchema,
		target: checkoutFinalizationCompensationTargetSchema,
		outcome: checkoutFinalizationCompensationOutcomeSchema,
	})
	.strict();

const timestampSchema = z
	.union([z.date(), z.string().datetime()])
	.transform((value) => (value instanceof Date ? value : new Date(value)));

export const storedCheckoutFinalizationSchema = z
	.object({
		id: identifier,
		checkoutId: identifier,
		operationKey,
		inputDigest: z.string().regex(SHA256_PATTERN),
		inputDigestVersion: z.literal(1),
		expectedRevision: z.number().int().positive().safe(),
		state: checkoutFinalizationStateSchema,
		currentStep: checkoutFinalizationStepSchema,
		attemptCount: z.number().int().nonnegative().safe(),
		compensationCount: z.number().int().nonnegative().safe(),
		acceptedInput: checkoutFinalizationAcceptedInputSchema,
		result: checkoutFinalizationResultSchema,
		needsAttention: checkoutFinalizationAttentionSchema.optional(),
		createdAt: timestampSchema,
		updatedAt: timestampSchema,
	})
	.strict();

export const storedCheckoutFinalizationAttemptSchema = z
	.object({
		id: identifier,
		finalizationId: identifier,
		attemptKey: operationKey,
		operationDigest: z.string().regex(SHA256_PATTERN),
		operationDigestVersion: z.literal(1),
		sequence: z.number().int().positive().safe(),
		stateBefore: z.enum(["pending", "running"]),
		stateAfter: checkoutFinalizationStateSchema,
		step: checkoutFinalizationStepSchema.exclude(["compensation"]),
		nextStep: checkoutFinalizationStepSchema,
		outcome: checkoutFinalizationAttemptOutcomeSchema,
		result: checkoutFinalizationResultUpdateSchema.optional(),
		recordedAt: timestampSchema,
	})
	.strict();

export const storedCheckoutFinalizationCompensationSchema = z
	.object({
		id: identifier,
		finalizationId: identifier,
		compensationKey: operationKey,
		operationDigest: z.string().regex(SHA256_PATTERN),
		operationDigestVersion: z.literal(1),
		sequence: z.number().int().positive().safe(),
		action: checkoutFinalizationCompensationActionSchema,
		target: checkoutFinalizationCompensationTargetSchema,
		outcome: checkoutFinalizationCompensationOutcomeSchema,
		recordedAt: timestampSchema,
	})
	.strict();

export const checkoutFinalizationLifecycleV1 = defineDurableEvent({
	name: "checkout.finalization-lifecycle",
	version: 1,
	owner: "checkout",
	payload: z
		.object({
			finalizationId: identifier,
			checkoutId: identifier,
			inputDigest: z.string().regex(SHA256_PATTERN),
			expectedRevision: z.number().int().positive().safe(),
			state: checkoutFinalizationStateSchema,
			currentStep: checkoutFinalizationStepSchema,
			attemptCount: z.number().int().nonnegative().safe(),
			compensationCount: z.number().int().nonnegative().safe(),
			cause: z.enum(["admitted", "attempt_recorded", "compensation_recorded"]),
			attemptId: identifier.optional(),
			compensationId: identifier.optional(),
			result: checkoutFinalizationResultSchema,
			needsAttention: checkoutFinalizationAttentionSchema.optional(),
		})
		.strict(),
});

export type AdmitCheckoutFinalizationInput = z.infer<
	typeof admitCheckoutFinalizationInputSchema
>;
export type RecordCheckoutFinalizationAttemptInput = z.infer<
	typeof recordCheckoutFinalizationAttemptInputSchema
>;
export type RecordCheckoutFinalizationCompensationInput = z.infer<
	typeof recordCheckoutFinalizationCompensationInputSchema
>;
export type CheckoutFinalization = z.infer<
	typeof storedCheckoutFinalizationSchema
>;
export type CheckoutFinalizationAttempt = z.infer<
	typeof storedCheckoutFinalizationAttemptSchema
>;
export type CheckoutFinalizationCompensation = z.infer<
	typeof storedCheckoutFinalizationCompensationSchema
>;

export type CheckoutFinalizationSnapshot = Readonly<{
	finalization: CheckoutFinalization;
	attempts: readonly CheckoutFinalizationAttempt[];
	compensations: readonly CheckoutFinalizationCompensation[];
}>;

export type CheckoutFinalizationStore = Readonly<{
	admit(
		input: AdmitCheckoutFinalizationInput,
	): Promise<{ finalization: CheckoutFinalization; replayed: boolean }>;
	recordAttempt(input: RecordCheckoutFinalizationAttemptInput): Promise<{
		finalization: CheckoutFinalization;
		attempt: CheckoutFinalizationAttempt;
		replayed: boolean;
	}>;
	recordCompensation(
		input: RecordCheckoutFinalizationCompensationInput,
	): Promise<{
		finalization: CheckoutFinalization;
		compensation: CheckoutFinalizationCompensation;
		replayed: boolean;
	}>;
	getById(id: string): Promise<CheckoutFinalizationSnapshot>;
}>;

export type CheckoutFinalizationErrorCode =
	| "TRANSACTION_UNAVAILABLE"
	| "LOCKING_UNAVAILABLE"
	| "INPUT_INVALID"
	| "CHECKOUT_NOT_FOUND"
	| "CHECKOUT_REVISION_CONFLICT"
	| "CHECKOUT_STATE_INVALID"
	| "FINALIZATION_NOT_FOUND"
	| "FINALIZATION_CONFLICT"
	| "OPERATION_CONFLICT"
	| "STATE_CONFLICT"
	| "COMPLETION_INVALID"
	| "STORED_STATE_INVALID";

export class CheckoutFinalizationError extends Error {
	readonly code: CheckoutFinalizationErrorCode;

	constructor(code: CheckoutFinalizationErrorCode, message: string) {
		super(message);
		this.name = "CheckoutFinalizationError";
		this.code = code;
	}
}

const storedCheckoutSessionSchema = z
	.object({
		id: identifier,
		revision: z.number().int().positive().safe(),
		status: z.enum([
			"pending",
			"processing",
			"completed",
			"expired",
			"abandoned",
		]),
	})
	.passthrough();

function isLockingTransaction(
	transaction: ModuleDataTransaction,
): transaction is LockingModuleDataTransaction {
	return (
		"getForUpdate" in transaction &&
		typeof transaction.getForUpdate === "function"
	);
}

function canonicalJson(value: unknown): string {
	if (value === null) return "null";
	if (typeof value === "string") return JSON.stringify(value);
	if (typeof value === "boolean") return value ? "true" : "false";
	if (typeof value === "number") {
		if (!Number.isFinite(value)) {
			throw new CheckoutFinalizationError(
				"INPUT_INVALID",
				"Finalization inputs must contain only finite values.",
			);
		}
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
	if (typeof value === "object") {
		const entries = Object.entries(value)
			.filter(([, entry]) => entry !== undefined)
			.sort(([left], [right]) => left.localeCompare(right));
		return `{${entries
			.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
			.join(",")}}`;
	}
	throw new CheckoutFinalizationError(
		"INPUT_INVALID",
		"Finalization inputs must be JSON-compatible.",
	);
}

async function sha256(value: string): Promise<string> {
	const digest = await globalThis.crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(value),
	);
	return Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
}

function inputDigestMaterial(input: AdmitCheckoutFinalizationInput): string {
	return canonicalJson({
		version: 1,
		checkoutId: input.checkoutId,
		expectedRevision: input.expectedRevision,
		acceptedInput: input.acceptedInput,
	});
}

function attemptDigestMaterial(
	input: RecordCheckoutFinalizationAttemptInput,
): string {
	return canonicalJson({ version: 1, ...input });
}

function compensationDigestMaterial(
	input: RecordCheckoutFinalizationCompensationInput,
): string {
	return canonicalJson({ version: 1, ...input });
}

async function lockedFinalization(
	transaction: LockingModuleDataTransaction,
	finalizationId: string,
): Promise<CheckoutFinalization> {
	const stored = await transaction.getForUpdate(
		"checkoutFinalization",
		finalizationId,
	);
	if (!stored) {
		throw new CheckoutFinalizationError(
			"FINALIZATION_NOT_FOUND",
			"The Checkout Finalization was not found.",
		);
	}
	const finalization = storedCheckoutFinalizationSchema.safeParse(stored);
	if (!finalization.success) {
		throw new CheckoutFinalizationError(
			"STORED_STATE_INVALID",
			"The stored Checkout Finalization is invalid.",
		);
	}
	return finalization.data;
}

function mergeOptionalReference(
	label: string,
	current: string | undefined,
	incoming: string | undefined,
): string | undefined {
	if (current && incoming && current !== incoming) {
		throw new CheckoutFinalizationError(
			"OPERATION_CONFLICT",
			`${label} cannot be replaced after it is recorded.`,
		);
	}
	return current ?? incoming;
}

function mergePaymentReference(
	current: z.infer<typeof paymentResultReferenceSchema> | undefined,
	incoming: z.infer<typeof paymentResultReferenceSchema> | undefined,
): z.infer<typeof paymentResultReferenceSchema> | undefined {
	if (!current) return incoming;
	if (!incoming) return current;
	return {
		connectionId:
			mergeOptionalReference(
				"Payment Connection reference",
				current.connectionId,
				incoming.connectionId,
			) ?? current.connectionId,
		paymentId:
			mergeOptionalReference(
				"Payment reference",
				current.paymentId,
				incoming.paymentId,
			) ?? current.paymentId,
		...(mergeOptionalReference(
			"Payment authorization operation reference",
			current.authorizationOperationId,
			incoming.authorizationOperationId,
		)
			? {
					authorizationOperationId: mergeOptionalReference(
						"Payment authorization operation reference",
						current.authorizationOperationId,
						incoming.authorizationOperationId,
					),
				}
			: {}),
		...(mergeOptionalReference(
			"Payment capture operation reference",
			current.captureOperationId,
			incoming.captureOperationId,
		)
			? {
					captureOperationId: mergeOptionalReference(
						"Payment capture operation reference",
						current.captureOperationId,
						incoming.captureOperationId,
					),
				}
			: {}),
		...(mergeOptionalReference(
			"Payment reconciliation operation reference",
			current.reconciliationOperationId,
			incoming.reconciliationOperationId,
		)
			? {
					reconciliationOperationId: mergeOptionalReference(
						"Payment reconciliation operation reference",
						current.reconciliationOperationId,
						incoming.reconciliationOperationId,
					),
				}
			: {}),
	};
}

function mergeResult(
	current: CheckoutFinalization["result"],
	incoming: z.infer<typeof checkoutFinalizationResultUpdateSchema> | undefined,
): CheckoutFinalization["result"] {
	if (!incoming) return current;
	const orderId = mergeOptionalReference(
		"Order reference",
		current.orderId,
		incoming.orderId,
	);
	const payment = mergePaymentReference(current.payment, incoming.payment);
	return {
		...(orderId ? { orderId } : {}),
		...(payment ? { payment } : {}),
	};
}

function attemptTransition(
	finalization: CheckoutFinalization,
	outcome: z.infer<typeof checkoutFinalizationAttemptOutcomeSchema>,
	result: CheckoutFinalization["result"],
): Pick<CheckoutFinalization, "state" | "currentStep"> &
	Readonly<{
		needsAttention?: z.infer<typeof checkoutFinalizationAttentionSchema>;
	}> {
	switch (outcome.type) {
		case "advanced":
			if (outcome.nextStep === finalization.currentStep) {
				throw new CheckoutFinalizationError(
					"STATE_CONFLICT",
					"An advanced attempt must identify a different next step.",
				);
			}
			return { state: "running", currentStep: outcome.nextStep };
		case "completed":
			// Completion is the one irreversible claim this ledger makes, so it must
			// be reached rather than asserted: the run has to be standing on the
			// completion checkpoint, and it has to name the Order it produced. A
			// completed Finalization with no Order would record a purchase that
			// nothing in the Store Runtime owns.
			if (finalization.currentStep !== "checkout_completion") {
				throw new CheckoutFinalizationError(
					"COMPLETION_INVALID",
					"A Finalization may only complete from its completion checkpoint.",
				);
			}
			if (!result.orderId) {
				throw new CheckoutFinalizationError(
					"COMPLETION_INVALID",
					"A completed Finalization must carry the Order it produced.",
				);
			}
			return { state: "completed", currentStep: "checkout_completion" };
		case "retryable_failure":
			return { state: "running", currentStep: finalization.currentStep };
		case "compensation_required":
			return { state: "compensating", currentStep: "compensation" };
		case "ambiguous":
		case "needs_attention":
			return {
				state: "needs_attention",
				currentStep: finalization.currentStep,
				needsAttention: outcome.reason,
			};
	}
}

function lifecyclePayload(
	finalization: CheckoutFinalization,
	cause: "admitted" | "attempt_recorded" | "compensation_recorded",
	reference?: { attemptId?: string; compensationId?: string },
) {
	return {
		finalizationId: finalization.id,
		checkoutId: finalization.checkoutId,
		inputDigest: finalization.inputDigest,
		expectedRevision: finalization.expectedRevision,
		state: finalization.state,
		currentStep: finalization.currentStep,
		attemptCount: finalization.attemptCount,
		compensationCount: finalization.compensationCount,
		cause,
		...(reference?.attemptId ? { attemptId: reference.attemptId } : {}),
		...(reference?.compensationId
			? { compensationId: reference.compensationId }
			: {}),
		result: finalization.result,
		...(finalization.needsAttention
			? { needsAttention: finalization.needsAttention }
			: {}),
	};
}

async function admitLocked(
	transaction: LockingModuleDataTransaction,
	input: AdmitCheckoutFinalizationInput,
): Promise<{ finalization: CheckoutFinalization; replayed: boolean }> {
	const lockHash = await sha256(
		`checkout-finalization-lock:v1:${input.checkoutId}`,
	);
	const lockId = `checkout_finalization_lock_${lockHash}`;
	await transaction.upsert("checkoutFinalizationLock", lockId, {
		id: lockId,
		checkoutId: input.checkoutId,
	});
	const lock = await transaction.getForUpdate(
		"checkoutFinalizationLock",
		lockId,
	);
	if (!lock) {
		throw new CheckoutFinalizationError(
			"LOCKING_UNAVAILABLE",
			"Checkout could not acquire its owner-local Finalization lock.",
		);
	}

	const inputDigest = await sha256(inputDigestMaterial(input));
	const identityHash = await sha256(
		`checkout-finalization:v1:${input.checkoutId}:${input.operationKey}`,
	);
	const finalizationId = `checkout_finalization_${identityHash}`;
	const existingRows = await transaction.findMany("checkoutFinalization", {
		where: { checkoutId: input.checkoutId },
		take: 2,
	});
	if (existingRows.length > 0) {
		if (existingRows.length !== 1) {
			throw new CheckoutFinalizationError(
				"STORED_STATE_INVALID",
				"Checkout has multiple stored Finalization aggregates.",
			);
		}
		const existing = storedCheckoutFinalizationSchema.safeParse(
			existingRows[0],
		);
		if (!existing.success) {
			throw new CheckoutFinalizationError(
				"STORED_STATE_INVALID",
				"The stored Checkout Finalization is invalid.",
			);
		}
		if (
			existing.data.id !== finalizationId ||
			existing.data.operationKey !== input.operationKey ||
			existing.data.inputDigest !== inputDigest
		) {
			throw new CheckoutFinalizationError(
				"FINALIZATION_CONFLICT",
				"Checkout already has a Finalization with a different operation or input.",
			);
		}
		return { finalization: existing.data, replayed: true };
	}

	const storedCheckout = await transaction.getForUpdate(
		"checkoutSession",
		input.checkoutId,
	);
	if (!storedCheckout) {
		throw new CheckoutFinalizationError(
			"CHECKOUT_NOT_FOUND",
			"The Checkout session was not found.",
		);
	}
	const checkout = storedCheckoutSessionSchema.safeParse(storedCheckout);
	if (!checkout.success || checkout.data.id !== input.checkoutId) {
		throw new CheckoutFinalizationError(
			"STORED_STATE_INVALID",
			"The stored Checkout session is invalid.",
		);
	}
	if (checkout.data.revision !== input.expectedRevision) {
		throw new CheckoutFinalizationError(
			"CHECKOUT_REVISION_CONFLICT",
			"The Checkout revision changed before Finalization admission.",
		);
	}
	if (checkout.data.status !== "pending") {
		throw new CheckoutFinalizationError(
			"CHECKOUT_STATE_INVALID",
			"Only a pending Checkout can be admitted for Finalization.",
		);
	}

	const now = new Date();
	const finalization = {
		id: finalizationId,
		checkoutId: input.checkoutId,
		operationKey: input.operationKey,
		inputDigest,
		inputDigestVersion: 1,
		expectedRevision: input.expectedRevision,
		state: "pending",
		currentStep: "checkout_revision",
		attemptCount: 0,
		compensationCount: 0,
		acceptedInput: input.acceptedInput,
		result: {},
		createdAt: now,
		updatedAt: now,
	} satisfies CheckoutFinalization;
	await transaction.upsert(
		"checkoutFinalization",
		finalization.id,
		finalization,
	);
	await transaction.emit(checkoutFinalizationLifecycleV1, {
		aggregate: { type: "checkoutFinalization", id: finalization.id },
		occurredAt: now,
		payload: lifecyclePayload(finalization, "admitted"),
	});
	return { finalization, replayed: false };
}

async function recordAttemptLocked(
	transaction: LockingModuleDataTransaction,
	input: RecordCheckoutFinalizationAttemptInput,
): Promise<{
	finalization: CheckoutFinalization;
	attempt: CheckoutFinalizationAttempt;
	replayed: boolean;
}> {
	const finalization = await lockedFinalization(
		transaction,
		input.finalizationId,
	);
	const operationDigest = await sha256(attemptDigestMaterial(input));
	const attemptHash = await sha256(
		`checkout-finalization-attempt:v1:${input.finalizationId}:${input.attemptKey}`,
	);
	const attemptId = `checkout_finalization_attempt_${attemptHash}`;
	const storedAttempt = await transaction.getForUpdate(
		"checkoutFinalizationAttempt",
		attemptId,
	);
	if (storedAttempt) {
		const attempt =
			storedCheckoutFinalizationAttemptSchema.safeParse(storedAttempt);
		if (!attempt.success) {
			throw new CheckoutFinalizationError(
				"STORED_STATE_INVALID",
				"The stored Finalization attempt is invalid.",
			);
		}
		if (
			attempt.data.finalizationId !== input.finalizationId ||
			attempt.data.operationDigest !== operationDigest
		) {
			throw new CheckoutFinalizationError(
				"OPERATION_CONFLICT",
				"The attempt key was already used for different Finalization input.",
			);
		}
		return { finalization, attempt: attempt.data, replayed: true };
	}

	if (
		finalization.attemptCount !== input.expectedAttemptCount ||
		finalization.state !== input.expectedState ||
		finalization.currentStep !== input.expectedStep
	) {
		throw new CheckoutFinalizationError(
			"STATE_CONFLICT",
			"The Finalization state, step, or attempt count changed.",
		);
	}
	const sequence = finalization.attemptCount + 1;
	if (!Number.isSafeInteger(sequence)) {
		throw new CheckoutFinalizationError(
			"STORED_STATE_INVALID",
			"The Finalization attempt count exceeded safe integer bounds.",
		);
	}
	const result = mergeResult(finalization.result, input.result);
	const transition = attemptTransition(finalization, input.outcome, result);
	const now = new Date();
	const nextFinalization = {
		...finalization,
		state: transition.state,
		currentStep: transition.currentStep,
		attemptCount: sequence,
		result,
		...(transition.needsAttention
			? { needsAttention: transition.needsAttention }
			: {}),
		updatedAt: now,
	} satisfies CheckoutFinalization;
	const attempt = {
		id: attemptId,
		finalizationId: finalization.id,
		attemptKey: input.attemptKey,
		operationDigest,
		operationDigestVersion: 1,
		sequence,
		stateBefore: input.expectedState,
		stateAfter: nextFinalization.state,
		step: input.expectedStep,
		nextStep: nextFinalization.currentStep,
		outcome: input.outcome,
		...(input.result ? { result: input.result } : {}),
		recordedAt: now,
	} satisfies CheckoutFinalizationAttempt;

	await transaction.upsert(
		"checkoutFinalization",
		nextFinalization.id,
		nextFinalization,
	);
	await transaction.upsert("checkoutFinalizationAttempt", attempt.id, attempt);
	await transaction.emit(checkoutFinalizationLifecycleV1, {
		aggregate: { type: "checkoutFinalization", id: nextFinalization.id },
		occurredAt: now,
		payload: lifecyclePayload(nextFinalization, "attempt_recorded", {
			attemptId: attempt.id,
		}),
	});
	return { finalization: nextFinalization, attempt, replayed: false };
}

async function recordCompensationLocked(
	transaction: LockingModuleDataTransaction,
	input: RecordCheckoutFinalizationCompensationInput,
): Promise<{
	finalization: CheckoutFinalization;
	compensation: CheckoutFinalizationCompensation;
	replayed: boolean;
}> {
	const finalization = await lockedFinalization(
		transaction,
		input.finalizationId,
	);
	const operationDigest = await sha256(compensationDigestMaterial(input));
	const compensationHash = await sha256(
		`checkout-finalization-compensation:v1:${input.finalizationId}:${input.compensationKey}`,
	);
	const compensationId = `checkout_finalization_compensation_${compensationHash}`;
	const storedCompensation = await transaction.getForUpdate(
		"checkoutFinalizationCompensation",
		compensationId,
	);
	if (storedCompensation) {
		const compensation =
			storedCheckoutFinalizationCompensationSchema.safeParse(
				storedCompensation,
			);
		if (!compensation.success) {
			throw new CheckoutFinalizationError(
				"STORED_STATE_INVALID",
				"The stored Finalization compensation is invalid.",
			);
		}
		if (
			compensation.data.finalizationId !== input.finalizationId ||
			compensation.data.operationDigest !== operationDigest
		) {
			throw new CheckoutFinalizationError(
				"OPERATION_CONFLICT",
				"The compensation key was already used for different input.",
			);
		}
		return { finalization, compensation: compensation.data, replayed: true };
	}

	if (
		finalization.state !== "compensating" ||
		finalization.currentStep !== "compensation" ||
		finalization.compensationCount !== input.expectedCompensationCount
	) {
		throw new CheckoutFinalizationError(
			"STATE_CONFLICT",
			"The Finalization is not at the expected compensation sequence.",
		);
	}
	const sequence = finalization.compensationCount + 1;
	if (!Number.isSafeInteger(sequence)) {
		throw new CheckoutFinalizationError(
			"STORED_STATE_INVALID",
			"The compensation count exceeded safe integer bounds.",
		);
	}
	const now = new Date();
	const compensation = {
		id: compensationId,
		finalizationId: finalization.id,
		compensationKey: input.compensationKey,
		operationDigest,
		operationDigestVersion: 1,
		sequence,
		action: input.action,
		target: input.target,
		outcome: input.outcome,
		recordedAt: now,
	} satisfies CheckoutFinalizationCompensation;
	const nextFinalization = {
		...finalization,
		state:
			input.outcome.type === "ambiguous" ? "needs_attention" : "compensating",
		currentStep: "compensation",
		compensationCount: sequence,
		...(input.outcome.type === "ambiguous"
			? { needsAttention: input.outcome.reason }
			: {}),
		updatedAt: now,
	} satisfies CheckoutFinalization;

	await transaction.upsert(
		"checkoutFinalization",
		nextFinalization.id,
		nextFinalization,
	);
	await transaction.upsert(
		"checkoutFinalizationCompensation",
		compensation.id,
		compensation,
	);
	await transaction.emit(checkoutFinalizationLifecycleV1, {
		aggregate: { type: "checkoutFinalization", id: nextFinalization.id },
		occurredAt: now,
		payload: lifecyclePayload(nextFinalization, "compensation_recorded", {
			compensationId: compensation.id,
		}),
	});
	return { finalization: nextFinalization, compensation, replayed: false };
}

async function readSnapshotLocked(
	transaction: LockingModuleDataTransaction,
	id: string,
): Promise<CheckoutFinalizationSnapshot> {
	const finalization = await lockedFinalization(transaction, id);
	const storedAttempts = await transaction.findMany(
		"checkoutFinalizationAttempt",
		{
			where: { finalizationId: id },
			orderBy: { sequence: "asc" },
		},
	);
	const attempts: CheckoutFinalizationAttempt[] = [];
	for (const stored of storedAttempts) {
		const attempt = storedCheckoutFinalizationAttemptSchema.safeParse(stored);
		if (!attempt.success) {
			throw new CheckoutFinalizationError(
				"STORED_STATE_INVALID",
				"The stored Finalization attempt history is invalid.",
			);
		}
		attempts.push(attempt.data);
	}
	const storedCompensations = await transaction.findMany(
		"checkoutFinalizationCompensation",
		{
			where: { finalizationId: id },
			orderBy: { sequence: "asc" },
		},
	);
	const compensations: CheckoutFinalizationCompensation[] = [];
	for (const stored of storedCompensations) {
		const compensation =
			storedCheckoutFinalizationCompensationSchema.safeParse(stored);
		if (!compensation.success) {
			throw new CheckoutFinalizationError(
				"STORED_STATE_INVALID",
				"The stored Finalization compensation history is invalid.",
			);
		}
		compensations.push(compensation.data);
	}
	return { finalization, attempts, compensations };
}

/**
 * Creates the Checkout-owned Finalization ledger.
 *
 * It validates and locks the Checkout revision, then records only references
 * supplied by a trusted orchestrator. It invokes no commerce capability and has
 * no transport of its own.
 *
 * A run may reach the terminal `completed` state, but only from the completion
 * checkpoint and only while naming the Order it produced. Completion remains a
 * statement about this ledger: it does not mark the Checkout session completed,
 * which stays the session owner's transition.
 */
export function createCheckoutFinalizationStore(
	transactions: ModuleTransactionRunner | undefined,
): CheckoutFinalizationStore {
	if (!transactions) {
		throw new CheckoutFinalizationError(
			"TRANSACTION_UNAVAILABLE",
			"Checkout Finalization requires transactional durable-event storage.",
		);
	}

	return {
		async admit(input) {
			const parsed = admitCheckoutFinalizationInputSchema.safeParse(input);
			if (!parsed.success) {
				throw new CheckoutFinalizationError(
					"INPUT_INVALID",
					"Checkout Finalization admission input is invalid.",
				);
			}
			return transactions.transaction((transaction) => {
				if (!isLockingTransaction(transaction)) {
					throw new CheckoutFinalizationError(
						"LOCKING_UNAVAILABLE",
						"Checkout Finalization requires owner-local row locking.",
					);
				}
				return admitLocked(transaction, parsed.data);
			});
		},
		async recordAttempt(input) {
			const parsed =
				recordCheckoutFinalizationAttemptInputSchema.safeParse(input);
			if (!parsed.success) {
				throw new CheckoutFinalizationError(
					"INPUT_INVALID",
					"Checkout Finalization attempt input is invalid.",
				);
			}
			return transactions.transaction((transaction) => {
				if (!isLockingTransaction(transaction)) {
					throw new CheckoutFinalizationError(
						"LOCKING_UNAVAILABLE",
						"Checkout Finalization attempts require owner-local row locking.",
					);
				}
				return recordAttemptLocked(transaction, parsed.data);
			});
		},
		async recordCompensation(input) {
			const parsed =
				recordCheckoutFinalizationCompensationInputSchema.safeParse(input);
			if (!parsed.success) {
				throw new CheckoutFinalizationError(
					"INPUT_INVALID",
					"Checkout Finalization compensation input is invalid.",
				);
			}
			return transactions.transaction((transaction) => {
				if (!isLockingTransaction(transaction)) {
					throw new CheckoutFinalizationError(
						"LOCKING_UNAVAILABLE",
						"Checkout compensation records require owner-local row locking.",
					);
				}
				return recordCompensationLocked(transaction, parsed.data);
			});
		},
		async getById(id) {
			const parsedId = identifier.safeParse(id);
			if (!parsedId.success) {
				throw new CheckoutFinalizationError(
					"INPUT_INVALID",
					"Checkout Finalization ID is invalid.",
				);
			}
			return transactions.transaction((transaction) => {
				if (!isLockingTransaction(transaction)) {
					throw new CheckoutFinalizationError(
						"LOCKING_UNAVAILABLE",
						"Checkout Finalization reads require owner-local row locking.",
					);
				}
				return readSnapshotLocked(transaction, parsedId.data);
			});
		},
	};
}
