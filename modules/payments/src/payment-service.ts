import {
	defineDurableEvent,
	type LockingModuleDataTransaction,
	type ModuleDataTransaction,
	type ModuleTransactionRunner,
} from "@86d-app/core/durable-events";
import type { PaymentOperationPayload } from "@86d-app/core/payment-connection-provider";
import type {
	ModuleController,
	ModuleDataService,
} from "@86d-app/core/types/module";
import { z } from "zod";

const identifierSchema = z.string().trim().min(1).max(255);
const idempotencyKeySchema = z.string().trim().min(8).max(200);
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const currencySchema = z.string().regex(/^[A-Z]{3}$/);
const providerReferenceSchema = z.string().trim().min(1).max(500);
const positiveMinorAmountSchema = z
	.number()
	.int()
	.positive()
	.max(Number.MAX_SAFE_INTEGER);
const minorAmountSchema = z
	.number()
	.int()
	.nonnegative()
	.max(Number.MAX_SAFE_INTEGER);
const dateSchema = z.coerce.date();

export const paymentOptionSchema = z.enum([
	"card",
	"apple_pay",
	"google_pay",
	"paypal",
]);

export const paymentStateSchema = z.enum([
	"pending",
	"authorized",
	"partially_captured",
	"captured",
	"partially_refunded",
	"refunded",
	"voided",
]);

export const paymentTerminalStateSchema = z.enum([
	"none",
	"refunded",
	"voided",
]);

export const paymentDisputeStateSchema = z.enum([
	"none",
	"open",
	"won",
	"lost",
	"reversed",
]);

export const paymentDisputeProjectionSchema = z
	.object({
		state: paymentDisputeStateSchema,
		providerDisputeReference: providerReferenceSchema.optional(),
		lastEventId: identifierSchema.optional(),
		lastEventDigest: digestSchema.optional(),
		occurredAt: dateSchema.optional(),
		revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
	})
	.strict();

export const paymentProviderReferenceSchema = z
	.object({
		operationId: identifierSchema,
		operation: z.enum(["intent", "authorization", "capture", "refund", "void"]),
		sourceOperationId: identifierSchema.optional(),
		requestDigest: digestSchema,
		providerReference: providerReferenceSchema,
		amount: positiveMinorAmountSchema,
		currency: currencySchema,
		confirmedAt: dateSchema,
	})
	.strict();

export const paymentAggregateSchema = z
	.object({
		id: identifierSchema,
		modelVersion: z.literal(2),
		checkoutId: identifierSchema,
		orderId: identifierSchema.optional(),
		connectionId: identifierSchema,
		paymentOption: paymentOptionSchema,
		expectedAmount: positiveMinorAmountSchema,
		eligibleMerchandiseAmount: minorAmountSchema,
		currency: currencySchema,
		authorizedAmount: minorAmountSchema,
		capturedAmount: minorAmountSchema,
		voidedAmount: minorAmountSchema,
		confirmedRefundedAmount: minorAmountSchema,
		providerReferences: z.array(paymentProviderReferenceSchema).max(10_000),
		dispute: paymentDisputeProjectionSchema,
		state: paymentStateSchema,
		terminalState: paymentTerminalStateSchema,
		creationIdempotencyKey: idempotencyKeySchema,
		creationDigest: digestSchema,
		creationDigestVersion: z.literal(1),
		revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
		terminalAt: dateSchema.optional(),
		createdAt: dateSchema,
		updatedAt: dateSchema,
	})
	.strict()
	.superRefine((payment, context) => {
		if (payment.eligibleMerchandiseAmount > payment.expectedAmount) {
			context.addIssue({
				code: "custom",
				message:
					"Eligible merchandise fee basis cannot exceed the accepted Payment amount.",
				path: ["eligibleMerchandiseAmount"],
			});
		}
		if (payment.capturedAmount > payment.expectedAmount) {
			context.addIssue({
				code: "custom",
				message: "Captured amount exceeds the accepted Payment amount.",
				path: ["capturedAmount"],
			});
		}
		if (payment.authorizedAmount > payment.expectedAmount) {
			context.addIssue({
				code: "custom",
				message: "Authorized amount exceeds the accepted Payment amount.",
				path: ["authorizedAmount"],
			});
		}
		if (payment.confirmedRefundedAmount > payment.capturedAmount) {
			context.addIssue({
				code: "custom",
				message: "Confirmed refunds exceed confirmed capture.",
				path: ["confirmedRefundedAmount"],
			});
		}
		if (
			payment.capturedAmount + payment.voidedAmount >
			payment.authorizedAmount
		) {
			context.addIssue({
				code: "custom",
				message: "Capture and void totals exceed confirmed authorization.",
				path: ["authorizedAmount"],
			});
		}
		if (
			(payment.terminalState === "none") !==
			(payment.terminalAt === undefined)
		) {
			context.addIssue({
				code: "custom",
				message: "Terminal Payment state and timestamp must change together.",
				path: ["terminalState"],
			});
		}
		const lifecycle = deriveLifecycle(payment);
		if (
			payment.state !== lifecycle.state ||
			payment.terminalState !== lifecycle.terminalState
		) {
			context.addIssue({
				code: "custom",
				message: "Payment lifecycle does not match its confirmed totals.",
				path: ["state"],
			});
		}
	});

