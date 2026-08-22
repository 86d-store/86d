import type {
	LockingModuleDataTransaction,
	ModuleDataTransaction,
	ModuleTransactionRunner,
} from "@86d-app/core/durable-events";
import type {
	ModuleController,
	ModuleDataService,
} from "@86d-app/core/types/module";
import { z } from "zod";
import type { PaymentAggregateStore } from "./payment-service";

const identifierSchema = z.string().trim().min(1).max(255);
const providerSchema = z
	.string()
	.trim()
	.min(1)
	.max(100)
	.regex(/^[a-z][a-z0-9_-]*$/);
const providerReferenceSchema = z.string().trim().min(1).max(500);
const eventTypeSchema = z.string().trim().min(1).max(200);
const secretReferenceSchema = z.string().trim().min(3).max(500);
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const currencySchema = z.string().regex(/^[A-Z]{3}$/);
const positiveMinorAmountSchema = z
	.number()
	.int()
	.positive()
	.max(Number.MAX_SAFE_INTEGER);
const dateSchema = z.coerce.date();

const confirmedOperationFactSchema = z
	.object({
		kind: z.literal("confirmed_operation"),
		paymentId: identifierSchema,
		operationId: identifierSchema,
		operation: z.enum(["intent", "authorization", "capture", "refund", "void"]),
		sourceOperationId: identifierSchema.optional(),
		amount: positiveMinorAmountSchema.optional(),
		currency: currencySchema.optional(),
		requestDigest: digestSchema,
		providerReference: providerReferenceSchema,
		occurredAt: dateSchema,
	})
	.strict()
	.superRefine((fact, context) => {
		const requiresSource = ["capture", "refund", "void"].includes(
			fact.operation,
		);
		if (
			(requiresSource && fact.sourceOperationId === undefined) ||
			(fact.operation === "intent" && fact.sourceOperationId !== undefined)
		) {
			context.addIssue({
				code: "custom",
				message:
					"The normalized provider fact has an invalid source operation.",
				path: ["sourceOperationId"],
			});
		}
		if (fact.operation === "void") {
			if (fact.amount !== undefined || fact.currency !== undefined) {
				context.addIssue({
					code: "custom",
					message: "A void derives money from its exact authorization.",
				});
			}
		} else if (fact.amount === undefined || fact.currency === undefined) {
			context.addIssue({
				code: "custom",
				message: "The normalized provider fact requires amount and currency.",
			});
		}
	});

const disputeFactSchema = z
	.object({
		kind: z.literal("dispute"),
		paymentId: identifierSchema,
		providerDisputeReference: providerReferenceSchema,
		state: z.enum(["open", "won", "lost", "reversed"]),
		occurredAt: dateSchema,
	})
	.strict();

const reconciliationRequiredFactSchema = z
	.object({
		kind: z.literal("reconciliation_required"),
		paymentId: identifierSchema,
		providerReference: providerReferenceSchema.optional(),
		reason: z.string().trim().min(1).max(500),
		occurredAt: dateSchema,
	})
	.strict();

export const paymentWebhookNormalizedFactSchema = z.discriminatedUnion("kind", [
	confirmedOperationFactSchema,
	disputeFactSchema,
	reconciliationRequiredFactSchema,
]);

export const recordVerifiedPaymentWebhookInputSchema = z
	.object({
		storeId: identifierSchema,
		connectionId: identifierSchema,
		provider: providerSchema,
		providerEventId: providerReferenceSchema,
		providerEventType: eventTypeSchema,
		payloadDigest: digestSchema,
		/** Opaque locator for the server-side key used before this call. */
		verificationKeyReference: secretReferenceSchema,
		fact: paymentWebhookNormalizedFactSchema,
	})
	.strict();

