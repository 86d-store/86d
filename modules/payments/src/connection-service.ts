import { type JsonValue, jsonValueSchema } from "@86d-app/core/commands";
import type {
	LockingModuleDataTransaction,
	ModuleDataTransaction,
	ModuleTransactionRunner,
} from "@86d-app/core/durable-events";
import type {
	PaymentConnectionCapability,
	PaymentConnectionProvider,
	PaymentProviderOperationSource,
} from "@86d-app/core/payment-connection-provider";
import type {
	ModuleController,
	ModuleDataService,
} from "@86d-app/core/types/module";
import { z } from "@86d-app/core/zod";
import {
	assertPaymentOperationClaimableLocked,
	PaymentAggregateError,
	type PendingPaymentOperationClaim,
	recordConfirmedPaymentOperationLocked,
} from "./payment-service";

const identifierSchema = z.string().trim().min(1).max(255);
const connectionNameSchema = z.string().trim().min(1).max(100);
const providerNameSchema = z
	.string()
	.trim()
	.min(1)
	.max(100)
	.regex(/^[a-z][a-z0-9_-]*$/);
const secretReferenceSchema = z.string().trim().min(3).max(500);
const idempotencyKeySchema = z.string().trim().min(8).max(108);
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const currencySchema = z.string().regex(/^[A-Z]{3}$/);
const minorAmountSchema = z
	.number()
	.int()
	.positive()
	.max(Number.MAX_SAFE_INTEGER);
const providerReferenceSchema = z.string().min(1).max(500);
const providerAccountIdSchema = z.string().trim().min(1).max(255);

export const paymentConnectionCapabilitySchema = z.enum([
	"intent",
	"authorization",
	"capture",
	"refund",
	"void",
]);
export const paymentConnectionModeSchema = z.enum(["test", "live"]);
export const paymentConnectionHealthSchema = z.enum([
	"unknown",
	"healthy",
	"degraded",
	"unhealthy",
]);
export const paymentConnectionLifecycleSchema = z.enum([
	"draft",
	"enabled",
	"disabled",
	"revoked",
]);
export const paymentOperationStateSchema = z.enum([
	"pending",
	"requires_action",
	"running",
	"succeeded",
	"failed",
	"ambiguous",
	"needs_attention",
	"dead_letter",
]);

export const paymentReconciliationTriggerSchema = z.enum([
	"scheduled",
	"manual",
]);

export const PAYMENT_OPERATION_STALE_AFTER_MS = 5 * 60 * 1_000;
export const PAYMENT_RECONCILIATION_BACKOFF_MS = [
	1_000, 5_000, 30_000,
] as const;
export const PAYMENT_PENDING_RECONCILIATION_BACKOFF_MS = [
	30_000,
	2 * 60 * 1_000,
	10 * 60 * 1_000,
	30 * 60 * 1_000,
	2 * 60 * 60 * 1_000,
	6 * 60 * 60 * 1_000,
] as const;
export const PAYMENT_REQUIRES_ACTION_RECONCILIATION_BACKOFF_MS = [
	15 * 60 * 1_000,
	60 * 60 * 1_000,
	6 * 60 * 60 * 1_000,
	24 * 60 * 60 * 1_000,
] as const;
export const PAYMENT_MAX_AUTOMATIC_RECONCILIATIONS =
	PAYMENT_RECONCILIATION_BACKOFF_MS.length;

const dateSchema = z.coerce.date();

export const paymentConnectionSchema = z
	.object({
		id: identifierSchema,
		providerAccountId: providerAccountIdSchema,
		name: connectionNameSchema,
		normalizedName: z.string().min(1).max(100),
		provider: providerNameSchema,
		mode: paymentConnectionModeSchema,
		capabilities: z
			.array(paymentConnectionCapabilitySchema)
			.min(1)
			.max(5)
			.refine((values) => new Set(values).size === values.length),
		health: paymentConnectionHealthSchema,
		lifecycle: paymentConnectionLifecycleSchema,
		secretReference: secretReferenceSchema,
		healthCheckedAt: dateSchema.optional(),
		enabledAt: dateSchema.optional(),
		disabledAt: dateSchema.optional(),
		revokedAt: dateSchema.optional(),
		createdAt: dateSchema,
		updatedAt: dateSchema,
	})
	.strict();

export type PaymentConnection = z.infer<typeof paymentConnectionSchema>;
export type PaymentConnectionHealth = z.infer<
	typeof paymentConnectionHealthSchema
>;
export type PaymentConnectionLifecycle = z.infer<
	typeof paymentConnectionLifecycleSchema
>;

export const paymentOperationPayloadSchema = z.discriminatedUnion("operation", [
	z
		.object({
			operation: z.literal("intent"),
			amount: minorAmountSchema,
			currency: currencySchema,
			metadata: jsonValueSchema.optional(),
		})
		.strict(),
	z
		.object({
			operation: z.literal("authorization"),
			amount: minorAmountSchema,
			currency: currencySchema,
			providerPaymentReference: providerReferenceSchema.optional(),
			metadata: jsonValueSchema.optional(),
		})
		.strict(),
	z
		.object({
			operation: z.literal("capture"),
			amount: minorAmountSchema,
			currency: currencySchema,
			providerPaymentReference: providerReferenceSchema,
			metadata: jsonValueSchema.optional(),
		})
		.strict(),
	z
		.object({
			operation: z.literal("refund"),
			amount: minorAmountSchema,
			currency: currencySchema,
			providerPaymentReference: providerReferenceSchema,
			reason: z.string().trim().min(1).max(500).optional(),
			metadata: jsonValueSchema.optional(),
		})
		.strict(),
	z
		.object({
			operation: z.literal("void"),
			providerPaymentReference: providerReferenceSchema,
			metadata: jsonValueSchema.optional(),
		})
		.strict(),
]);

const directAuthorizationPayloadSchema = z
	.object({
		operation: z.literal("authorization"),
		amount: minorAmountSchema,
		currency: currencySchema,
		metadata: jsonValueSchema.optional(),
	})
	.strict();
const referencedAuthorizationPayloadSchema = z
	.object({
		operation: z.literal("authorization"),
		amount: minorAmountSchema,
		currency: currencySchema,
		providerPaymentReference: providerReferenceSchema,
		metadata: jsonValueSchema.optional(),
	})
	.strict();
const primaryOperationPayloadSchema = z.discriminatedUnion("operation", [
	paymentOperationPayloadSchema.options[0],
	directAuthorizationPayloadSchema,
]);
const continuationOperationPayloadSchema = z.discriminatedUnion("operation", [
	referencedAuthorizationPayloadSchema,
	paymentOperationPayloadSchema.options[2],
	paymentOperationPayloadSchema.options[3],
	paymentOperationPayloadSchema.options[4],
]);