export type PaymentAggregate = z.infer<typeof paymentAggregateSchema>;
export type PaymentOption = z.infer<typeof paymentOptionSchema>;

export const createPaymentAggregateInputSchema = z
	.object({
		paymentId: identifierSchema,
		idempotencyKey: idempotencyKeySchema,
		checkoutId: identifierSchema,
		orderId: identifierSchema.optional(),
		connectionId: identifierSchema,
		paymentOption: paymentOptionSchema,
		expectedAmount: positiveMinorAmountSchema,
		eligibleMerchandiseAmount: minorAmountSchema,
		currency: currencySchema,
	})
	.strict()
	.superRefine((input, context) => {
		if (input.eligibleMerchandiseAmount > input.expectedAmount) {
			context.addIssue({
				code: "custom",
				message:
					"Eligible merchandise fee basis cannot exceed the accepted Payment amount.",
				path: ["eligibleMerchandiseAmount"],
			});
		}
	});

export type CreatePaymentAggregateInput = z.infer<
	typeof createPaymentAggregateInputSchema
>;

export const confirmedPaymentOperationInputSchema = z
	.object({
		paymentId: identifierSchema,
		connectionId: identifierSchema,
		operationId: identifierSchema,
		operation: z.enum(["intent", "authorization", "capture", "refund", "void"]),
		sourceOperationId: identifierSchema.optional(),
		amount: positiveMinorAmountSchema.optional(),
		currency: currencySchema.optional(),
		requestDigest: digestSchema,
		providerReference: providerReferenceSchema,
		confirmedAt: dateSchema,
	})
	.strict()
	.superRefine((input, context) => {
		if (input.operation === "void") {
			if (input.amount !== undefined || input.currency !== undefined) {
				context.addIssue({
					code: "custom",
					message:
						"A void derives its amount and currency from its authorization.",
				});
			}
		} else if (input.amount === undefined || input.currency === undefined) {
			context.addIssue({
				code: "custom",
				message: "This confirmed operation requires amount and currency.",
			});
		}
		const requiresSource = ["capture", "refund", "void"].includes(
			input.operation,
		);
		const prohibitsSource = input.operation === "intent";
		if (
			(requiresSource && input.sourceOperationId === undefined) ||
			(prohibitsSource && input.sourceOperationId !== undefined)
		) {
			context.addIssue({
				code: "custom",
				message:
					"Capture, refund, and void require exactly one source operation.",
				path: ["sourceOperationId"],
			});
		}
	});

export type ConfirmedPaymentOperationInput = z.infer<
	typeof confirmedPaymentOperationInputSchema
>;

export const applyPaymentDisputeInputSchema = z
	.object({
		paymentId: identifierSchema,
		connectionId: identifierSchema,
		eventId: identifierSchema,
		eventDigest: digestSchema,
		providerDisputeReference: providerReferenceSchema,
		state: paymentDisputeStateSchema.exclude(["none"]),
		occurredAt: dateSchema,
	})
	.strict();

export type ApplyPaymentDisputeInput = z.infer<
	typeof applyPaymentDisputeInputSchema
>;

const paymentSnapshotEventSchema = z
	.object({
		paymentId: identifierSchema,
		paymentModelVersion: z.literal(2),
		checkoutId: identifierSchema,
		orderId: identifierSchema.optional(),
		connectionId: identifierSchema,
		paymentOption: paymentOptionSchema,
		expectedAmount: positiveMinorAmountSchema,
		eligibleMerchandiseAmount: minorAmountSchema,
		currency: currencySchema,
		authorizedAmount: minorAmountSchema,
		capturedAmount: minorAmountSchema,
		voidedAmount: minorAmountSchema,
		confirmedRefundedAmount: minorAmountSchema,
		state: paymentStateSchema,
		terminalState: paymentTerminalStateSchema,
		dispute: paymentDisputeProjectionSchema,
		revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
		cause: z.discriminatedUnion("type", [
			z
				.object({
					type: z.literal("provider_operation"),
					operationId: identifierSchema,
					operation: z.enum([
						"intent",
						"authorization",
						"capture",
						"refund",
						"void",
					]),
					sourceOperationId: identifierSchema.optional(),
					providerReference: providerReferenceSchema,
					amount: positiveMinorAmountSchema,
					currency: currencySchema,
				})
				.strict(),
			z
				.object({
					type: z.literal("dispute"),
					eventId: identifierSchema,
					providerDisputeReference: providerReferenceSchema,
					state: paymentDisputeStateSchema.exclude(["none"]),
				})
				.strict(),
		]),
	})
	.strict();

/** Payment-owner fact emitted only with a confirmed aggregate transition. */
export const paymentTransitionConfirmedV1 = defineDurableEvent({
	name: "payment.transition-confirmed",
	version: 1,
	owner: "payments",
	payload: paymentSnapshotEventSchema,
});

const storedDisputeFactSchema = z
	.object({
		id: identifierSchema,
		paymentId: identifierSchema,
		connectionId: identifierSchema,
		eventId: identifierSchema,
		eventDigest: digestSchema,
		providerDisputeReference: providerReferenceSchema,
		state: paymentDisputeStateSchema.exclude(["none"]),
		occurredAt: dateSchema,
		appliedRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
	})
	.strict();

