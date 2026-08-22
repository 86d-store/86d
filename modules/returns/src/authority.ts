import {
	actorReferenceSchema,
	authoritySnapshotSchema,
} from "@86d-app/contracts/command";
import { orderLineQuantityValidateCapability } from "@86d-app/core/commerce-capabilities";
import type {
	LockingModuleDataTransaction,
	ModuleDataTransaction,
	ModuleTransactionRunner,
} from "@86d-app/core/durable-events";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import {
	returnConditionSnapshotSchema,
	returnReasonSnapshotSchema,
	returnRequestedV1,
	returnResolutionSchema,
} from "./events";

const identifier = z.string().trim().min(1).max(200);

export type OrderLineQuantityAuthority = Readonly<{
	invoke(
		definition: typeof orderLineQuantityValidateCapability,
		request: z.input<typeof orderLineQuantityValidateCapability.request>,
	): Promise<
		| Readonly<{
				ok: true;
				decision: z.output<typeof orderLineQuantityValidateCapability.decision>;
		  }>
		| Readonly<{ ok: false; failure: Readonly<{ code: string }> }>
	>;
}>;
const boundedText = (maximum: number) =>
	z
		.string()
		.min(1)
		.max(maximum)
		.transform(sanitizeText)
		.pipe(z.string().min(1).max(maximum));
const optionalText = (maximum: number) =>
	z.string().max(maximum).transform(sanitizeText).optional();

const returnLineInputSchema = z
	.object({
		orderItemId: identifier,
		quantity: z.number().int().positive().max(1_000_000),
		reasonSnapshot: returnReasonSnapshotSchema,
		conditionSnapshot: returnConditionSnapshotSchema,
		notesSnapshot: optionalText(500),
	})
	.strict();

export const requestReturnInputSchema = z
	.object({
		operationId: z.string().trim().min(8).max(200),
		orderId: identifier,
		customerId: identifier,
		actor: actorReferenceSchema,
		authority: authoritySnapshotSchema,
		requestedResolution: returnResolutionSchema,
		reasonSnapshot: boundedText(1_000),
		items: z.array(returnLineInputSchema).min(1).max(1_000),
	})
	.strict()
	.superRefine((input, context) => {
		const lineIds = new Set<string>();
		for (const [index, item] of input.items.entries()) {
			if (lineIds.has(item.orderItemId)) {
				context.addIssue({
					code: "custom",
					message: "A Return request may include each Order line only once.",
					path: ["items", index, "orderItemId"],
				});
			}
			lineIds.add(item.orderItemId);
		}
	});

const storedTimestamp = z
	.union([z.date(), z.string().datetime()])
	.transform((value) => (value instanceof Date ? value : new Date(value)));

export const authoritativeReturnRequestSchema = z
	.object({
		id: z.string().min(1).max(255),
		contractVersion: z.literal(1),
		operationId: z.string().min(8).max(200),
		requestDigest: z.string().regex(/^[a-f0-9]{64}$/),
		orderId: identifier,
		customerId: identifier,
		actor: actorReferenceSchema,
		authority: authoritySnapshotSchema,
		requestedResolution: returnResolutionSchema,
		reasonSnapshot: z.string().min(1).max(1_000),
		items: z.array(returnLineInputSchema).min(1).max(1_000),
		requestedAt: storedTimestamp,
	})
	.strict();

const returnOperationReceiptSchema = z
	.object({
		id: z.string().min(1).max(255),
		operationId: z.string().min(8).max(200),
		requestDigest: z.string().regex(/^[a-f0-9]{64}$/),
		returnRequestId: z.string().min(1).max(255),
		createdAt: storedTimestamp,
	})
	.strict();

export type RequestReturnInput = z.infer<typeof requestReturnInputSchema>;
export type AuthoritativeReturnRequest = z.infer<
	typeof authoritativeReturnRequestSchema
>;

export type RequestReturnResult = Readonly<{
	request: AuthoritativeReturnRequest;
	replayed: boolean;
}>;

export type ReturnAuthorityErrorCode =
	| "RETURN_AUTHORITY_UNAVAILABLE"
	| "RETURN_DATA_INVALID"
	| "RETURN_INPUT_INVALID"
	| "RETURN_OPERATION_CONFLICT"
	| "RETURN_ORDER_NOT_FOUND"
	| "RETURN_ORDER_NOT_RETURNABLE"
	| "RETURN_ORDER_LINE_INVALID"
	| "RETURN_QUANTITY_EXCEEDED";

export class ReturnAuthorityError extends Error {
	readonly code: ReturnAuthorityErrorCode;

	constructor(code: ReturnAuthorityErrorCode, message: string) {
		super(message);
		this.name = "ReturnAuthorityError";
		this.code = code;
	}
}

function isLockingTransaction(
	transaction: ModuleDataTransaction,
): transaction is LockingModuleDataTransaction {
	return (
		"getForUpdate" in transaction &&
		typeof transaction.getForUpdate === "function"
	);
}

function encode(value: string): string {
	return `${value.length}:${value}`;
}