export const paymentWebhookReceiptSchema = z
	.object({
		id: identifierSchema,
		modelVersion: z.literal(2),
		storeId: identifierSchema,
		connectionId: identifierSchema,
		provider: providerSchema,
		providerEventId: providerReferenceSchema,
		providerEventType: eventTypeSchema,
		payloadDigest: digestSchema,
		verificationKeyReference: secretReferenceSchema,
		fact: paymentWebhookNormalizedFactSchema,
		state: z.enum([
			"verified",
			"processing",
			"applied",
			"rejected",
			"needs_attention",
		]),
		processingAttempts: z
			.number()
			.int()
			.nonnegative()
			.max(Number.MAX_SAFE_INTEGER),
		revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
		leaseExpiresAt: dateSchema.optional(),
		finalDisposition: z.string().trim().min(1).max(200).optional(),
		lastFailureCode: z.string().trim().min(1).max(200).optional(),
		verifiedAt: dateSchema,
		appliedAt: dateSchema.optional(),
		createdAt: dateSchema,
		updatedAt: dateSchema,
	})
	.strict();

export type RecordVerifiedPaymentWebhookInput = z.infer<
	typeof recordVerifiedPaymentWebhookInputSchema
>;
export type PaymentWebhookReceipt = z.infer<typeof paymentWebhookReceiptSchema>;

export type PaymentWebhookReceiptErrorCode =
	| "connection_mismatch"
	| "input_invalid"
	| "locking_unavailable"
	| "receipt_conflict"
	| "receipt_not_found"
	| "stored_state_invalid"
	| "transaction_unavailable";

export class PaymentWebhookReceiptError extends Error {
	readonly code: PaymentWebhookReceiptErrorCode;

	constructor(code: PaymentWebhookReceiptErrorCode, message: string) {
		super(message);
		this.name = "PaymentWebhookReceiptError";
		this.code = code;
	}
}

export interface PaymentWebhookReceiptStore extends ModuleController {
	recordVerified(input: RecordVerifiedPaymentWebhookInput): Promise<{
		receipt: PaymentWebhookReceipt;
		replayed: boolean;
	}>;
	process(id: string): Promise<{
		receipt: PaymentWebhookReceipt;
		acknowledge: boolean;
		retryable: boolean;
		replayed: boolean;
	}>;
	get(id: string): Promise<PaymentWebhookReceipt | null>;
}

const PROCESSING_LEASE_MS = 2 * 60 * 1_000;

function isLockingTransaction(
	transaction: ModuleDataTransaction,
): transaction is LockingModuleDataTransaction {
	return (
		"getForUpdate" in transaction &&
		typeof transaction.getForUpdate === "function"
	);
}

function requireReceipt(
	row: Record<string, unknown> | null,
): PaymentWebhookReceipt {
	if (!row) {
		throw new PaymentWebhookReceiptError(
			"receipt_not_found",
			"Payment webhook receipt not found.",
		);
	}
	const parsed = paymentWebhookReceiptSchema.safeParse(row);
	if (!parsed.success) {
		throw new PaymentWebhookReceiptError(
			"stored_state_invalid",
			"The stored Payment webhook receipt is invalid.",
		);
	}
	return parsed.data;
}