export type PaymentAggregateErrorCode =
	| "CAPTURE_LIMIT_EXCEEDED"
	| "CURRENCY_MISMATCH"
	| "DISPUTE_REGRESSION"
	| "IMMUTABLE_IDENTITY"
	| "INPUT_INVALID"
	| "LOCKING_UNAVAILABLE"
	| "OPERATION_CONFLICT"
	| "OPERATION_INVALID"
	| "PAYMENT_CONFLICT"
	| "PAYMENT_NOT_FOUND"
	| "REFUND_LIMIT_EXCEEDED"
	| "SOURCE_OPERATION_INVALID"
	| "STORED_STATE_INVALID"
	| "TERMINAL_STATE"
	| "TRANSACTION_UNAVAILABLE";

export class PaymentAggregateError extends Error {
	readonly code: PaymentAggregateErrorCode;

	constructor(code: PaymentAggregateErrorCode, message: string) {
		super(message);
		this.name = "PaymentAggregateError";
		this.code = code;
	}
}

export interface PaymentAggregateStore extends ModuleController {
	create(input: CreatePaymentAggregateInput): Promise<{
		payment: PaymentAggregate;
		replayed: boolean;
	}>;
	bindOrder(paymentId: string, orderId: string): Promise<PaymentAggregate>;
	get(paymentId: string): Promise<PaymentAggregate | null>;
	recordConfirmedOperation(input: ConfirmedPaymentOperationInput): Promise<{
		payment: PaymentAggregate;
		replayed: boolean;
	}>;
	applyDispute(input: ApplyPaymentDisputeInput): Promise<{
		payment: PaymentAggregate;
		replayed: boolean;
	}>;
}

export type PendingPaymentOperationClaim = Readonly<{
	operation: "intent" | "authorization" | "capture" | "refund" | "void";
	sourceOperationId?: string | undefined;
	payload: PaymentOperationPayload;
}>;

function isLockingTransaction(
	transaction: ModuleDataTransaction,
): transaction is LockingModuleDataTransaction {
	return (
		"getForUpdate" in transaction &&
		typeof transaction.getForUpdate === "function"
	);
}

function canonicalJson(value: unknown): string {
	if (value === null || typeof value !== "object") {
		return JSON.stringify(value) ?? "null";
	}
	if (Array.isArray(value)) {
		return `[${value.map(canonicalJson).join(",")}]`;
	}
	const record = value as Record<string, unknown>;
	return `{${Object.keys(record)
		.sort()
		.map(
			(key) => `${JSON.stringify(key)}:${canonicalJson(record[key] ?? null)}`,
		)
		.join(",")}}`;
}

async function sha256(value: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(value),
	);
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

function requirePayment(row: Record<string, unknown> | null): PaymentAggregate {
	if (!row) {
		throw new PaymentAggregateError(
			"PAYMENT_NOT_FOUND",
			"Payment aggregate not found.",
		);
	}
	const parsed = paymentAggregateSchema.safeParse(row);
	if (!parsed.success) {
		throw new PaymentAggregateError(
			"STORED_STATE_INVALID",
			"The stored Payment aggregate is invalid.",
		);
	}
	return parsed.data;
}

async function lockPayment(
	transaction: LockingModuleDataTransaction,
	paymentId: string,
): Promise<PaymentAggregate | null> {
	const lockId = `payment-v2:${paymentId}`;
	await transaction.upsert("paymentV2Lock", lockId, { id: lockId, paymentId });
	const lock = await transaction.getForUpdate("paymentV2Lock", lockId);
	if (!lock) {
		throw new PaymentAggregateError(
			"LOCKING_UNAVAILABLE",
			"Payment could not acquire its owner-local lock.",
		);
	}
	const row = await transaction.getForUpdate("paymentV2", paymentId);
	return row ? requirePayment(row) : null;
}

function checkedAdd(
	left: number,
	right: number,
	code: PaymentAggregateErrorCode,
	message: string,
): number {
	const total = left + right;
	if (!Number.isSafeInteger(total)) {
		throw new PaymentAggregateError(code, message);
	}
	return total;
}

function latestDate(left: Date, right: Date): Date {
	return left >= right ? left : right;
}

function operationAmount(payload: PaymentOperationPayload): number | undefined {
	return payload.operation === "void" ? undefined : payload.amount;
}

function referenceAmount(
	payment: PaymentAggregate,
	operation: "capture" | "refund" | "void",
	sourceOperationId: string,
): number {
	return payment.providerReferences
		.filter(
			(reference) =>
				reference.operation === operation &&
				reference.sourceOperationId === sourceOperationId,
		)
		.reduce((total, reference) => total + reference.amount, 0);
}

function pendingAmount(
	pending: readonly PendingPaymentOperationClaim[],
	operation: "authorization" | "capture" | "refund",
	sourceOperationId?: string,
): number {
	return pending
		.filter(
			(claim) =>
				claim.operation === operation &&
				(sourceOperationId === undefined ||
					claim.sourceOperationId === sourceOperationId),
		)
		.reduce((total, claim) => total + (operationAmount(claim.payload) ?? 0), 0);
}

