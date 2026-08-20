import type {
	LockingModuleDataTransaction,
	ModuleDataTransaction,
	ModuleTransactionRunner,
} from "@86d-app/core/durable-events";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const CHECKOUT_REQUEST_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const sanitizedRequiredText = (maximum: number) =>
	z
		.string()
		.max(maximum)
		.transform(sanitizeText)
		.pipe(z.string().min(1).max(maximum));

const sanitizedOptionalText = (maximum: number) =>
	z
		.string()
		.max(maximum)
		.transform(sanitizeText)
		.pipe(z.string().min(1).max(maximum))
		.optional();

export const checkoutRequestReasonSchema = z
	.object({
		code: z.enum([
			"PAYMENT_ACTIVATION_REQUIRED",
			"PAYMENT_CONNECTION_UNAVAILABLE",
			"TAX_REVIEW_REQUIRED",
			"SHIPPING_REVIEW_REQUIRED",
			"INVENTORY_REVIEW_REQUIRED",
			"REQUIRED_DECISION_UNAVAILABLE",
		]),
		detail: sanitizedOptionalText(500),
	})
	.strict();

export const checkoutRequestContactSchema = z
	.object({
		email: z
			.string()
			.max(320)
			.transform(sanitizeText)
			.pipe(z.string().email().max(320))
			.transform((email) => email.toLowerCase()),
		firstName: sanitizedOptionalText(200),
		lastName: sanitizedOptionalText(200),
		phone: sanitizedOptionalText(50),
	})
	.strict();

const checkoutRequestLineChoiceSchema = z
	.object({
		productId: sanitizedRequiredText(200),
		variantId: sanitizedOptionalText(200),
		quantity: z.number().int().positive().max(999),
	})
	.strict();

export const checkoutRequestCartSnapshotSchema = z
	.object({
		cartId: sanitizedRequiredText(200),
		revision: z.string().datetime(),
		lines: z.array(checkoutRequestLineChoiceSchema).min(1).max(100),
	})
	.strict()
	.superRefine((snapshot, context) => {
		const identities = new Set<string>();
		for (const [index, line] of snapshot.lines.entries()) {
			const identity = `${line.productId}\u0000${line.variantId ?? ""}`;
			if (identities.has(identity)) {
				context.addIssue({
					code: "custom",
					message: "Cart snapshot line choices must be unique.",
					path: ["lines", index],
				});
			}
			identities.add(identity);
		}
	})
	.transform((snapshot) => ({
		...snapshot,
		lines: [...snapshot.lines].sort((left, right) => {
			const productOrder = left.productId.localeCompare(right.productId);
			if (productOrder !== 0) return productOrder;
			return (left.variantId ?? "").localeCompare(right.variantId ?? "");
		}),
	}));

export const checkoutRequestAuditActorSchema = z
	.object({
		type: z.enum([
			"account",
			"authenticated_shopper",
			"guest",
			"workload",
			"system",
		]),
		id: sanitizedRequiredText(255),
	})
	.strict();

export const checkoutRequestCreateInputSchema = z
	.object({
		operationKey: z.string().trim().min(8).max(200),
		owner: z
			.object({
				type: z.enum(["authenticated_shopper", "guest"]),
				id: sanitizedRequiredText(255),
			})
			.strict(),
		accessProofDigest: z.string().regex(SHA256_PATTERN).optional(),
		reason: checkoutRequestReasonSchema,
		contact: checkoutRequestContactSchema,
		cartSnapshot: checkoutRequestCartSnapshotSchema,
		auditActor: checkoutRequestAuditActorSchema,
	})
	.strict()
	.refine(
		(input) =>
			(input.owner.type === "guest") ===
			(input.accessProofDigest !== undefined),
		{
			message: "Guest Checkout Requests require an access proof digest.",
			path: ["accessProofDigest"],
		},
	);

const timestampSchema = z
	.union([z.date(), z.string().datetime()])
	.transform((value) => (value instanceof Date ? value : new Date(value)));

const checkoutRequestInvitationStateSchema = z.enum([
	"not_invited",
	"invited",
	"reminded",
	"expired",
]);