export const paymentOperationExecutionInputSchema = z.union([
	z
		.object({
			paymentId: identifierSchema,
			connectionId: identifierSchema,
			idempotencyKey: idempotencyKeySchema,
			payload: primaryOperationPayloadSchema,
		})
		.strict(),
	z
		.object({
			paymentId: identifierSchema,
			sourceOperationId: identifierSchema,
			idempotencyKey: idempotencyKeySchema,
			payload: continuationOperationPayloadSchema,
		})
		.strict(),
]);

export type PaymentOperationExecutionInput = z.infer<
	typeof paymentOperationExecutionInputSchema
>;

export const paymentOperationSchema = z
	.object({
		id: identifierSchema,
		modelVersion: z.literal(2).default(2),
		paymentId: identifierSchema,
		connectionId: identifierSchema,
		sourceOperationId: identifierSchema.optional(),
		operation: paymentConnectionCapabilitySchema,
		idempotencyKey: idempotencyKeySchema,
		requestDigest: digestSchema,
		payload: paymentOperationPayloadSchema,
		requestDigestVersion: z.literal(1),
		state: paymentOperationStateSchema,
		revision: z
			.number()
			.int()
			.positive()
			.max(Number.MAX_SAFE_INTEGER)
			.default(1),
		attempt: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
		reconciliationAttempts: z
			.number()
			.int()
			.nonnegative()
			.max(Number.MAX_SAFE_INTEGER)
			.default(0),
		manualReconciliationCount: z
			.number()
			.int()
			.nonnegative()
			.max(Number.MAX_SAFE_INTEGER)
			.default(0),
		providerReference: providerReferenceSchema.optional(),
		outcome: jsonValueSchema.optional(),
		needsAttentionReason: z.string().min(1).max(500).optional(),
		needsAttentionAt: dateSchema.optional(),
		leaseExpiresAt: dateSchema.optional(),
		nextReconciliationAt: dateSchema.optional(),
		lastReconciliationAt: dateSchema.optional(),
		lastReconciliationTrigger: paymentReconciliationTriggerSchema.optional(),
		lastManualReconciliationReason: z.string().min(1).max(500).optional(),
		lastManualReconciliationAt: dateSchema.optional(),
		deadLetteredAt: dateSchema.optional(),
		completedAt: dateSchema.optional(),
		createdAt: dateSchema,
		updatedAt: dateSchema,
	})
	.strict()
	.superRefine((operation, context) => {
		if (operation.operation !== operation.payload.operation) {
			context.addIssue({
				code: "custom",
				message: "Stored Payment operation and payload kinds must match.",
				path: ["payload", "operation"],
			});
		}
		const requiresSource = ["capture", "refund", "void"].includes(
			operation.operation,
		);
		const prohibitsSource = operation.operation === "intent";
		const referencedAuthorization =
			operation.payload.operation === "authorization" &&
			operation.payload.providerPaymentReference !== undefined;
		if (
			(requiresSource && operation.sourceOperationId === undefined) ||
			(prohibitsSource && operation.sourceOperationId !== undefined) ||
			(operation.operation === "authorization" &&
				referencedAuthorization !== (operation.sourceOperationId !== undefined))
		) {
			context.addIssue({
				code: "custom",
				message: "Stored Payment continuation identity is invalid.",
				path: ["sourceOperationId"],
			});
		}
	});

export type PaymentOperation = z.infer<typeof paymentOperationSchema>;

export const paymentOperationAttemptSchema = z
	.object({
		id: identifierSchema,
		paymentOperationId: identifierSchema,
		connectionId: identifierSchema,
		attempt: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
		idempotencyKey: idempotencyKeySchema,
		requestDigest: digestSchema,
		trigger: z
			.enum(["initial", "scheduled_reconciliation", "manual_reconciliation"])
			.default("initial"),
		triggerReason: z.string().min(1).max(500).optional(),
		state: z.enum([
			"running",
			"pending",
			"requires_action",
			"succeeded",
			"failed",
			"ambiguous",
		]),
		providerReference: providerReferenceSchema.optional(),
		outcome: jsonValueSchema.optional(),
		startedAt: dateSchema,
		finishedAt: dateSchema.optional(),
	})
	.strict();

export type PaymentOperationAttempt = z.infer<
	typeof paymentOperationAttemptSchema
>;

export const paymentOperationReconciliationOptionsSchema = z
	.object({
		trigger: paymentReconciliationTriggerSchema.default("manual"),
		reason: z.string().trim().min(1).max(500).optional(),
	})
	.strict()
	.default({ trigger: "manual", reason: "manual_reconciliation_requested" })
	.transform((options) => ({
		...options,
		...(options.trigger === "manual" && options.reason === undefined
			? { reason: "manual_reconciliation_requested" }
			: {}),
	}));

export type PaymentOperationReconciliationOptions = z.input<
	typeof paymentOperationReconciliationOptionsSchema
>;

export const createPaymentConnectionInputSchema = z
	.object({
		id: identifierSchema.optional(),
		providerAccountId: providerAccountIdSchema,
		name: connectionNameSchema,
		provider: providerNameSchema,
		mode: paymentConnectionModeSchema,
		capabilities: z
			.array(paymentConnectionCapabilitySchema)
			.min(1)
			.max(5)
			.refine((values) => new Set(values).size === values.length),
		secretReference: secretReferenceSchema,
	})
	.strict();

export type CreatePaymentConnectionInput = z.infer<
	typeof createPaymentConnectionInputSchema
>;

const providerOutcomeSchema = z
	.object({
		state: z.enum([
			"succeeded",
			"failed",
			"pending",
			"requires_action",
			"ambiguous",
		]),
		providerReference: providerReferenceSchema.optional(),
		result: jsonValueSchema.optional(),
	})
	.strict()
	.superRefine((outcome, context) => {
		if (
			["pending", "requires_action"].includes(outcome.state) &&
			outcome.providerReference === undefined
		) {
			context.addIssue({
				code: "custom",
				message:
					"A provider-known nonfinal outcome requires an immutable provider reference.",
				path: ["providerReference"],
			});
		}
	});

export type PaymentConnectionErrorCode =
	| "connection_name_conflict"
	| "connection_not_found"
	| "connection_not_usable"
	| "connection_revoked"
	| "idempotency_conflict"
	| "invalid_operation_state"
	| "operation_not_found"
	| "provider_not_bound"
	| "reconciliation_not_due"
	| "transaction_unavailable";