function sourceReference(payment: PaymentAggregate, operationId: string) {
	return payment.providerReferences.find(
		(reference) => reference.operationId === operationId,
	);
}

function assertIdentity(
	payment: PaymentAggregate,
	connectionId: string,
	currency?: string,
): void {
	if (payment.connectionId !== connectionId) {
		throw new PaymentAggregateError(
			"IMMUTABLE_IDENTITY",
			"A Payment operation cannot change its immutable Connection.",
		);
	}
	if (currency !== undefined && payment.currency !== currency) {
		throw new PaymentAggregateError(
			"CURRENCY_MISMATCH",
			"A Payment operation cannot change currency.",
		);
	}
}

function requireOpen(payment: PaymentAggregate): void {
	if (payment.terminalState !== "none") {
		throw new PaymentAggregateError(
			"TERMINAL_STATE",
			"A terminal Payment cannot accept another financial operation.",
		);
	}
}

/**
 * Confirmed-total projection:
 * pending -> authorized -> partially_captured -> captured;
 * any partial refund projects partially_refunded; only a fully captured and
 * fully refunded accepted amount is terminal refunded; a full authorization
 * void with no capture is terminal voided. Disputes project independently.
 */
function deriveLifecycle(payment: {
	expectedAmount: number;
	authorizedAmount: number;
	capturedAmount: number;
	voidedAmount: number;
	confirmedRefundedAmount: number;
}): {
	state: z.infer<typeof paymentStateSchema>;
	terminalState: z.infer<typeof paymentTerminalStateSchema>;
} {
	if (
		payment.capturedAmount === payment.expectedAmount &&
		payment.confirmedRefundedAmount === payment.capturedAmount
	) {
		return { state: "refunded", terminalState: "refunded" };
	}
	if (payment.confirmedRefundedAmount > 0) {
		return { state: "partially_refunded", terminalState: "none" };
	}
	if (payment.capturedAmount === payment.expectedAmount) {
		return { state: "captured", terminalState: "none" };
	}
	if (payment.capturedAmount > 0) {
		return { state: "partially_captured", terminalState: "none" };
	}
	if (
		payment.authorizedAmount > 0 &&
		payment.voidedAmount === payment.authorizedAmount
	) {
		return { state: "voided", terminalState: "voided" };
	}
	if (payment.authorizedAmount > payment.voidedAmount) {
		return { state: "authorized", terminalState: "none" };
	}
	return { state: "pending", terminalState: "none" };
}

function transitionEventPayload(
	payment: PaymentAggregate,
	cause:
		| {
				type: "provider_operation";
				operationId: string;
				operation: ConfirmedPaymentOperationInput["operation"];
				sourceOperationId?: string | undefined;
				providerReference: string;
				amount: number;
				currency: string;
		  }
		| {
				type: "dispute";
				eventId: string;
				providerDisputeReference: string;
				state: ApplyPaymentDisputeInput["state"];
		  },
) {
	return {
		paymentId: payment.id,
		paymentModelVersion: payment.modelVersion,
		checkoutId: payment.checkoutId,
		...(payment.orderId ? { orderId: payment.orderId } : {}),
		connectionId: payment.connectionId,
		paymentOption: payment.paymentOption,
		expectedAmount: payment.expectedAmount,
		eligibleMerchandiseAmount: payment.eligibleMerchandiseAmount,
		currency: payment.currency,
		authorizedAmount: payment.authorizedAmount,
		capturedAmount: payment.capturedAmount,
		voidedAmount: payment.voidedAmount,
		confirmedRefundedAmount: payment.confirmedRefundedAmount,
		state: payment.state,
		terminalState: payment.terminalState,
		dispute: payment.dispute,
		revision: payment.revision,
		cause,
	};
}

function sameConfirmedReference(
	stored: z.infer<typeof paymentProviderReferenceSchema>,
	input: ConfirmedPaymentOperationInput,
): boolean {
	return (
		stored.operationId === input.operationId &&
		stored.operation === input.operation &&
		stored.sourceOperationId === input.sourceOperationId &&
		stored.requestDigest === input.requestDigest &&
		stored.providerReference === input.providerReference &&
		(input.operation === "void" ||
			(stored.amount === input.amount && stored.currency === input.currency))
	);
}

/**
 * Locks and validates a future provider call against confirmed and in-flight
 * Payment totals. The caller persists its running operation in the same
 * transaction, making that operation a durable reservation for other keys.
 */