function stableValue(value: unknown): string {
	if (value instanceof Date) return JSON.stringify(value.toISOString());
	if (value === null || typeof value !== "object") {
		return JSON.stringify(value) ?? "null";
	}
	if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`;
	const record = value as Record<string, unknown>;
	return `{${Object.keys(record)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${stableValue(record[key])}`)
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

function safeIncrement(value: number): number {
	const next = value + 1;
	if (!Number.isSafeInteger(next)) {
		throw new PaymentWebhookReceiptError(
			"stored_state_invalid",
			"Payment webhook receipt counter exceeds safe integer bounds.",
		);
	}
	return next;
}

function sameImmutableReceipt(
	receipt: PaymentWebhookReceipt,
	input: RecordVerifiedPaymentWebhookInput,
): boolean {
	return (
		receipt.storeId === input.storeId &&
		receipt.connectionId === input.connectionId &&
		receipt.provider === input.provider &&
		receipt.providerEventId === input.providerEventId &&
		receipt.providerEventType === input.providerEventType &&
		receipt.payloadDigest === input.payloadDigest &&
		receipt.verificationKeyReference === input.verificationKeyReference &&
		stableValue(receipt.fact) === stableValue(input.fact)
	);
}

async function lockReceipt(
	transaction: LockingModuleDataTransaction,
	id: string,
): Promise<PaymentWebhookReceipt | null> {
	const lockId = `payment-webhook-receipt-v2:${id}`;
	await transaction.upsert("paymentWebhookReceiptLockV2", lockId, {
		id: lockId,
	});
	const lock = await transaction.getForUpdate(
		"paymentWebhookReceiptLockV2",
		lockId,
	);
	if (!lock) {
		throw new PaymentWebhookReceiptError(
			"locking_unavailable",
			"Payment webhook receipt could not acquire its owner-local lock.",
		);
	}
	const row = await transaction.getForUpdate("paymentWebhookReceiptV2", id);
	return row ? requireReceipt(row) : null;
}

function failureCode(error: unknown): string {
	if (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		typeof error.code === "string"
	) {
		return error.code.slice(0, 200);
	}
	return "local_application_failed";
}

/**
 * Durable post-verification ingress for Payment-owner facts.
 *
 * Provider modules must verify the exact raw bytes and resolve the immutable
 * Connection before calling `recordVerified`. Raw payloads and secrets are not
 * accepted. Provider network reconciliation remains outside receipt
 * transactions; ambiguous/out-of-order events persist a
 * `reconciliation_required` fact and intentionally remain unacknowledged.
 */
export function createPaymentWebhookReceiptStore(
	data: ModuleDataService,
	transactions: ModuleTransactionRunner | undefined,
	payments: PaymentAggregateStore,
): PaymentWebhookReceiptStore {
	async function transact<T>(
		work: (transaction: LockingModuleDataTransaction) => Promise<T>,
	): Promise<T> {
		if (!transactions) {
			throw new PaymentWebhookReceiptError(
				"transaction_unavailable",
				"Payment webhook writes require owner-local transactions.",
			);
		}
		return transactions.transaction((transaction) => {
			if (!isLockingTransaction(transaction)) {
				throw new PaymentWebhookReceiptError(
					"locking_unavailable",
					"Payment webhook writes require owner-local row locking.",
				);
			}
			return work(transaction);
		});
	}

	async function finalize(
		id: string,
		state: "applied" | "needs_attention",
		options: { failureCode?: string | undefined },
	): Promise<PaymentWebhookReceipt> {
		return transact(async (transaction) => {
			const receipt = requireReceipt(await lockReceipt(transaction, id));
			if (receipt.state === "applied") return receipt;
			const now = new Date();
			const updated = paymentWebhookReceiptSchema.parse({
				...receipt,
				state,
				revision: safeIncrement(receipt.revision),
				leaseExpiresAt: undefined,
				finalDisposition:
					state === "applied"
						? "applied_to_payment_owner"
						: "local_application_incomplete",
				...(options.failureCode
					? { lastFailureCode: options.failureCode }
					: { lastFailureCode: undefined }),
				...(state === "applied" ? { appliedAt: now } : {}),
				updatedAt: now,
			});
			await transaction.upsert("paymentWebhookReceiptV2", id, updated);
			return updated;
		});
	}

	return {
		async recordVerified(inputValue) {
			const parsed =
				recordVerifiedPaymentWebhookInputSchema.safeParse(inputValue);
			if (!parsed.success) {
				throw new PaymentWebhookReceiptError(
					"input_invalid",
					"The verified Payment webhook input is invalid.",
				);
			}
			const input = parsed.data;
			const identity = await sha256(
				`payment-webhook-receipt:v2:${input.storeId}:${input.connectionId}:${input.provider}:${input.providerEventId}`,
			);
			const id = `payment_webhook_${identity}`;
			return transact(async (transaction) => {
				const existing = await lockReceipt(transaction, id);
				if (existing) {
					if (!sameImmutableReceipt(existing, input)) {
						throw new PaymentWebhookReceiptError(
							"receipt_conflict",
							"The provider event ID already has different immutable facts.",
						);
					}
					return { receipt: existing, replayed: true };
				}
				const connection = await transaction.getForUpdate(
					"paymentConnection",
					input.connectionId,
				);
				if (
					!connection ||
					connection.id !== input.connectionId ||
					connection.provider !== input.provider
				) {
					throw new PaymentWebhookReceiptError(
						"connection_mismatch",
						"The verified provider event does not match its exact Connection.",
					);
				}
				const now = new Date();
				const receipt = paymentWebhookReceiptSchema.parse({
					id,
					modelVersion: 2,
					...input,
					state: "verified",
					processingAttempts: 0,
					revision: 1,
					verifiedAt: now,
					createdAt: now,
					updatedAt: now,
				});
				await transaction.upsert("paymentWebhookReceiptV2", id, receipt);
				return { receipt, replayed: false };
			});
		},

		async process(idValue) {
			const id = identifierSchema.parse(idValue);
			const claim = await transact(async (transaction) => {
				const receipt = requireReceipt(await lockReceipt(transaction, id));
				if (receipt.state === "applied") {
					return { kind: "applied" as const, receipt };
				}
				const now = new Date();
				if (
					receipt.state === "processing" &&
					receipt.leaseExpiresAt !== undefined &&
					receipt.leaseExpiresAt > now
				) {
					return { kind: "busy" as const, receipt };
				}
				const claimed = paymentWebhookReceiptSchema.parse({
					...receipt,
					state: "processing",
					processingAttempts: safeIncrement(receipt.processingAttempts),
					revision: safeIncrement(receipt.revision),
					leaseExpiresAt: new Date(now.getTime() + PROCESSING_LEASE_MS),
					finalDisposition: undefined,
					lastFailureCode: undefined,
					updatedAt: now,
				});
				await transaction.upsert("paymentWebhookReceiptV2", id, claimed);
				return { kind: "claimed" as const, receipt: claimed };
			});

			if (claim.kind === "applied") {
				return {
					receipt: claim.receipt,
					acknowledge: true,
					retryable: false,
					replayed: true,
				};
			}
			if (claim.kind === "busy") {
				return {
					receipt: claim.receipt,
					acknowledge: false,
					retryable: true,
					replayed: true,
				};
			}

			try {
				const { receipt } = claim;
				switch (receipt.fact.kind) {
					case "confirmed_operation":
						await payments.recordConfirmedOperation({
							paymentId: receipt.fact.paymentId,
							connectionId: receipt.connectionId,
							operationId: receipt.fact.operationId,
							operation: receipt.fact.operation,
							...(receipt.fact.sourceOperationId
								? { sourceOperationId: receipt.fact.sourceOperationId }
								: {}),
							...(receipt.fact.amount === undefined
								? {}
								: { amount: receipt.fact.amount }),
							...(receipt.fact.currency === undefined
								? {}
								: { currency: receipt.fact.currency }),
							requestDigest: receipt.fact.requestDigest,
							providerReference: receipt.fact.providerReference,
							confirmedAt: receipt.fact.occurredAt,
						});
						break;
					case "dispute":
						await payments.applyDispute({
							paymentId: receipt.fact.paymentId,
							connectionId: receipt.connectionId,
							eventId: receipt.providerEventId,
							eventDigest: receipt.payloadDigest,
							providerDisputeReference: receipt.fact.providerDisputeReference,
							state: receipt.fact.state,
							occurredAt: receipt.fact.occurredAt,
						});
						break;
					case "reconciliation_required":
						throw new PaymentWebhookReceiptError(
							"stored_state_invalid",
							receipt.fact.reason,
						);
				}
				const applied = await finalize(id, "applied", {});
				return {
					receipt: applied,
					acknowledge: true,
					retryable: false,
					replayed: false,
				};
			} catch (error) {
				const incomplete = await finalize(id, "needs_attention", {
					failureCode: failureCode(error),
				});
				return {
					receipt: incomplete,
					acknowledge: false,
					retryable: true,
					replayed: false,
				};
			}
		},

		async get(idValue) {
			const row = await data.get(
				"paymentWebhookReceiptV2",
				identifierSchema.parse(idValue),
			);
			return row ? requireReceipt(row) : null;
		},
	};
}