export class PaymentConnectionError extends Error {
	readonly code: PaymentConnectionErrorCode;

	constructor(code: PaymentConnectionErrorCode, message: string) {
		super(message);
		this.code = code;
		this.name = "PaymentConnectionError";
	}
}

export interface PaymentConnectionController extends ModuleController {
	createConnection(
		input: CreatePaymentConnectionInput,
	): Promise<PaymentConnection>;
	getConnection(id: string): Promise<PaymentConnection | null>;
	listConnections(): Promise<PaymentConnection[]>;
	setConnectionHealth(
		id: string,
		health: PaymentConnectionHealth,
	): Promise<PaymentConnection>;
	enableConnection(id: string): Promise<PaymentConnection>;
	disableConnection(id: string): Promise<PaymentConnection>;
	revokeConnection(id: string): Promise<PaymentConnection>;
	rotateSecretReference(
		id: string,
		secretReference: string,
	): Promise<PaymentConnection>;
	executeOperation(
		input: PaymentOperationExecutionInput,
	): Promise<PaymentOperation>;
	reconcileOperation(
		id: string,
		options?: PaymentOperationReconciliationOptions,
	): Promise<PaymentOperation>;
	markOperationNeedsAttention(
		id: string,
		reason: string,
	): Promise<PaymentOperation>;
	getOperation(id: string): Promise<PaymentOperation | null>;
	listOperationAttempts(id: string): Promise<PaymentOperationAttempt[]>;
}

function isLockingTransaction(
	transaction: ModuleDataTransaction,
): transaction is LockingModuleDataTransaction {
	return (
		"getForUpdate" in transaction &&
		typeof transaction.getForUpdate === "function"
	);
}

function canonicalJson(value: JsonValue): string {
	if (value === null || typeof value !== "object") {
		return JSON.stringify(value) ?? "null";
	}
	if (Array.isArray(value)) {
		return `[${value.map(canonicalJson).join(",")}]`;
	}
	return `{${Object.keys(value)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key] ?? null)}`)
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

function safeIncrement(value: number, message: string): number {
	const next = value + 1;
	if (!Number.isSafeInteger(next)) {
		throw new PaymentConnectionError("invalid_operation_state", message);
	}
	return next;
}

type ScheduledNonfinalState = "ambiguous" | "pending" | "requires_action";

function reconciliationSchedule(state: ScheduledNonfinalState) {
	if (state === "pending") return PAYMENT_PENDING_RECONCILIATION_BACKOFF_MS;
	if (state === "requires_action") {
		return PAYMENT_REQUIRES_ACTION_RECONCILIATION_BACKOFF_MS;
	}
	return PAYMENT_RECONCILIATION_BACKOFF_MS;
}

function nextReconciliationAt(
	now: Date,
	reconciliationAttempts: number,
	state: ScheduledNonfinalState,
): Date {
	const schedule = reconciliationSchedule(state);
	const delayIndex = Math.min(reconciliationAttempts, schedule.length - 1);
	return new Date(now.getTime() + schedule[delayIndex]);
}

function isKnownNonfinalState(
	state: PaymentOperation["state"],
): state is "pending" | "requires_action" {
	return state === "pending" || state === "requires_action";
}

function isScheduledNonfinalState(
	state: PaymentOperation["state"],
): state is ScheduledNonfinalState {
	return state === "ambiguous" || isKnownNonfinalState(state);
}

function normalizeConnectionName(name: string): string {
	return name.normalize("NFKC").toLocaleLowerCase("en-US");
}

function requireConnection(
	row: Record<string, unknown> | null,
): PaymentConnection {
	if (!row) {
		throw new PaymentConnectionError(
			"connection_not_found",
			"Payment Connection not found.",
		);
	}
	return paymentConnectionSchema.parse(row);
}

function requireOperation(
	row: Record<string, unknown> | null,
): PaymentOperation {
	if (!row) {
		throw new PaymentConnectionError(
			"operation_not_found",
			"Payment operation not found.",
		);
	}
	return paymentOperationSchema.parse(row);
}

function operationRecord(
	operation: PaymentOperation,
	overrides: Partial<PaymentOperation>,
) {
	const revision = operation.revision + 1;
	if (!Number.isSafeInteger(revision)) {
		throw new PaymentConnectionError(
			"invalid_operation_state",
			"Payment operation revision exceeds safe integer bounds.",
		);
	}
	return paymentOperationSchema.parse({ ...operation, ...overrides, revision });
}

function connectionRecord(
	connection: PaymentConnection,
	overrides: Partial<PaymentConnection>,
) {
	return paymentConnectionSchema.parse({ ...connection, ...overrides });
}