export async function assertPaymentOperationClaimableLocked(
	transaction: LockingModuleDataTransaction,
	input: Readonly<{
		paymentId: string;
		connectionId: string;
		payload: PaymentOperationPayload;
		sourceOperationId?: string | undefined;
	}>,
	loadPending: () => Promise<readonly PendingPaymentOperationClaim[]>,
): Promise<PaymentAggregate> {
	const payment = requirePayment(
		await lockPayment(transaction, input.paymentId),
	);
	// Read reservations only after the Payment owner row is locked. Otherwise two
	// distinct caller keys can both observe an empty sibling set before they
	// serialize, allowing both provider calls to escape the transaction.
	const pending = await loadPending();
	assertIdentity(
		payment,
		input.connectionId,
		input.payload.operation === "void" ? undefined : input.payload.currency,
	);
	requireOpen(payment);

	switch (input.payload.operation) {
		case "intent":
			if (input.payload.amount !== payment.expectedAmount) {
				throw new PaymentAggregateError(
					"OPERATION_INVALID",
					"A provider intent must use the accepted Payment amount.",
				);
			}
			break;
		case "authorization": {
			if (input.sourceOperationId !== undefined) {
				const source = sourceReference(payment, input.sourceOperationId);
				if (source?.operation !== "intent") {
					throw new PaymentAggregateError(
						"SOURCE_OPERATION_INVALID",
						"A referenced authorization requires an exact confirmed intent source.",
					);
				}
				if (input.payload.amount !== source.amount) {
					throw new PaymentAggregateError(
						"OPERATION_INVALID",
						"A referenced authorization must match its exact intent amount.",
					);
				}
			} else if (
				payment.providerReferences.some(
					(reference) => reference.operation === "intent",
				)
			) {
				throw new PaymentAggregateError(
					"SOURCE_OPERATION_INVALID",
					"A Payment with a confirmed intent must authorize from that exact source.",
				);
			}
			const reserved = pendingAmount(pending, "authorization");
			const total = checkedAdd(
				checkedAdd(
					payment.authorizedAmount,
					reserved,
					"OPERATION_INVALID",
					"Authorization reservations exceed safe integer bounds.",
				),
				input.payload.amount,
				"OPERATION_INVALID",
				"Authorization exceeds safe integer bounds.",
			);
			if (total > payment.expectedAmount) {
				throw new PaymentAggregateError(
					"OPERATION_INVALID",
					"Authorization would exceed the accepted Payment amount.",
				);
			}
			break;
		}
		case "capture": {
			const source = input.sourceOperationId
				? sourceReference(payment, input.sourceOperationId)
				: undefined;
			if (source?.operation !== "authorization") {
				throw new PaymentAggregateError(
					"SOURCE_OPERATION_INVALID",
					"Capture requires a confirmed authorization source.",
				);
			}
			const pendingForPayment = pendingAmount(pending, "capture");
			const pendingForSource = pendingAmount(
				pending,
				"capture",
				source.operationId,
			);
			if (
				payment.capturedAmount + pendingForPayment + input.payload.amount >
					payment.expectedAmount ||
				referenceAmount(payment, "capture", source.operationId) +
					pendingForSource +
					input.payload.amount +
					referenceAmount(payment, "void", source.operationId) >
					source.amount
			) {
				throw new PaymentAggregateError(
					"CAPTURE_LIMIT_EXCEEDED",
					"Capture would exceed the accepted amount or its authorization.",
				);
			}
			break;
		}
		case "refund": {
			const source = input.sourceOperationId
				? sourceReference(payment, input.sourceOperationId)
				: undefined;
			if (source?.operation !== "capture") {
				throw new PaymentAggregateError(
					"SOURCE_OPERATION_INVALID",
					"Refund requires an exact confirmed capture source.",
				);
			}
			if (
				payment.confirmedRefundedAmount +
					pendingAmount(pending, "refund") +
					input.payload.amount >
					payment.capturedAmount ||
				referenceAmount(payment, "refund", source.operationId) +
					pendingAmount(pending, "refund", source.operationId) +
					input.payload.amount >
					source.amount
			) {
				throw new PaymentAggregateError(
					"REFUND_LIMIT_EXCEEDED",
					"Refund would exceed confirmed capture.",
				);
			}
			break;
		}
		case "void": {
			const source = input.sourceOperationId
				? sourceReference(payment, input.sourceOperationId)
				: undefined;
			if (source?.operation !== "authorization") {
				throw new PaymentAggregateError(
					"SOURCE_OPERATION_INVALID",
					"Void requires an exact confirmed authorization source.",
				);
			}
			const hasPendingContinuation = pending.some(
				(claim) =>
					claim.sourceOperationId === source.operationId &&
					(claim.operation === "capture" || claim.operation === "void"),
			);
			const remaining =
				source.amount -
				referenceAmount(payment, "capture", source.operationId) -
				referenceAmount(payment, "void", source.operationId);
			if (hasPendingContinuation || remaining <= 0) {
				throw new PaymentAggregateError(
					"OPERATION_INVALID",
					"The authorization has no unclaimed amount to void.",
				);
			}
			break;
		}
	}
	return payment;
}