export const storedCheckoutRequestSchema = z
	.object({
		id: z.string().min(1).max(100),
		requestDigest: z.string().regex(SHA256_PATTERN),
		requestDigestVersion: z.literal(1),
		owner: z
			.object({
				type: z.enum(["authenticated_shopper", "guest"]),
				id: z.string().min(1).max(255),
			})
			.strict(),
		accessProofDigest: z.string().regex(SHA256_PATTERN).optional(),
		reason: checkoutRequestReasonSchema,
		contact: checkoutRequestContactSchema,
		cartSnapshot: checkoutRequestCartSnapshotSchema,
		invitationState: checkoutRequestInvitationStateSchema,
		invitedAt: timestampSchema.optional(),
		remindedAt: timestampSchema.optional(),
		invitationExpiresAt: timestampSchema.optional(),
		auditActor: checkoutRequestAuditActorSchema,
		expiresAt: timestampSchema,
		createdAt: timestampSchema,
		updatedAt: timestampSchema,
	})
	.strict();

const storedCheckoutRequestOperationSchema = z
	.object({
		id: z.string().min(1).max(100),
		operationKey: z.string().min(8).max(200),
		requestDigest: z.string().regex(SHA256_PATTERN),
		requestDigestVersion: z.literal(1),
		checkoutRequestId: z.string().min(1).max(100),
		createdAt: timestampSchema,
	})
	.strict();

export type CheckoutRequestCreateInput = z.infer<
	typeof checkoutRequestCreateInputSchema
>;
export type CheckoutRequest = z.infer<typeof storedCheckoutRequestSchema>;
export type CheckoutRequestInvitationState = z.infer<
	typeof checkoutRequestInvitationStateSchema
>;

export type CheckoutRequestCreateResult =
	| { ok: true; request: CheckoutRequest; replayed: boolean }
	| {
			ok: false;
			code:
				| "TRANSACTION_UNAVAILABLE"
				| "LOCKING_UNAVAILABLE"
				| "IDEMPOTENCY_KEY_REUSED"
				| "REQUEST_STATE_INVALID";
			message: string;
	  };

export type CheckoutRequestReadResult =
	| { ok: true; request: CheckoutRequest }
	| {
			ok: false;
			code:
				| "TRANSACTION_UNAVAILABLE"
				| "LOCKING_UNAVAILABLE"
				| "REQUEST_NOT_FOUND"
				| "REQUEST_STATE_INVALID";
			message: string;
	  };

export type CheckoutRequestStore = {
	create(
		input: CheckoutRequestCreateInput,
	): Promise<CheckoutRequestCreateResult>;
	getById(id: string): Promise<CheckoutRequestReadResult>;
};

function isLockingTransaction(
	transaction: ModuleDataTransaction,
): transaction is LockingModuleDataTransaction {
	return (
		"getForUpdate" in transaction &&
		typeof transaction.getForUpdate === "function"
	);
}

function rejected(
	code: Extract<CheckoutRequestCreateResult, { ok: false }>["code"],
	message: string,
): CheckoutRequestCreateResult {
	return { ok: false, code, message };
}