export function createPaymentConnectionController(
	data: ModuleDataService,
	transactions: ModuleTransactionRunner | undefined,
	providers: readonly PaymentConnectionProvider[] = [],
): PaymentConnectionController {
	const providersByConnection = new Map<string, PaymentConnectionProvider>();
	for (const provider of providers) {
		identifierSchema.parse(provider.connectionId);
		providerAccountIdSchema.parse(provider.providerAccountId);
		providerNameSchema.parse(provider.provider);
		paymentConnectionModeSchema.parse(provider.mode);
		z.array(paymentConnectionCapabilitySchema)
			.min(1)
			.max(5)
			.parse(provider.capabilities);
		if (providersByConnection.has(provider.connectionId)) {
			throw new PaymentConnectionError(
				"provider_not_bound",
				`More than one provider adapter is bound to Payment Connection "${provider.connectionId}".`,
			);
		}
		providersByConnection.set(provider.connectionId, provider);
	}

	async function transact<T>(
		work: (transaction: LockingModuleDataTransaction) => Promise<T>,
	): Promise<T> {
		if (!transactions) {
			throw new PaymentConnectionError(
				"transaction_unavailable",
				"Payment Connection writes require owner-local transactions.",
			);
		}
		return transactions.transaction(async (transaction) => {
			if (!isLockingTransaction(transaction)) {
				throw new PaymentConnectionError(
					"transaction_unavailable",
					"Payment Connection writes require row locking.",
				);
			}
			return work(transaction);
		});
	}

	function providerFor(
		connection: PaymentConnection,
		capability: PaymentConnectionCapability,
	): PaymentConnectionProvider {
		const provider = providersByConnection.get(connection.id);
		if (
			!provider ||
			provider.providerAccountId !== connection.providerAccountId ||
			provider.provider !== connection.provider ||
			provider.mode !== connection.mode ||
			!provider.capabilities.includes(capability)
		) {
			throw new PaymentConnectionError(
				"provider_not_bound",
				"No matching provider adapter is bound to this Payment Connection.",
			);
		}
		return provider;
	}

	function requireUsable(
		connection: PaymentConnection,
		capability: PaymentConnectionCapability,
	): PaymentConnectionProvider {
		if (
			connection.lifecycle !== "enabled" ||
			connection.health !== "healthy" ||
			!connection.capabilities.includes(capability)
		) {
			throw new PaymentConnectionError(
				"connection_not_usable",
				"Payment Connection is not enabled and healthy for this operation.",
			);
		}
		return providerFor(connection, capability);
	}

	async function lock(
		transaction: LockingModuleDataTransaction,
		entityType: "paymentConnectionLockV2" | "paymentOperationLockV2",
		id: string,
	): Promise<void> {
		await transaction.upsert(entityType, id, { id });
		await transaction.getForUpdate(entityType, id);
	}

	async function resolveConnection(
		transaction: LockingModuleDataTransaction,
		input: PaymentOperationExecutionInput,
	): Promise<{
		connection: PaymentConnection | null;
		connectionId: string;
		sourceOperationId?: string | undefined;
	}> {
		if ("connectionId" in input) {
			const connection = requireConnection(
				await transaction.getForUpdate("paymentConnection", input.connectionId),
			);
			return { connection, connectionId: connection.id };
		}
		const source = requireOperation(
			await transaction.get("paymentOperationV2", input.sourceOperationId),
		);
		if (source.paymentId !== input.paymentId) {
			throw new PaymentConnectionError(
				"idempotency_conflict",
				"The source Payment operation belongs to another Payment.",
			);
		}
		if (
			source.state !== "succeeded" ||
			!source.providerReference ||
			input.payload.providerPaymentReference !== source.providerReference
		) {
			throw new PaymentConnectionError(
				"invalid_operation_state",
				"A continuation must use the succeeded source operation and its provider reference.",
			);
		}
		const validSource =
			(input.payload.operation === "authorization" &&
				source.operation === "intent") ||
			(input.payload.operation === "capture" &&
				source.operation === "authorization") ||
			(input.payload.operation === "refund" &&
				source.operation === "capture") ||
			(input.payload.operation === "void" &&
				source.operation === "authorization");
		if (!validSource) {
			throw new PaymentConnectionError(
				"invalid_operation_state",
				`A ${input.payload.operation} cannot continue a ${source.operation} operation.`,
			);
		}
		const connectionRow = await transaction.getForUpdate(
			"paymentConnection",
			source.connectionId,
		);
		return {
			connection: connectionRow
				? paymentConnectionSchema.parse(connectionRow)
				: null,
			connectionId: source.connectionId,
			sourceOperationId: source.id,
		};
	}

	async function claimOperation(
		input: PaymentOperationExecutionInput,
	): Promise<{
		operation: PaymentOperation;
		claimed: boolean;
	}> {
		const parsed = paymentOperationExecutionInputSchema.parse(input);
		const operationId = `payop_${await sha256(
			canonicalJson({
				paymentId: parsed.paymentId,
				operation: parsed.payload.operation,
				idempotencyKey: parsed.idempotencyKey,
			}),
		)}`;

		return transact(async (transaction) => {
			await lock(transaction, "paymentOperationLockV2", operationId);
			const existingRow = await transaction.getForUpdate(
				"paymentOperationV2",
				operationId,
			);
			const requestedSourceOperationId =
				"sourceOperationId" in parsed ? parsed.sourceOperationId : undefined;
			const requestedConnectionId =
				"connectionId" in parsed
					? parsed.connectionId
					: existingRow
						? paymentOperationSchema.parse(existingRow).connectionId
						: undefined;
			if (existingRow) {
				const existing = paymentOperationSchema.parse(existingRow);
				const replayDigestInput = jsonValueSchema.parse({
					requestDigestVersion: 1,
					idempotencyKey: parsed.idempotencyKey,
					paymentId: parsed.paymentId,
					connectionId: requestedConnectionId,
					sourceOperationId: requestedSourceOperationId ?? null,
					payload: parsed.payload,
				});
				const replayDigest = await sha256(canonicalJson(replayDigestInput));
				if (
					existing.paymentId !== parsed.paymentId ||
					existing.connectionId !== requestedConnectionId ||
					existing.sourceOperationId !== requestedSourceOperationId ||
					existing.operation !== parsed.payload.operation ||
					existing.idempotencyKey !== parsed.idempotencyKey ||
					existing.requestDigest !== replayDigest
				) {
					throw new PaymentConnectionError(
						"idempotency_conflict",
						"The Payment operation key was already used for a different request.",
					);
				}
				return { operation: existing, claimed: false };
			}

			const { connection, connectionId, sourceOperationId } =
				await resolveConnection(transaction, parsed);
			if ("connectionId" in parsed) {
				requireUsable(requireConnection(connection), parsed.payload.operation);
			}
			if (
				requestedConnectionId !== undefined &&
				requestedConnectionId !== connectionId
			) {
				throw new PaymentConnectionError(
					"idempotency_conflict",
					"The Payment operation cannot change its immutable Connection.",
				);
			}
			const requestDigestInput = jsonValueSchema.parse({
				requestDigestVersion: 1,
				idempotencyKey: parsed.idempotencyKey,
				paymentId: parsed.paymentId,
				connectionId,
				sourceOperationId: sourceOperationId ?? null,
				payload: parsed.payload,
			});
			const requestDigest = await sha256(canonicalJson(requestDigestInput));
			await assertPaymentOperationClaimableLocked(
				transaction,
				{
					paymentId: parsed.paymentId,
					connectionId,
					...(sourceOperationId ? { sourceOperationId } : {}),
					payload: parsed.payload,
				},
				async () => {
					const pendingRows = await transaction.findMany("paymentOperationV2", {
						where: { paymentId: parsed.paymentId },
					});
					return pendingRows
						.map((row) => paymentOperationSchema.parse(row))
						.filter(
							(candidate) =>
								candidate.id !== operationId &&
								[
									"pending",
									"requires_action",
									"running",
									"ambiguous",
									"needs_attention",
									"dead_letter",
								].includes(candidate.state),
						)
						.map(
							(candidate): PendingPaymentOperationClaim => ({
								operation: candidate.operation,
								...(candidate.sourceOperationId
									? { sourceOperationId: candidate.sourceOperationId }
									: {}),
								payload: candidate.payload,
							}),
						);
				},
			);

			const now = new Date();
			const attemptNumber = 1;
			const operation = paymentOperationSchema.parse({
				id: operationId,
				modelVersion: 2,
				paymentId: parsed.paymentId,
				connectionId,
				...(sourceOperationId ? { sourceOperationId } : {}),
				operation: parsed.payload.operation,
				idempotencyKey: parsed.idempotencyKey,
				requestDigest,
				payload: parsed.payload,
				requestDigestVersion: 1,
				createdAt: now,
				state: "running",
				revision: 1,
				attempt: attemptNumber,
				reconciliationAttempts: 0,
				manualReconciliationCount: 0,
				leaseExpiresAt: new Date(
					now.getTime() + PAYMENT_OPERATION_STALE_AFTER_MS,
				),
				updatedAt: now,
			});
			const attempt = paymentOperationAttemptSchema.parse({
				id: `${operationId}:${attemptNumber}`,
				paymentOperationId: operationId,
				connectionId,
				attempt: attemptNumber,
				idempotencyKey: parsed.idempotencyKey,
				requestDigest,
				trigger: "initial",
				state: "running",
				startedAt: now,
			});
			await transaction.upsert("paymentOperationV2", operationId, operation);
			await transaction.upsert(
				"paymentOperationAttemptV2",
				attempt.id,
				attempt,
			);
			return { operation, claimed: true };
		});
	}

	async function providerOperationSource(
		operation: PaymentOperation,
	): Promise<PaymentProviderOperationSource | undefined> {
		if (!operation.sourceOperationId) return undefined;
		const source = requireOperation(
			await data.get("paymentOperationV2", operation.sourceOperationId),
		);
		const sourcePayload = source.payload;
		const citedReference =
			"providerPaymentReference" in operation.payload
				? operation.payload.providerPaymentReference
				: undefined;
		if (
			source.paymentId !== operation.paymentId ||
			source.connectionId !== operation.connectionId ||
			source.state !== "succeeded" ||
			!source.providerReference ||
			citedReference !== source.providerReference ||
			!("amount" in sourcePayload) ||
			!("currency" in sourcePayload)
		) {
			throw new PaymentConnectionError(
				"invalid_operation_state",
				"The durable source operation cannot produce a provider continuation envelope.",
			);
		}
		return {
			operationId: source.id,
			operation: source.operation,
			providerReference: source.providerReference,
			amount: sourcePayload.amount,
			currency: sourcePayload.currency,
		};
	}

	async function recordOutcome(
		operationId: string,
		attemptNumber: number,
		outcomeInput: unknown,
	): Promise<PaymentOperation> {
		const outcome = providerOutcomeSchema.parse(outcomeInput);
		return transact(async (transaction) => {
			await lock(transaction, "paymentOperationLockV2", operationId);
			const operation = requireOperation(
				await transaction.getForUpdate("paymentOperationV2", operationId),
			);
			if (operation.attempt !== attemptNumber) return operation;
			if (
				operation.state !== "running" &&
				operation.state !== "ambiguous" &&
				operation.state !== "needs_attention"
			) {
				return operation;
			}
			if (
				operation.providerReference &&
				outcome.providerReference &&
				operation.providerReference !== outcome.providerReference
			) {
				throw new PaymentConnectionError(
					"invalid_operation_state",
					"Provider reconciliation returned a conflicting reference.",
				);
			}
			const now = new Date();
			const result = outcome.result ?? {};
			const confirmedProviderReference =
				outcome.providerReference ?? operation.providerReference;
			let operationState: PaymentOperation["state"] = outcome.state;
			let needsAttentionReason: string | undefined;
			if (outcome.state === "succeeded") {
				if (!confirmedProviderReference) {
					operationState = "needs_attention";
					needsAttentionReason =
						"Provider reported success without an immutable provider reference.";
				} else {
					try {
						await recordConfirmedPaymentOperationLocked(transaction, {
							paymentId: operation.paymentId,
							connectionId: operation.connectionId,
							operationId: operation.id,
							operation: operation.operation,
							...(operation.sourceOperationId
								? { sourceOperationId: operation.sourceOperationId }
								: {}),
							...(operation.payload.operation === "void"
								? {}
								: {
										amount: operation.payload.amount,
										currency: operation.payload.currency,
									}),
							requestDigest: operation.requestDigest,
							providerReference: confirmedProviderReference,
							confirmedAt: now,
						});
					} catch (error) {
						if (!(error instanceof PaymentAggregateError)) throw error;
						operationState = "needs_attention";
						needsAttentionReason = `Provider outcome could not advance the Payment aggregate (${error.code}).`;
					}
				}
			}
			const updated = operationRecord(operation, {
				state: operationState,
				providerReference: confirmedProviderReference,
				outcome: result,
				needsAttentionReason,
				needsAttentionAt:
					operationState === "needs_attention" ? now : undefined,
				leaseExpiresAt: undefined,
				nextReconciliationAt:
					operationState === "ambiguous" || isKnownNonfinalState(operationState)
						? nextReconciliationAt(
								now,
								operation.reconciliationAttempts,
								operationState,
							)
						: undefined,
				completedAt:
					operationState === "succeeded" || operationState === "failed"
						? now
						: undefined,
				updatedAt: now,
			});
			const attemptId = `${operation.id}:${attemptNumber}`;
			const currentAttempt = paymentOperationAttemptSchema.parse(
				await transaction.get("paymentOperationAttemptV2", attemptId),
			);
			const attempt = paymentOperationAttemptSchema.parse({
				...currentAttempt,
				state: outcome.state,
				...(confirmedProviderReference
					? {
							providerReference: confirmedProviderReference,
						}
					: {}),
				outcome: result,
				finishedAt: now,
			});
			await transaction.upsert("paymentOperationV2", operation.id, updated);
			await transaction.upsert(
				"paymentOperationAttemptV2",
				attempt.id,
				attempt,
			);
			return updated;
		});
	}

	async function claimReconciliation(
		operationId: string,
		options: z.output<typeof paymentOperationReconciliationOptionsSchema>,
	): Promise<{ operation: PaymentOperation; claimed: boolean }> {
		return transact(async (transaction) => {
			await lock(transaction, "paymentOperationLockV2", operationId);
			const operation = requireOperation(
				await transaction.getForUpdate("paymentOperationV2", operationId),
			);
			const allowedStates =
				options.trigger === "manual"
					? [
							"pending",
							"requires_action",
							"running",
							"ambiguous",
							"needs_attention",
							"dead_letter",
						]
					: ["pending", "requires_action", "running", "ambiguous"];
			if (!allowedStates.includes(operation.state)) {
				throw new PaymentConnectionError(
					"invalid_operation_state",
					"The Payment operation is not eligible for this reconciliation trigger.",
				);
			}
			const now = new Date();
			if (options.trigger === "scheduled") {
				const dueAt =
					operation.state === "running"
						? (operation.leaseExpiresAt ??
							new Date(
								operation.updatedAt.getTime() +
									PAYMENT_OPERATION_STALE_AFTER_MS,
							))
						: operation.nextReconciliationAt;
				if (dueAt !== undefined && dueAt > now) {
					throw new PaymentConnectionError(
						"reconciliation_not_due",
						"The Payment operation is not due for scheduled reconciliation.",
					);
				}
				const automaticBudget = isScheduledNonfinalState(operation.state)
					? reconciliationSchedule(operation.state).length
					: PAYMENT_MAX_AUTOMATIC_RECONCILIATIONS;
				if (operation.reconciliationAttempts >= automaticBudget) {
					if (isKnownNonfinalState(operation.state)) {
						const reason =
							operation.state === "requires_action"
								? "Provider action is still required after the automatic reconciliation budget."
								: "Provider processing is still pending after the automatic reconciliation budget.";
						if (
							operation.needsAttentionReason === reason &&
							operation.nextReconciliationAt === undefined
						) {
							return { operation, claimed: false };
						}
						const attentionRequired = operationRecord(operation, {
							needsAttentionReason: reason,
							needsAttentionAt: now,
							leaseExpiresAt: undefined,
							nextReconciliationAt: undefined,
							updatedAt: now,
						});
						await transaction.upsert(
							"paymentOperationV2",
							operation.id,
							attentionRequired,
						);
						return { operation: attentionRequired, claimed: false };
					}
					const deadLettered = operationRecord(operation, {
						state: "dead_letter",
						needsAttentionReason:
							"Automatic reconciliation budget was exhausted.",
						needsAttentionAt: now,
						deadLetteredAt: now,
						leaseExpiresAt: undefined,
						nextReconciliationAt: undefined,
						updatedAt: now,
					});
					await transaction.upsert(
						"paymentOperationV2",
						operation.id,
						deadLettered,
					);
					return { operation: deadLettered, claimed: false };
				}
			}
			const attemptNumber = safeIncrement(
				operation.attempt,
				"Payment operation attempt exceeds safe integer bounds.",
			);
			const reconciliationAttempts =
				options.trigger === "scheduled"
					? safeIncrement(
							operation.reconciliationAttempts,
							"Automatic reconciliation count exceeds safe integer bounds.",
						)
					: operation.reconciliationAttempts;
			const manualReconciliationCount =
				options.trigger === "manual"
					? safeIncrement(
							operation.manualReconciliationCount,
							"Manual reconciliation count exceeds safe integer bounds.",
						)
					: operation.manualReconciliationCount;
			const previousAttemptId = `${operation.id}:${operation.attempt}`;
			const previousAttemptRow = await transaction.get(
				"paymentOperationAttemptV2",
				previousAttemptId,
			);
			if (previousAttemptRow) {
				const previousAttempt =
					paymentOperationAttemptSchema.parse(previousAttemptRow);
				if (previousAttempt.state === "running") {
					await transaction.upsert(
						"paymentOperationAttemptV2",
						previousAttempt.id,
						paymentOperationAttemptSchema.parse({
							...previousAttempt,
							state: "ambiguous",
							outcome: { reason: "stale_running_recovered" },
							finishedAt: now,
						}),
					);
				}
			}
			const updated = operationRecord(operation, {
				state: "running",
				attempt: attemptNumber,
				reconciliationAttempts,
				manualReconciliationCount,
				needsAttentionReason: undefined,
				needsAttentionAt: undefined,
				leaseExpiresAt: new Date(
					now.getTime() + PAYMENT_OPERATION_STALE_AFTER_MS,
				),
				nextReconciliationAt: undefined,
				lastReconciliationAt: now,
				lastReconciliationTrigger: options.trigger,
				...(options.trigger === "manual"
					? {
							lastManualReconciliationReason: options.reason,
							lastManualReconciliationAt: now,
						}
					: {}),
				deadLetteredAt: undefined,
				updatedAt: now,
			});
			const attempt = paymentOperationAttemptSchema.parse({
				id: `${operation.id}:${attemptNumber}`,
				paymentOperationId: operation.id,
				connectionId: operation.connectionId,
				attempt: attemptNumber,
				idempotencyKey: operation.idempotencyKey,
				requestDigest: operation.requestDigest,
				trigger:
					options.trigger === "manual"
						? "manual_reconciliation"
						: "scheduled_reconciliation",
				...(options.reason ? { triggerReason: options.reason } : {}),
				state: "running",
				startedAt: now,
			});
			await transaction.upsert("paymentOperationV2", operation.id, updated);
			await transaction.upsert(
				"paymentOperationAttemptV2",
				attempt.id,
				attempt,
			);
			return { operation: updated, claimed: true };
		});
	}

	async function deadLetter(
		operationIdValue: string,
		reasonValue: string,
	): Promise<PaymentOperation> {
		const operationId = identifierSchema.parse(operationIdValue);
		const reason = z.string().trim().min(1).max(500).parse(reasonValue);
		return transact(async (transaction) => {
			await lock(transaction, "paymentOperationLockV2", operationId);
			const operation = requireOperation(
				await transaction.getForUpdate("paymentOperationV2", operationId),
			);
			if (operation.state === "dead_letter") return operation;
			if (!["running", "ambiguous"].includes(operation.state)) {
				throw new PaymentConnectionError(
					"invalid_operation_state",
					"Only an unresolved Payment operation can enter dead letter.",
				);
			}
			const now = new Date();
			const updated = operationRecord(operation, {
				state: "dead_letter",
				needsAttentionReason: reason,
				needsAttentionAt: now,
				deadLetteredAt: now,
				leaseExpiresAt: undefined,
				nextReconciliationAt: undefined,
				updatedAt: now,
			});
			await transaction.upsert("paymentOperationV2", operation.id, updated);
			return updated;
		});
	}

	async function pauseKnownNonfinalReconciliation(
		operationIdValue: string,
	): Promise<PaymentOperation> {
		const operationId = identifierSchema.parse(operationIdValue);
		return transact(async (transaction) => {
			await lock(transaction, "paymentOperationLockV2", operationId);
			const operation = requireOperation(
				await transaction.getForUpdate("paymentOperationV2", operationId),
			);
			if (!isKnownNonfinalState(operation.state)) return operation;
			const now = new Date();
			const reason =
				operation.state === "requires_action"
					? "Provider action is still required after the automatic reconciliation budget."
					: "Provider processing is still pending after the automatic reconciliation budget.";
			const updated = operationRecord(operation, {
				needsAttentionReason: reason,
				needsAttentionAt: now,
				leaseExpiresAt: undefined,
				nextReconciliationAt: undefined,
				updatedAt: now,
			});
			await transaction.upsert("paymentOperationV2", operation.id, updated);
			return updated;
		});
	}

	async function markNeedsAttention(
		operationIdValue: string,
		reasonValue: string,
	): Promise<PaymentOperation> {
		const operationId = identifierSchema.parse(operationIdValue);
		const reason = z.string().trim().min(1).max(500).parse(reasonValue);
		return transact(async (transaction) => {
			await lock(transaction, "paymentOperationLockV2", operationId);
			const operation = requireOperation(
				await transaction.getForUpdate("paymentOperationV2", operationId),
			);
			if (operation.state === "needs_attention") return operation;
			if (!["running", "ambiguous", "dead_letter"].includes(operation.state)) {
				throw new PaymentConnectionError(
					"invalid_operation_state",
					"Only a running or ambiguous Payment operation can require attention.",
				);
			}
			const now = new Date();
			const updated = operationRecord(operation, {
				state: "needs_attention",
				needsAttentionReason: reason,
				needsAttentionAt: now,
				leaseExpiresAt: undefined,
				nextReconciliationAt: undefined,
				completedAt: undefined,
				updatedAt: now,
			});
			const attemptId = `${operation.id}:${operation.attempt}`;
			const attemptRow = await transaction.get(
				"paymentOperationAttemptV2",
				attemptId,
			);
			if (attemptRow) {
				const currentAttempt = paymentOperationAttemptSchema.parse(attemptRow);
				if (currentAttempt.state === "running") {
					const attempt = paymentOperationAttemptSchema.parse({
						...currentAttempt,
						state: "failed",
						outcome: { reason },
						finishedAt: now,
					});
					await transaction.upsert(
						"paymentOperationAttemptV2",
						attempt.id,
						attempt,
					);
				}
			}
			await transaction.upsert("paymentOperationV2", operationId, updated);
			return updated;
		});
	}

	return {
		async createConnection(input) {
			const parsed = createPaymentConnectionInputSchema.parse(input);
			const normalizedName = normalizeConnectionName(parsed.name);
			const lockId = `payment-connection-name:${await sha256(normalizedName)}`;
			return transact(async (transaction) => {
				await lock(transaction, "paymentConnectionLockV2", lockId);
				const matchingNames = await transaction.findMany("paymentConnection", {
					where: { normalizedName },
					take: 1,
				});
				if (matchingNames.length > 0) {
					throw new PaymentConnectionError(
						"connection_name_conflict",
						"A Payment Connection already uses this name.",
					);
				}
				const id = parsed.id ?? crypto.randomUUID();
				await lock(
					transaction,
					"paymentConnectionLockV2",
					`payment-connection-id:${id}`,
				);
				if (await transaction.get("paymentConnection", id)) {
					throw new PaymentConnectionError(
						"connection_name_conflict",
						"A Payment Connection already uses this ID.",
					);
				}
				const now = new Date();
				const connection = paymentConnectionSchema.parse({
					id,
					providerAccountId: parsed.providerAccountId,
					name: parsed.name,
					normalizedName,
					provider: parsed.provider,
					mode: parsed.mode,
					capabilities: parsed.capabilities,
					health: "unknown",
					lifecycle: "draft",
					secretReference: parsed.secretReference,
					createdAt: now,
					updatedAt: now,
				});
				await transaction.upsert("paymentConnection", id, connection);
				return connection;
			});
		},

		async getConnection(id) {
			const row = await data.get(
				"paymentConnection",
				identifierSchema.parse(id),
			);
			return row ? paymentConnectionSchema.parse(row) : null;
		},

		async listConnections() {
			const rows = await data.findMany("paymentConnection", {
				orderBy: { createdAt: "asc" },
			});
			return rows.map((row) => paymentConnectionSchema.parse(row));
		},

		async setConnectionHealth(id, health) {
			const connectionId = identifierSchema.parse(id);
			const parsedHealth = paymentConnectionHealthSchema.parse(health);
			return transact(async (transaction) => {
				const connection = requireConnection(
					await transaction.getForUpdate("paymentConnection", connectionId),
				);
				if (connection.lifecycle === "revoked") {
					throw new PaymentConnectionError(
						"connection_revoked",
						"A revoked Payment Connection cannot be updated.",
					);
				}
				const now = new Date();
				const updated = connectionRecord(connection, {
					health: parsedHealth,
					healthCheckedAt: now,
					updatedAt: now,
				});
				await transaction.upsert("paymentConnection", connectionId, updated);
				return updated;
			});
		},

		async enableConnection(id) {
			const connectionId = identifierSchema.parse(id);
			return transact(async (transaction) => {
				const connection = requireConnection(
					await transaction.getForUpdate("paymentConnection", connectionId),
				);
				if (connection.lifecycle === "revoked") {
					throw new PaymentConnectionError(
						"connection_revoked",
						"A revoked Payment Connection cannot be enabled.",
					);
				}
				if (connection.health !== "healthy") {
					throw new PaymentConnectionError(
						"connection_not_usable",
						"A Payment Connection must be healthy before enablement.",
					);
				}
				for (const capability of connection.capabilities) {
					providerFor(connection, capability);
				}
				const now = new Date();
				const updated = connectionRecord(connection, {
					lifecycle: "enabled",
					enabledAt: now,
					updatedAt: now,
				});
				await transaction.upsert("paymentConnection", connectionId, updated);
				return updated;
			});
		},

		async disableConnection(id) {
			const connectionId = identifierSchema.parse(id);
			return transact(async (transaction) => {
				const connection = requireConnection(
					await transaction.getForUpdate("paymentConnection", connectionId),
				);
				if (connection.lifecycle === "revoked") {
					throw new PaymentConnectionError(
						"connection_revoked",
						"A revoked Payment Connection cannot be disabled.",
					);
				}
				const now = new Date();
				const updated = connectionRecord(connection, {
					lifecycle: "disabled",
					disabledAt: now,
					updatedAt: now,
				});
				await transaction.upsert("paymentConnection", connectionId, updated);
				return updated;
			});
		},

		async revokeConnection(id) {
			const connectionId = identifierSchema.parse(id);
			return transact(async (transaction) => {
				const connection = requireConnection(
					await transaction.getForUpdate("paymentConnection", connectionId),
				);
				if (connection.lifecycle === "revoked") return connection;
				const now = new Date();
				const updated = connectionRecord(connection, {
					lifecycle: "revoked",
					revokedAt: now,
					updatedAt: now,
				});
				await transaction.upsert("paymentConnection", connectionId, updated);
				return updated;
			});
		},

		async rotateSecretReference(id, secretReference) {
			const connectionId = identifierSchema.parse(id);
			const reference = secretReferenceSchema.parse(secretReference);
			return transact(async (transaction) => {
				const connection = requireConnection(
					await transaction.getForUpdate("paymentConnection", connectionId),
				);
				if (connection.lifecycle === "revoked") {
					throw new PaymentConnectionError(
						"connection_revoked",
						"A revoked Payment Connection cannot rotate credentials.",
					);
				}
				const now = new Date();
				const updated = connectionRecord(connection, {
					secretReference: reference,
					health: "unknown",
					lifecycle:
						connection.lifecycle === "enabled"
							? "disabled"
							: connection.lifecycle,
					disabledAt:
						connection.lifecycle === "enabled" ? now : connection.disabledAt,
					updatedAt: now,
				});
				await transaction.upsert("paymentConnection", connectionId, updated);
				return updated;
			});
		},

		async executeOperation(input) {
			const parsed = paymentOperationExecutionInputSchema.parse(input);
			const claim = await claimOperation(parsed);
			if (!claim.claimed) return claim.operation;
			let provider: PaymentConnectionProvider;
			let source: PaymentProviderOperationSource | undefined;
			try {
				const connection = requireConnection(
					await data.get("paymentConnection", claim.operation.connectionId),
				);
				provider = requireUsable(connection, claim.operation.operation);
				source = await providerOperationSource(claim.operation);
			} catch (error) {
				const reason =
					error instanceof PaymentConnectionError
						? error.code
						: "connection_unavailable";
				return markNeedsAttention(
					claim.operation.id,
					`Original Payment Connection is unavailable (${reason}).`,
				);
			}
			try {
				const outcome = providerOutcomeSchema.parse(
					await provider.execute({
						operationId: claim.operation.id,
						connectionId: claim.operation.connectionId,
						idempotencyKey: claim.operation.idempotencyKey,
						requestDigest: claim.operation.requestDigest,
						attempt: claim.operation.attempt,
						createdAt: claim.operation.createdAt,
						payload: claim.operation.payload,
						...(source ? { source } : {}),
					}),
				);
				return recordOutcome(
					claim.operation.id,
					claim.operation.attempt,
					outcome,
				);
			} catch {
				return recordOutcome(claim.operation.id, claim.operation.attempt, {
					state: "ambiguous",
					result: { reason: "provider_outcome_unknown" },
				});
			}
		},

		async reconcileOperation(id, optionsInput) {
			const operationId = identifierSchema.parse(id);
			const options =
				paymentOperationReconciliationOptionsSchema.parse(optionsInput);
			const claim = await claimReconciliation(operationId, options);
			if (!claim.claimed) return claim.operation;
			const operation = claim.operation;
			let provider: PaymentConnectionProvider;
			let source: PaymentProviderOperationSource | undefined;
			try {
				const connection = requireConnection(
					await data.get("paymentConnection", operation.connectionId),
				);
				provider = requireUsable(connection, operation.operation);
				source = await providerOperationSource(operation);
			} catch (error) {
				const reason =
					error instanceof PaymentConnectionError
						? error.code
						: "connection_unavailable";
				return markNeedsAttention(
					operation.id,
					`Original Payment Connection is unavailable for reconciliation (${reason}).`,
				);
			}
			try {
				const currentConnection = requireConnection(
					await data.get("paymentConnection", operation.connectionId),
				);
				provider = requireUsable(currentConnection, operation.operation);
				const outcome = providerOutcomeSchema.parse(
					await provider.reconcile({
						operationId: operation.id,
						connectionId: operation.connectionId,
						operation: operation.operation,
						idempotencyKey: operation.idempotencyKey,
						requestDigest: operation.requestDigest,
						attempt: operation.attempt,
						createdAt: operation.createdAt,
						payload: operation.payload,
						...(operation.providerReference
							? { providerReference: operation.providerReference }
							: {}),
						...(source ? { source } : {}),
					}),
				);
				const reconciled = await recordOutcome(
					operation.id,
					operation.attempt,
					outcome,
				);
				if (isKnownNonfinalState(reconciled.state)) {
					if (
						options.trigger === "scheduled" &&
						reconciled.reconciliationAttempts >=
							reconciliationSchedule(reconciled.state).length
					) {
						return pauseKnownNonfinalReconciliation(operation.id);
					}
					return reconciled;
				}
				if (reconciled.state !== "ambiguous") return reconciled;
				if (options.trigger === "manual") {
					return markNeedsAttention(
						operation.id,
						"Manual provider reconciliation did not establish a final outcome.",
					);
				}
				if (
					reconciled.reconciliationAttempts >=
					PAYMENT_MAX_AUTOMATIC_RECONCILIATIONS
				) {
					return deadLetter(
						operation.id,
						"Automatic provider reconciliation budget was exhausted.",
					);
				}
				return reconciled;
			} catch (error) {
				if (error instanceof PaymentConnectionError) {
					return markNeedsAttention(
						operation.id,
						`Original Payment Connection became unavailable during reconciliation (${error.code}).`,
					);
				}
				const ambiguous = await recordOutcome(operation.id, operation.attempt, {
					state: "ambiguous",
					result: { reason: "provider_reconciliation_unknown" },
				});
				if (options.trigger === "manual") {
					return markNeedsAttention(
						operation.id,
						"Manual provider reconciliation failed or returned an invalid outcome.",
					);
				}
				if (
					ambiguous.reconciliationAttempts >=
					PAYMENT_MAX_AUTOMATIC_RECONCILIATIONS
				) {
					return deadLetter(
						operation.id,
						"Automatic provider reconciliation budget was exhausted.",
					);
				}
				return ambiguous;
			}
		},

		async markOperationNeedsAttention(id, reason) {
			return markNeedsAttention(id, reason);
		},

		async getOperation(id) {
			const row = await data.get(
				"paymentOperationV2",
				identifierSchema.parse(id),
			);
			return row ? paymentOperationSchema.parse(row) : null;
		},

		async listOperationAttempts(id) {
			const operationId = identifierSchema.parse(id);
			const rows = await data.findMany("paymentOperationAttemptV2", {
				where: { paymentOperationId: operationId },
			});
			return rows
				.map((row) => paymentOperationAttemptSchema.parse(row))
				.sort((left, right) => left.attempt - right.attempt);
		},
	};
}