/** Apply one provider-confirmed operation inside the caller's owner transaction. */
export async function recordConfirmedPaymentOperationLocked(
	transaction: LockingModuleDataTransaction,
	inputValue: ConfirmedPaymentOperationInput,
): Promise<{ payment: PaymentAggregate; replayed: boolean }> {
	const parsed = confirmedPaymentOperationInputSchema.safeParse(inputValue);
	if (!parsed.success) {
		throw new PaymentAggregateError(
			"INPUT_INVALID",
			"The confirmed Payment operation is invalid.",
		);
	}
	const input = parsed.data;
	const payment = requirePayment(
		await lockPayment(transaction, input.paymentId),
	);
	assertIdentity(payment, input.connectionId, input.currency);

	const existing = payment.providerReferences.find(
		(reference) => reference.operationId === input.operationId,
	);
	if (existing) {
		if (!sameConfirmedReference(existing, input)) {
			throw new PaymentAggregateError(
				"OPERATION_CONFLICT",
				"The provider operation was already applied with different facts.",
			);
		}
		return { payment, replayed: true };
	}
	const duplicateProviderFact = payment.providerReferences.find(
		(reference) =>
			reference.operation === input.operation &&
			reference.providerReference === input.providerReference,
	);
	if (duplicateProviderFact) {
		throw new PaymentAggregateError(
			"OPERATION_CONFLICT",
			"One provider fact cannot advance two Payment operations.",
		);
	}
	requireOpen(payment);

	let authorizedAmount = payment.authorizedAmount;
	let capturedAmount = payment.capturedAmount;
	let voidedAmount = payment.voidedAmount;
	let confirmedRefundedAmount = payment.confirmedRefundedAmount;
	let amount = input.amount;
	let currency = input.currency;

	switch (input.operation) {
		case "intent":
			if (input.amount !== payment.expectedAmount) {
				throw new PaymentAggregateError(
					"OPERATION_INVALID",
					"A provider intent must use the accepted Payment amount.",
				);
			}
			break;
		case "authorization":
			if (input.sourceOperationId !== undefined) {
				const source = sourceReference(payment, input.sourceOperationId);
				if (source?.operation !== "intent") {
					throw new PaymentAggregateError(
						"SOURCE_OPERATION_INVALID",
						"A referenced authorization requires an exact confirmed intent source.",
					);
				}
				if (input.amount !== source.amount) {
					throw new PaymentAggregateError(
						"OPERATION_INVALID",
						"A referenced authorization must match its exact intent amount.",
					);
				}
			} else if (
				payment.providerReferences.some(
					(reference) => reference.operation === "intent",
				)
			) {
				throw new PaymentAggregateError(
					"SOURCE_OPERATION_INVALID",
					"A Payment with a confirmed intent must authorize from that exact source.",
				);
			}
			authorizedAmount = checkedAdd(
				authorizedAmount,
				input.amount as number,
				"OPERATION_INVALID",
				"Authorization exceeds safe integer bounds.",
			);
			if (authorizedAmount > payment.expectedAmount) {
				throw new PaymentAggregateError(
					"OPERATION_INVALID",
					"Authorization exceeds the accepted Payment amount.",
				);
			}
			break;
		case "capture": {
			const source = sourceReference(
				payment,
				input.sourceOperationId as string,
			);
			if (source?.operation !== "authorization") {
				throw new PaymentAggregateError(
					"SOURCE_OPERATION_INVALID",
					"Capture requires a confirmed authorization source.",
				);
			}
			const nextSourceCapture =
				referenceAmount(payment, "capture", source.operationId) +
				(input.amount as number);
			if (
				nextSourceCapture +
					referenceAmount(payment, "void", source.operationId) >
				source.amount
			) {
				throw new PaymentAggregateError(
					"CAPTURE_LIMIT_EXCEEDED",
					"Cumulative capture exceeds its authorization.",
				);
			}
			capturedAmount = checkedAdd(
				capturedAmount,
				input.amount as number,
				"CAPTURE_LIMIT_EXCEEDED",
				"Capture exceeds safe integer bounds.",
			);
			if (
				capturedAmount > payment.expectedAmount ||
				capturedAmount + voidedAmount > authorizedAmount
			) {
				throw new PaymentAggregateError(
					"CAPTURE_LIMIT_EXCEEDED",
					"Cumulative capture exceeds authorization or accepted amount.",
				);
			}
			break;
		}
		case "refund": {
			const source = sourceReference(
				payment,
				input.sourceOperationId as string,
			);
			if (source?.operation !== "capture") {
				throw new PaymentAggregateError(
					"SOURCE_OPERATION_INVALID",
					"Refund requires an exact confirmed capture source.",
				);
			}
			if (
				referenceAmount(payment, "refund", source.operationId) +
					(input.amount as number) >
				source.amount
			) {
				throw new PaymentAggregateError(
					"REFUND_LIMIT_EXCEEDED",
					"Cumulative refund exceeds its source capture.",
				);
			}
			confirmedRefundedAmount = checkedAdd(
				confirmedRefundedAmount,
				input.amount as number,
				"REFUND_LIMIT_EXCEEDED",
				"Confirmed refund exceeds safe integer bounds.",
			);
			if (confirmedRefundedAmount > capturedAmount) {
				throw new PaymentAggregateError(
					"REFUND_LIMIT_EXCEEDED",
					"Cumulative confirmed refund exceeds confirmed capture.",
				);
			}
			break;
		}
		case "void": {
			const source = sourceReference(
				payment,
				input.sourceOperationId as string,
			);
			if (source?.operation !== "authorization") {
				throw new PaymentAggregateError(
					"SOURCE_OPERATION_INVALID",
					"Void requires an exact confirmed authorization source.",
				);
			}
			amount =
				source.amount -
				referenceAmount(payment, "capture", source.operationId) -
				referenceAmount(payment, "void", source.operationId);
			currency = payment.currency;
			if (amount <= 0) {
				throw new PaymentAggregateError(
					"OPERATION_INVALID",
					"The authorization has no amount remaining to void.",
				);
			}
			voidedAmount = checkedAdd(
				voidedAmount,
				amount,
				"OPERATION_INVALID",
				"Void exceeds safe integer bounds.",
			);
			break;
		}
	}

	if (amount === undefined || currency === undefined) {
		throw new PaymentAggregateError(
			"OPERATION_INVALID",
			"The confirmed operation has no authoritative amount or currency.",
		);
	}
	const revision = checkedAdd(
		payment.revision,
		1,
		"STORED_STATE_INVALID",
		"Payment revision exceeds safe integer bounds.",
	);
	const lifecycle = deriveLifecycle({
		expectedAmount: payment.expectedAmount,
		authorizedAmount,
		capturedAmount,
		voidedAmount,
		confirmedRefundedAmount,
	});
	const updated = paymentAggregateSchema.parse({
		...payment,
		authorizedAmount,
		capturedAmount,
		voidedAmount,
		confirmedRefundedAmount,
		providerReferences: [
			...payment.providerReferences,
			{
				operationId: input.operationId,
				operation: input.operation,
				...(input.sourceOperationId
					? { sourceOperationId: input.sourceOperationId }
					: {}),
				requestDigest: input.requestDigest,
				providerReference: input.providerReference,
				amount,
				currency,
				confirmedAt: input.confirmedAt,
			},
		],
		state: lifecycle.state,
		terminalState: lifecycle.terminalState,
		...(lifecycle.terminalState === "none"
			? {}
			: { terminalAt: payment.terminalAt ?? input.confirmedAt }),
		revision,
		updatedAt: latestDate(payment.updatedAt, input.confirmedAt),
	});
	await transaction.upsert("paymentV2", updated.id, updated);
	await transaction.emit(paymentTransitionConfirmedV1, {
		aggregate: { type: "payment", id: updated.id },
		occurredAt: input.confirmedAt,
		payload: transitionEventPayload(updated, {
			type: "provider_operation",
			operationId: input.operationId,
			operation: input.operation,
			...(input.sourceOperationId
				? { sourceOperationId: input.sourceOperationId }
				: {}),
			providerReference: input.providerReference,
			amount,
			currency,
		}),
	});
	return { payment: updated, replayed: false };
}