function canonicalJson(value: unknown): string {
	if (value === null) return "null";
	if (typeof value === "string") return JSON.stringify(value);
	if (typeof value === "boolean") return value ? "true" : "false";
	if (typeof value === "number") {
		if (!Number.isFinite(value)) {
			throw new Error("Checkout Request values must be finite.");
		}
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) {
		return `[${value.map(canonicalJson).join(",")}]`;
	}
	if (typeof value === "object") {
		const entries = Object.entries(value)
			.filter(([, entry]) => entry !== undefined)
			.sort(([left], [right]) => left.localeCompare(right));
		return `{${entries
			.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
			.join(",")}}`;
	}
	throw new Error("Checkout Request values must be JSON-compatible.");
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

function requestSignature(input: CheckoutRequestCreateInput): string {
	return canonicalJson({
		version: 1,
		owner: input.owner,
		accessProofDigest: input.accessProofDigest,
		reason: input.reason,
		contact: input.contact,
		cartSnapshot: input.cartSnapshot,
		auditActor: input.auditActor,
	});
}

async function replayRequest(
	transaction: LockingModuleDataTransaction,
	operationId: string,
	requestDigest: string,
): Promise<CheckoutRequestCreateResult | null> {
	const storedOperation = await transaction.getForUpdate(
		"checkoutRequestOperation",
		operationId,
	);
	if (!storedOperation) return null;

	const operation =
		storedCheckoutRequestOperationSchema.safeParse(storedOperation);
	if (!operation.success) {
		return rejected(
			"REQUEST_STATE_INVALID",
			"The stored Checkout Request operation is invalid.",
		);
	}
	if (operation.data.requestDigest !== requestDigest) {
		return rejected(
			"IDEMPOTENCY_KEY_REUSED",
			"The operation key was already used for a different Checkout Request.",
		);
	}

	const storedRequest = await transaction.getForUpdate(
		"checkoutRequest",
		operation.data.checkoutRequestId,
	);
	const request = storedCheckoutRequestSchema.safeParse(storedRequest);
	if (
		!request.success ||
		request.data.id !== operation.data.checkoutRequestId ||
		request.data.requestDigest !== requestDigest
	) {
		return rejected(
			"REQUEST_STATE_INVALID",
			"The stored Checkout Request is missing or invalid.",
		);
	}

	return { ok: true, request: request.data, replayed: true };
}

async function createLocked(
	transaction: LockingModuleDataTransaction,
	input: CheckoutRequestCreateInput,
): Promise<CheckoutRequestCreateResult> {
	const operationHash = await sha256(
		`checkout-request-operation:v1:${input.owner.type}:${input.owner.id}:${input.operationKey}`,
	);
	const operationId = `checkout_request_operation_${operationHash}`;
	await transaction.upsert("checkoutRequestLock", operationId, {
		id: operationId,
	});
	const lock = await transaction.getForUpdate(
		"checkoutRequestLock",
		operationId,
	);
	if (!lock) {
		return rejected(
			"LOCKING_UNAVAILABLE",
			"The Checkout Request operation lock could not be acquired.",
		);
	}

	const requestDigest = await sha256(requestSignature(input));
	const replayed = await replayRequest(transaction, operationId, requestDigest);
	if (replayed) return replayed;

	const requestHash = await sha256(
		`checkout-request:v1:${input.operationKey}:${requestDigest}`,
	);
	const id = `checkout_request_${requestHash}`;
	const now = new Date();
	const request = {
		id,
		requestDigest,
		requestDigestVersion: 1,
		owner: input.owner,
		...(input.accessProofDigest
			? { accessProofDigest: input.accessProofDigest }
			: {}),
		reason: input.reason,
		contact: input.contact,
		cartSnapshot: input.cartSnapshot,
		invitationState: "not_invited",
		auditActor: input.auditActor,
		expiresAt: new Date(now.getTime() + CHECKOUT_REQUEST_RETENTION_MS),
		createdAt: now,
		updatedAt: now,
	} satisfies CheckoutRequest;
	const operation = {
		id: operationId,
		operationKey: input.operationKey,
		requestDigest,
		requestDigestVersion: 1,
		checkoutRequestId: id,
		createdAt: now,
	} satisfies z.infer<typeof storedCheckoutRequestOperationSchema>;

	await transaction.upsert("checkoutRequest", id, request);
	await transaction.upsert("checkoutRequestOperation", operationId, operation);
	return { ok: true, request, replayed: false };
}

/**
 * Creates immutable, non-binding Checkout Requests in Checkout-owned storage.
 *
 * The bounded Store transport can create and read this aggregate, but there is
 * intentionally no invitation transition. This service cannot accept payment
 * data, finalize tax or Shipping, create an Order, or promise Inventory.
 * Activation must begin with a fresh Checkout calculation and explicit shopper
 * acceptance.
 */
export function createCheckoutRequestStore(
	transactions: ModuleTransactionRunner | undefined,
): CheckoutRequestStore {
	return {
		async create(input) {
			if (!transactions) {
				return rejected(
					"TRANSACTION_UNAVAILABLE",
					"Checkout Request creation requires owner-local transactional storage.",
				);
			}

			const parsed = checkoutRequestCreateInputSchema.parse(input);
			return transactions.transaction((transaction) => {
				if (!isLockingTransaction(transaction)) {
					return Promise.resolve(
						rejected(
							"LOCKING_UNAVAILABLE",
							"Checkout Request creation requires owner-local row locking.",
						),
					);
				}
				return createLocked(transaction, parsed);
			});
		},
		async getById(id) {
			if (!transactions) {
				return {
					ok: false,
					code: "TRANSACTION_UNAVAILABLE",
					message: "Checkout Request reads require transactional storage.",
				};
			}
			return transactions.transaction(async (transaction) => {
				if (!isLockingTransaction(transaction)) {
					return {
						ok: false,
						code: "LOCKING_UNAVAILABLE",
						message: "Checkout Request reads require owner-local row locking.",
					};
				}
				const stored = await transaction.getForUpdate("checkoutRequest", id);
				if (!stored) {
					return {
						ok: false,
						code: "REQUEST_NOT_FOUND",
						message: "The Checkout Request was not found.",
					};
				}
				const request = storedCheckoutRequestSchema.safeParse(stored);
				if (!request.success) {
					return {
						ok: false,
						code: "REQUEST_STATE_INVALID",
						message: "The stored Checkout Request is invalid.",
					};
				}
				return { ok: true, request: request.data };
			});
		},
	};
}