async function digest(components: readonly string[]): Promise<string> {
	const canonical = components.map(encode).join("|");
	const value = await globalThis.crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(canonical),
	);
	return Array.from(new Uint8Array(value), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
}

async function entityId(
	prefix: string,
	components: readonly string[],
): Promise<string> {
	return `${prefix}_${await digest(components)}`;
}

async function requestDigest(input: RequestReturnInput): Promise<string> {
	const items = [...input.items]
		.sort((left, right) => {
			if (left.orderItemId < right.orderItemId) return -1;
			if (left.orderItemId > right.orderItemId) return 1;
			return 0;
		})
		.map((item) => ({
			orderItemId: item.orderItemId,
			quantity: item.quantity,
			reasonSnapshot: item.reasonSnapshot,
			conditionSnapshot: item.conditionSnapshot,
			notesSnapshot: item.notesSnapshot ?? null,
		}));
	const authority = {
		id: input.authority.id,
		type: input.authority.type,
		role: input.authority.role ?? null,
		permissions: [...input.authority.permissions].sort(),
		businessId: input.authority.businessId ?? null,
		storeId: input.authority.storeId ?? null,
	};
	return digest([
		JSON.stringify({
			contractVersion: 1,
			orderId: input.orderId,
			customerId: input.customerId,
			actor: input.actor,
			authority,
			requestedResolution: input.requestedResolution,
			reasonSnapshot: input.reasonSnapshot,
			items,
		}),
	]);
}

async function lockEntity(
	transaction: LockingModuleDataTransaction,
	entityType: "returnAuthorityOperationLock" | "returnAuthorityOrderLock",
	id: string,
	data: Readonly<{ operationId: string } | { orderId: string }>,
): Promise<void> {
	await transaction.upsert(entityType, id, { id, ...data });
	if (!(await transaction.getForUpdate(entityType, id))) {
		throw new ReturnAuthorityError(
			"RETURN_AUTHORITY_UNAVAILABLE",
			"Returns could not acquire its owner-local operation lock.",
		);
	}
}

function mapOrderFailure(code: string): ReturnAuthorityError {
	if (code === "ORDER_NOT_FOUND") {
		return new ReturnAuthorityError(
			"RETURN_ORDER_NOT_FOUND",
			"Order not found.",
		);
	}
	if (code === "ORDER_NOT_FULFILLABLE") {
		return new ReturnAuthorityError(
			"RETURN_ORDER_NOT_RETURNABLE",
			"The Order does not accept a Return request.",
		);
	}
	if (
		code === "ORDER_LINE_NOT_FOUND" ||
		code === "ORDER_LINE_QUANTITY_EXCEEDED" ||
		code === "ORDER_LINE_DATA_INVALID"
	) {
		return new ReturnAuthorityError(
			"RETURN_ORDER_LINE_INVALID",
			"A requested Return line does not match the accepted Order.",
		);
	}
	return new ReturnAuthorityError(
		"RETURN_AUTHORITY_UNAVAILABLE",
		"Order line validation is unavailable.",
	);
}

function cumulativeQuantities(
	rows: readonly Record<string, unknown>[],
): Map<string, number> {
	const quantities = new Map<string, number>();
	for (const row of rows) {
		const parsed = authoritativeReturnRequestSchema.safeParse(row);
		if (!parsed.success) {
			throw new ReturnAuthorityError(
				"RETURN_DATA_INVALID",
				"Stored authoritative Return data is invalid.",
			);
		}
		for (const item of parsed.data.items) {
			const quantity = (quantities.get(item.orderItemId) ?? 0) + item.quantity;
			if (!Number.isSafeInteger(quantity)) {
				throw new ReturnAuthorityError(
					"RETURN_DATA_INVALID",
					"Stored Return quantities exceed safe integer bounds.",
				);
			}
			quantities.set(item.orderItemId, quantity);
		}
	}
	return quantities;
}

async function replay(
	transaction: LockingModuleDataTransaction,
	receiptId: string,
	operationId: string,
	digestValue: string,
): Promise<RequestReturnResult | null> {
	const rawReceipt = await transaction.get("returnAuthorityReceipt", receiptId);
	if (!rawReceipt) return null;
	const receipt = returnOperationReceiptSchema.safeParse(rawReceipt);
	if (!receipt.success || receipt.data.operationId !== operationId) {
		throw new ReturnAuthorityError(
			"RETURN_DATA_INVALID",
			"Stored Return operation data is invalid.",
		);
	}
	if (receipt.data.requestDigest !== digestValue) {
		throw new ReturnAuthorityError(
			"RETURN_OPERATION_CONFLICT",
			"The Return operation ID was already used for different input.",
		);
	}

	const rawRequest = await transaction.get(
		"returnAuthorityRequest",
		receipt.data.returnRequestId,
	);
	const request = authoritativeReturnRequestSchema.safeParse(rawRequest);
	if (
		!request.success ||
		request.data.operationId !== operationId ||
		request.data.requestDigest !== digestValue
	) {
		throw new ReturnAuthorityError(
			"RETURN_DATA_INVALID",
			"The replayed Return request is missing or invalid.",
		);
	}
	return { request: request.data, replayed: true };
}