async function applyDisputeLocked(
	transaction: LockingModuleDataTransaction,
	input: ApplyPaymentDisputeInput,
): Promise<{ payment: PaymentAggregate; replayed: boolean }> {
	const payment = requirePayment(
		await lockPayment(transaction, input.paymentId),
	);
	assertIdentity(payment, input.connectionId);
	const factHash = await sha256(
		`payment-dispute-fact:v1:${input.paymentId}:${input.eventId}`,
	);
	const factId = `payment_dispute_${factHash}`;
	const existingRow = await transaction.getForUpdate(
		"paymentDisputeFactV2",
		factId,
	);
	if (existingRow) {
		const existing = storedDisputeFactSchema.safeParse(existingRow);
		if (!existing.success) {
			throw new PaymentAggregateError(
				"STORED_STATE_INVALID",
				"The stored dispute fact is invalid.",
			);
		}
		if (
			existing.data.paymentId !== input.paymentId ||
			existing.data.connectionId !== input.connectionId ||
			existing.data.eventId !== input.eventId ||
			existing.data.eventDigest !== input.eventDigest ||
			existing.data.providerDisputeReference !==
				input.providerDisputeReference ||
			existing.data.state !== input.state
		) {
			throw new PaymentAggregateError(
				"OPERATION_CONFLICT",
				"The provider dispute event was already applied with different facts.",
			);
		}
		return { payment, replayed: true };
	}

	const current = payment.dispute;
	if (
		current.providerDisputeReference !== undefined &&
		current.providerDisputeReference !== input.providerDisputeReference
	) {
		throw new PaymentAggregateError(
			"IMMUTABLE_IDENTITY",
			"A dispute projection cannot switch provider references.",
		);
	}
	const rank = { none: 0, open: 1, won: 2, lost: 2, reversed: 3 } as const;
	if (
		rank[input.state] < rank[current.state] ||
		(rank[input.state] === rank[current.state] &&
			current.state !== input.state) ||
		(current.occurredAt !== undefined && input.occurredAt < current.occurredAt)
	) {
		throw new PaymentAggregateError(
			"DISPUTE_REGRESSION",
			"A provider dispute event cannot regress confirmed dispute state.",
		);
	}
	const disputeRevision = checkedAdd(
		current.revision,
		1,
		"STORED_STATE_INVALID",
		"Dispute revision exceeds safe integer bounds.",
	);
	const revision = checkedAdd(
		payment.revision,
		1,
		"STORED_STATE_INVALID",
		"Payment revision exceeds safe integer bounds.",
	);
	const dispute = paymentDisputeProjectionSchema.parse({
		state: input.state,
		providerDisputeReference: input.providerDisputeReference,
		lastEventId: input.eventId,
		lastEventDigest: input.eventDigest,
		occurredAt: input.occurredAt,
		revision: disputeRevision,
	});
	const updated = paymentAggregateSchema.parse({
		...payment,
		dispute,
		revision,
		updatedAt: latestDate(payment.updatedAt, input.occurredAt),
	});
	const fact = storedDisputeFactSchema.parse({
		id: factId,
		paymentId: input.paymentId,
		connectionId: input.connectionId,
		eventId: input.eventId,
		eventDigest: input.eventDigest,
		providerDisputeReference: input.providerDisputeReference,
		state: input.state,
		occurredAt: input.occurredAt,
		appliedRevision: revision,
	});
	await transaction.upsert("paymentV2", updated.id, updated);
	await transaction.upsert("paymentDisputeFactV2", fact.id, fact);
	await transaction.emit(paymentTransitionConfirmedV1, {
		aggregate: { type: "payment", id: updated.id },
		occurredAt: input.occurredAt,
		payload: transitionEventPayload(updated, {
			type: "dispute",
			eventId: input.eventId,
			providerDisputeReference: input.providerDisputeReference,
			state: input.state,
		}),
	});
	return { payment: updated, replayed: false };
}

export function createPaymentAggregateStore(
	data: ModuleDataService,
	transactions: ModuleTransactionRunner | undefined,
): PaymentAggregateStore {
	async function transact<T>(
		work: (transaction: LockingModuleDataTransaction) => Promise<T>,
	): Promise<T> {
		if (!transactions) {
			throw new PaymentAggregateError(
				"TRANSACTION_UNAVAILABLE",
				"Payment writes require owner-local transactions.",
			);
		}
		return transactions.transaction((transaction) => {
			if (!isLockingTransaction(transaction)) {
				throw new PaymentAggregateError(
					"LOCKING_UNAVAILABLE",
					"Payment writes require owner-local row locking.",
				);
			}
			return work(transaction);
		});
	}

	return {
		async create(inputValue) {
			const parsed = createPaymentAggregateInputSchema.safeParse(inputValue);
			if (!parsed.success) {
				throw new PaymentAggregateError(
					"INPUT_INVALID",
					"The Payment creation input is invalid.",
				);
			}
			const input = parsed.data;
			const creationDigest = await sha256(
				canonicalJson({ version: 1, ...input }),
			);
			return transact(async (transaction) => {
				const existing = await lockPayment(transaction, input.paymentId);
				if (existing) {
					if (
						existing.creationIdempotencyKey !== input.idempotencyKey ||
						existing.creationDigest !== creationDigest
					) {
						throw new PaymentAggregateError(
							"PAYMENT_CONFLICT",
							"The Payment already exists with different immutable input.",
						);
					}
					return { payment: existing, replayed: true };
				}
				const now = new Date();
				const payment = paymentAggregateSchema.parse({
					id: input.paymentId,
					modelVersion: 2,
					checkoutId: input.checkoutId,
					...(input.orderId ? { orderId: input.orderId } : {}),
					connectionId: input.connectionId,
					paymentOption: input.paymentOption,
					expectedAmount: input.expectedAmount,
					eligibleMerchandiseAmount: input.eligibleMerchandiseAmount,
					currency: input.currency,
					authorizedAmount: 0,
					capturedAmount: 0,
					voidedAmount: 0,
					confirmedRefundedAmount: 0,
					providerReferences: [],
					dispute: { state: "none", revision: 0 },
					state: "pending",
					terminalState: "none",
					creationIdempotencyKey: input.idempotencyKey,
					creationDigest,
					creationDigestVersion: 1,
					revision: 1,
					createdAt: now,
					updatedAt: now,
				});
				await transaction.upsert("paymentV2", payment.id, payment);
				return { payment, replayed: false };
			});
		},

		async bindOrder(paymentIdValue, orderIdValue) {
			const paymentId = identifierSchema.parse(paymentIdValue);
			const orderId = identifierSchema.parse(orderIdValue);
			return transact(async (transaction) => {
				const payment = requirePayment(
					await lockPayment(transaction, paymentId),
				);
				if (payment.orderId === orderId) return payment;
				if (payment.orderId !== undefined) {
					throw new PaymentAggregateError(
						"IMMUTABLE_IDENTITY",
						"A Payment cannot be rebound to another Order.",
					);
				}
				const revision = checkedAdd(
					payment.revision,
					1,
					"STORED_STATE_INVALID",
					"Payment revision exceeds safe integer bounds.",
				);
				const updated = paymentAggregateSchema.parse({
					...payment,
					orderId,
					revision,
					updatedAt: new Date(),
				});
				await transaction.upsert("paymentV2", payment.id, updated);
				return updated;
			});
		},

		async get(paymentIdValue) {
			const row = await data.get(
				"paymentV2",
				identifierSchema.parse(paymentIdValue),
			);
			return row ? requirePayment(row) : null;
		},

		async recordConfirmedOperation(inputValue) {
			return transact((transaction) =>
				recordConfirmedPaymentOperationLocked(transaction, inputValue),
			);
		},

		async applyDispute(inputValue) {
			const parsed = applyPaymentDisputeInputSchema.safeParse(inputValue);
			if (!parsed.success) {
				throw new PaymentAggregateError(
					"INPUT_INVALID",
					"The Payment dispute input is invalid.",
				);
			}
			return transact((transaction) =>
				applyDisputeLocked(transaction, parsed.data),
			);
		},
	};
}