/**
 * Persist a Return request without causing a refund, restock, delivery change,
 * or Payment mutation. A trusted Command adapter must authorize the supplied
 * Customer, actor, and authority snapshot before invoking this unregistered
 * foundation.
 */
export async function requestAuthoritativeReturn(
	input: RequestReturnInput,
	dependencies: Readonly<{
		capabilities?: OrderLineQuantityAuthority | undefined;
		transactions?: ModuleTransactionRunner | undefined;
		clock?: (() => Date) | undefined;
	}>,
): Promise<RequestReturnResult> {
	const parsed = requestReturnInputSchema.safeParse(input);
	if (!parsed.success) {
		throw new ReturnAuthorityError(
			"RETURN_INPUT_INVALID",
			"Return request input is invalid.",
		);
	}
	const { capabilities, transactions } = dependencies;
	if (!transactions) {
		throw new ReturnAuthorityError(
			"RETURN_AUTHORITY_UNAVAILABLE",
			"Returns requires transactional storage.",
		);
	}

	const normalized = parsed.data;
	const digestValue = await requestDigest(normalized);
	const operationLockId = await entityId("return_operation_lock", [
		normalized.operationId,
	]);
	const receiptId = await entityId("return_receipt", [normalized.operationId]);
	const requestId = await entityId("return_request", [normalized.operationId]);
	const orderLockId = await entityId("return_order_lock", [normalized.orderId]);

	return transactions.transaction(async (transaction) => {
		if (!isLockingTransaction(transaction)) {
			throw new ReturnAuthorityError(
				"RETURN_AUTHORITY_UNAVAILABLE",
				"Returns requires row-locking transactional storage.",
			);
		}
		await lockEntity(
			transaction,
			"returnAuthorityOperationLock",
			operationLockId,
			{ operationId: normalized.operationId },
		);
		const replayed = await replay(
			transaction,
			receiptId,
			normalized.operationId,
			digestValue,
		);
		if (replayed) return replayed;
		if (!capabilities) {
			throw new ReturnAuthorityError(
				"RETURN_AUTHORITY_UNAVAILABLE",
				"Returns requires the Order line validation capability.",
			);
		}

		await lockEntity(transaction, "returnAuthorityOrderLock", orderLockId, {
			orderId: normalized.orderId,
		});

		const validation = await capabilities.invoke(
			orderLineQuantityValidateCapability,
			{
				orderId: normalized.orderId,
				items: normalized.items.map((item) => ({
					orderItemId: item.orderItemId,
					quantity: item.quantity,
				})),
			},
		);
		if (!validation.ok) {
			throw mapOrderFailure(validation.failure.code);
		}

		const existing = await transaction.findMany("returnAuthorityRequest", {
			where: { orderId: normalized.orderId },
		});
		const cumulative = cumulativeQuantities(existing);
		for (const line of validation.decision.items) {
			const total =
				(cumulative.get(line.orderItemId) ?? 0) + line.requestedQuantity;
			if (!Number.isSafeInteger(total) || total > line.orderedQuantity) {
				throw new ReturnAuthorityError(
					"RETURN_QUANTITY_EXCEEDED",
					"Cumulative Return requests exceed the accepted Order line quantity.",
				);
			}
		}

		const requestedAt = (dependencies.clock ?? (() => new Date()))();
		if (Number.isNaN(requestedAt.getTime())) {
			throw new ReturnAuthorityError(
				"RETURN_AUTHORITY_UNAVAILABLE",
				"Returns could not establish a valid request time.",
			);
		}
		const request = {
			id: requestId,
			contractVersion: 1,
			operationId: normalized.operationId,
			requestDigest: digestValue,
			orderId: normalized.orderId,
			customerId: normalized.customerId,
			actor: normalized.actor,
			authority: normalized.authority,
			requestedResolution: normalized.requestedResolution,
			reasonSnapshot: normalized.reasonSnapshot,
			items: normalized.items,
			requestedAt,
		} satisfies AuthoritativeReturnRequest;
		const receipt = {
			id: receiptId,
			operationId: normalized.operationId,
			requestDigest: digestValue,
			returnRequestId: request.id,
			createdAt: requestedAt,
		};

		await transaction.upsert("returnAuthorityRequest", request.id, request);
		await transaction.upsert("returnAuthorityReceipt", receipt.id, receipt);
		await transaction.emit(returnRequestedV1, {
			id: await entityId("return_requested_event", [normalized.operationId]),
			aggregate: { type: "returnRequest", id: request.id },
			occurredAt: requestedAt,
			payload: {
				returnRequestId: request.id,
				operationId: request.operationId,
				orderId: request.orderId,
				customerId: request.customerId,
				actor: request.actor,
				authority: request.authority,
				requestedResolution: request.requestedResolution,
				reasonSnapshot: request.reasonSnapshot,
				items: request.items.map((item) => ({
					orderItemId: item.orderItemId,
					quantity: item.quantity,
					reasonSnapshot: item.reasonSnapshot,
					conditionSnapshot: item.conditionSnapshot,
				})),
			},
		});
		return { request, replayed: false };
	});
}
