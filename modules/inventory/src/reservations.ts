import type { CapabilityResult } from "@86d-app/core/capabilities";
import type {
	LockingModuleDataTransaction,
	ModuleDataTransaction,
	ModuleTransactionRunner,
} from "@86d-app/core/durable-events";
import { inventoryCheckoutV2Capability } from "@86d-app/core/inventory-reservation-capability";
import { z } from "zod";

export type InventoryReservationRequest = z.infer<
	typeof inventoryCheckoutV2Capability.request
>;
export type InventoryReservationDecision = z.infer<
	typeof inventoryCheckoutV2Capability.decision
>;
export type InventoryReservationFailure = z.infer<
	typeof inventoryCheckoutV2Capability.failure
>;
export type InventoryReservationResult = CapabilityResult<
	InventoryReservationDecision,
	InventoryReservationFailure
>;

type ReservationOperation = InventoryReservationRequest["operation"];

const identifier = z.string().min(1).max(200);
const storedTimestamp = z
	.union([z.date(), z.string().datetime()])
	.transform((value) => (value instanceof Date ? value : new Date(value)));

const storedInventoryItemSchema = z
	.object({
		id: z.string().min(1).max(255),
		productId: identifier,
		variantId: identifier.optional(),
		locationId: identifier.optional(),
		productName: z.string().max(500).optional(),
		variantName: z.string().max(500).optional(),
		quantity: z.number().int().nonnegative(),
		reserved: z.number().int().nonnegative(),
		lowStockThreshold: z.number().int().nonnegative().optional(),
		allowBackorder: z.boolean(),
		createdAt: storedTimestamp,
		updatedAt: storedTimestamp,
	})
	.strict();

const storedReservationSchema = z
	.object({
		id: z.string().min(1).max(1_000),
		checkoutId: identifier,
		lineId: identifier,
		productId: identifier,
		variantId: identifier.optional(),
		locationId: identifier.optional(),
		quantity: z.number().int().positive().max(1_000_000),
		leaseExpiresAt: storedTimestamp,
		status: z.enum(["reserved", "committed", "released", "expired"]),
		idempotencyKey: identifier,
		committedAt: storedTimestamp.optional(),
		releasedAt: storedTimestamp.optional(),
		expiredAt: storedTimestamp.optional(),
		createdAt: storedTimestamp,
		updatedAt: storedTimestamp,
	})
	.strict();

const storedResultSchema = z.discriminatedUnion("ok", [
	z
		.object({
			ok: z.literal(true),
			decision: inventoryCheckoutV2Capability.decision,
		})
		.strict(),
	z
		.object({
			ok: z.literal(false),
			failure: inventoryCheckoutV2Capability.failure,
		})
		.strict(),
]);

const storedOperationSchema = z
	.object({
		id: z.string().min(1).max(255),
		reservationId: z.string().min(1).max(255),
		idempotencyKey: identifier,
		operation: z.enum(["reserve", "commit", "release", "expire"]),
		requestSignature: z.string().min(1).max(2_000),
		result: storedResultSchema,
		createdAt: storedTimestamp,
	})
	.strict();

type StoredInventoryItem = z.infer<typeof storedInventoryItemSchema>;
type StoredReservation = z.infer<typeof storedReservationSchema>;

function isLockingTransaction(
	transaction: ModuleDataTransaction,
): transaction is LockingModuleDataTransaction {
	return (
		"getForUpdate" in transaction &&
		typeof transaction.getForUpdate === "function"
	);
}

function encoded(value: string): string {
	return `${value.length}:${value}`;
}

async function stableEntityId(
	prefix: string,
	components: readonly string[],
): Promise<string> {
	const canonical = components.map(encoded).join("|");
	const digest = await globalThis.crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(canonical),
	);
	const hexadecimal = Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
	return `${prefix}_${hexadecimal}`;
}

function reservationId(request: {
	checkoutId: string;
	lineId: string;
}): Promise<string> {
	return stableEntityId("reservation", [request.checkoutId, request.lineId]);
}

function receiptId(id: string, idempotencyKey: string): Promise<string> {
	return stableEntityId("reservation-operation", [id, idempotencyKey]);
}

function inventoryItemId(input: {
	productId: string;
	variantId?: string | undefined;
	locationId?: string | undefined;
}): string {
	return [
		input.productId,
		input.variantId ?? "_",
		input.locationId ?? "_",
	].join(":");
}

function requestSignature(request: InventoryReservationRequest): string {
	if (request.operation === "reserve") {
		return JSON.stringify([
			request.operation,
			request.checkoutId,
			request.lineId,
			request.productId,
			request.variantId ?? null,
			request.locationId ?? null,
			request.quantity,
			request.leaseDurationSeconds,
		]);
	}
	return JSON.stringify([
		request.operation,
		request.checkoutId,
		request.lineId,
	]);
}

function rejected(
	code: InventoryReservationFailure["code"],
	message: string,
): InventoryReservationResult {
	return { ok: false, failure: { code, message } };
}

function reservationView(
	reservation: StoredReservation,
): InventoryReservationDecision["reservation"] {
	return {
		id: reservation.id,
		checkoutId: reservation.checkoutId,
		lineId: reservation.lineId,
		productId: reservation.productId,
		...(reservation.variantId === undefined
			? {}
			: { variantId: reservation.variantId }),
		...(reservation.locationId === undefined
			? {}
			: { locationId: reservation.locationId }),
		quantity: reservation.quantity,
		leaseExpiresAt: reservation.leaseExpiresAt.toISOString(),
		status: reservation.status,
	};
}

function accepted(
	operation: ReservationOperation,
	reservation: StoredReservation,
): InventoryReservationResult {
	return {
		ok: true,
		decision: { operation, reservation: reservationView(reservation) },
	};
}

type SaveReceiptOptions = {
	transaction: LockingModuleDataTransaction;
	request: InventoryReservationRequest;
	id: string;
	result: InventoryReservationResult;
	now: Date;
};

async function saveReceipt(
	options: SaveReceiptOptions,
): Promise<InventoryReservationResult> {
	const { transaction, request, id, result, now } = options;
	const operation = {
		id: await receiptId(id, request.idempotencyKey),
		reservationId: id,
		idempotencyKey: request.idempotencyKey,
		operation: request.operation,
		requestSignature: requestSignature(request),
		result,
		createdAt: now,
	};
	await transaction.upsert(
		"inventoryReservationOperation",
		operation.id,
		operation,
	);
	return result;
}

async function replayReceipt(
	transaction: LockingModuleDataTransaction,
	request: InventoryReservationRequest,
	id: string,
): Promise<InventoryReservationResult | null> {
	const operationId = await receiptId(id, request.idempotencyKey);
	const stored = await transaction.get(
		"inventoryReservationOperation",
		operationId,
	);
	if (!stored) return null;

	const parsed = storedOperationSchema.safeParse(stored);
	if (!parsed.success) {
		return rejected(
			"INVENTORY_STATE_INVALID",
			"The stored reservation operation is invalid.",
		);
	}
	if (parsed.data.requestSignature !== requestSignature(request)) {
		return rejected(
			"IDEMPOTENCY_KEY_REUSED",
			"The idempotency key was already used for a different operation.",
		);
	}
	return parsed.data.result;
}

async function readReservation(
	transaction: LockingModuleDataTransaction,
	id: string,
): Promise<
	| { state: "missing" }
	| { state: "invalid" }
	| { state: "present"; reservation: StoredReservation }
> {
	const stored = await transaction.get("inventoryReservation", id);
	if (!stored) return { state: "missing" };
	const parsed = storedReservationSchema.safeParse(stored);
	return parsed.success
		? { state: "present", reservation: parsed.data }
		: { state: "invalid" };
}

async function lockInventoryItem(
	transaction: LockingModuleDataTransaction,
	input: {
		productId: string;
		variantId?: string | undefined;
		locationId?: string | undefined;
	},
): Promise<
	| { state: "missing" }
	| { state: "invalid" }
	| { state: "present"; item: StoredInventoryItem }
> {
	const stored = await transaction.getForUpdate(
		"inventoryItem",
		inventoryItemId(input),
	);
	if (!stored) return { state: "missing" };
	const parsed = storedInventoryItemSchema.safeParse(stored);
	return parsed.success
		? { state: "present", item: parsed.data }
		: { state: "invalid" };
}

function stockFailure(
	stock: { state: "missing" } | { state: "invalid" },
): InventoryReservationResult {
	return stock.state === "missing"
		? rejected(
				"INVENTORY_ITEM_NOT_FOUND",
				"The requested inventory item is not tracked.",
			)
		: rejected(
				"INVENTORY_STATE_INVALID",
				"The stored inventory item is invalid.",
			);
}

function sameReservedItem(
	reservation: StoredReservation,
	request: Extract<InventoryReservationRequest, { operation: "reserve" }>,
): boolean {
	return (
		reservation.productId === request.productId &&
		reservation.variantId === request.variantId &&
		reservation.locationId === request.locationId &&
		reservation.quantity === request.quantity
	);
}

async function expireReservationState(
	transaction: LockingModuleDataTransaction,
	reservation: StoredReservation,
	now: Date,
): Promise<
	| { ok: true; reservation: StoredReservation }
	| { ok: false; result: InventoryReservationResult }
> {
	const stock = await lockInventoryItem(transaction, reservation);
	if (stock.state !== "present") {
		return { ok: false, result: stockFailure(stock) };
	}
	if (stock.item.reserved < reservation.quantity) {
		return {
			ok: false,
			result: rejected(
				"INVENTORY_STATE_INVALID",
				"Reserved stock is lower than the reservation quantity.",
			),
		};
	}

	const updatedStock = {
		...stock.item,
		reserved: stock.item.reserved - reservation.quantity,
		updatedAt: now,
	};
	const updatedReservation = {
		...reservation,
		status: "expired",
		expiredAt: now,
		updatedAt: now,
	} satisfies StoredReservation;
	await transaction.upsert("inventoryItem", stock.item.id, updatedStock);
	await transaction.upsert(
		"inventoryReservation",
		reservation.id,
		updatedReservation,
	);
	return { ok: true, reservation: updatedReservation };
}

async function reserve(
	transaction: LockingModuleDataTransaction,
	request: Extract<InventoryReservationRequest, { operation: "reserve" }>,
	id: string,
	now: Date,
): Promise<InventoryReservationResult> {
	const storedReservation = await readReservation(transaction, id);
	if (storedReservation.state === "invalid") {
		return saveReceipt({
			transaction,
			request,
			id,
			result: rejected(
				"INVENTORY_STATE_INVALID",
				"The stored reservation is invalid.",
			),
			now,
		});
	}
	if (storedReservation.state === "present") {
		const existing = storedReservation.reservation;
		if (!sameReservedItem(existing, request)) {
			return saveReceipt({
				transaction,
				request,
				id,
				result: rejected(
					"RESERVATION_CONFLICT",
					"The checkout line is already bound to different inventory.",
				),
				now,
			});
		}
		if (existing.status !== "reserved") {
			return saveReceipt({
				transaction,
				request,
				id,
				result: rejected(
					"RESERVATION_NOT_ACTIVE",
					"The reservation can no longer be reserved.",
				),
				now,
			});
		}
		if (existing.leaseExpiresAt.getTime() <= now.getTime()) {
			const expired = await expireReservationState(transaction, existing, now);
			const result = expired.ok
				? rejected("RESERVATION_EXPIRED", "The reservation lease expired.")
				: expired.result;
			return saveReceipt({
				transaction: transaction,
				request: request,
				id: id,
				result: result,
				now: now,
			});
		}
		return saveReceipt({
			transaction,
			request,
			id,
			result: accepted("reserve", existing),
			now,
		});
	}

	const stock = await lockInventoryItem(transaction, request);
	if (stock.state !== "present") {
		return saveReceipt({
			transaction: transaction,
			request: request,
			id: id,
			result: stockFailure(stock),
			now: now,
		});
	}
	const available = Math.max(0, stock.item.quantity - stock.item.reserved);
	// A durable reservation represents stock held now. Backorder permission is a
	// separate merchant policy and cannot make unavailable units reservable.
	if (available < request.quantity) {
		return saveReceipt({
			transaction,
			request,
			id,
			result: rejected(
				"INSUFFICIENT_STOCK",
				"Inventory cannot reserve the requested quantity.",
			),
			now,
		});
	}

	const leaseExpiresAt = new Date(
		now.getTime() + request.leaseDurationSeconds * 1_000,
	);
	const reservation = {
		id,
		checkoutId: request.checkoutId,
		lineId: request.lineId,
		productId: request.productId,
		...(request.variantId === undefined
			? {}
			: { variantId: request.variantId }),
		...(request.locationId === undefined
			? {}
			: { locationId: request.locationId }),
		quantity: request.quantity,
		leaseExpiresAt,
		status: "reserved",
		idempotencyKey: request.idempotencyKey,
		createdAt: now,
		updatedAt: now,
	} satisfies StoredReservation;
	const updatedStock = {
		...stock.item,
		reserved: stock.item.reserved + request.quantity,
		updatedAt: now,
	};
	await transaction.upsert("inventoryItem", stock.item.id, updatedStock);
	await transaction.upsert("inventoryReservation", id, reservation);
	return saveReceipt({
		transaction,
		request,
		id,
		result: accepted("reserve", reservation),
		now,
	});
}

type CommitOptions = {
	transaction: LockingModuleDataTransaction;
	request: Extract<InventoryReservationRequest, { operation: "commit" }>;
	id: string;
	reservation: StoredReservation;
	now: Date;
};

async function commit(
	options: CommitOptions,
): Promise<InventoryReservationResult> {
	const { transaction, request, id, reservation, now } = options;
	if (reservation.status === "committed") {
		return saveReceipt({
			transaction,
			request,
			id,
			result: accepted("commit", reservation),
			now,
		});
	}
	if (reservation.status !== "reserved") {
		return saveReceipt({
			transaction,
			request,
			id,
			result: rejected(
				"RESERVATION_NOT_ACTIVE",
				"Only an active reservation can be committed.",
			),
			now,
		});
	}
	if (reservation.leaseExpiresAt.getTime() <= now.getTime()) {
		const expired = await expireReservationState(transaction, reservation, now);
		const result = expired.ok
			? rejected("RESERVATION_EXPIRED", "The reservation lease expired.")
			: expired.result;
		return saveReceipt({
			transaction: transaction,
			request: request,
			id: id,
			result: result,
			now: now,
		});
	}

	const stock = await lockInventoryItem(transaction, reservation);
	if (stock.state !== "present") {
		return saveReceipt({
			transaction: transaction,
			request: request,
			id: id,
			result: stockFailure(stock),
			now: now,
		});
	}
	if (
		stock.item.reserved < reservation.quantity ||
		stock.item.quantity < reservation.quantity
	) {
		return saveReceipt({
			transaction,
			request,
			id,
			result: rejected(
				"INVENTORY_STATE_INVALID",
				"Inventory cannot commit the reserved quantity.",
			),
			now,
		});
	}

	const updatedStock = {
		...stock.item,
		quantity: stock.item.quantity - reservation.quantity,
		reserved: stock.item.reserved - reservation.quantity,
		updatedAt: now,
	};
	const updatedReservation = {
		...reservation,
		status: "committed",
		committedAt: now,
		updatedAt: now,
	} satisfies StoredReservation;
	await transaction.upsert("inventoryItem", stock.item.id, updatedStock);
	await transaction.upsert("inventoryReservation", id, updatedReservation);
	return saveReceipt({
		transaction,
		request,
		id,
		result: accepted("commit", updatedReservation),
		now,
	});
}

type ReleaseOptions = {
	transaction: LockingModuleDataTransaction;
	request: Extract<InventoryReservationRequest, { operation: "release" }>;
	id: string;
	reservation: StoredReservation;
	now: Date;
};

async function release(
	options: ReleaseOptions,
): Promise<InventoryReservationResult> {
	const { transaction, request, id, reservation, now } = options;
	if (reservation.status === "released") {
		return saveReceipt({
			transaction,
			request,
			id,
			result: accepted("release", reservation),
			now,
		});
	}
	if (reservation.status !== "reserved") {
		return saveReceipt({
			transaction,
			request,
			id,
			result: rejected(
				"RESERVATION_NOT_ACTIVE",
				"Only an active reservation can be released.",
			),
			now,
		});
	}
	if (reservation.leaseExpiresAt.getTime() <= now.getTime()) {
		const expired = await expireReservationState(transaction, reservation, now);
		const result = expired.ok
			? rejected("RESERVATION_EXPIRED", "The reservation lease expired.")
			: expired.result;
		return saveReceipt({
			transaction: transaction,
			request: request,
			id: id,
			result: result,
			now: now,
		});
	}

	const stock = await lockInventoryItem(transaction, reservation);
	if (stock.state !== "present") {
		return saveReceipt({
			transaction: transaction,
			request: request,
			id: id,
			result: stockFailure(stock),
			now: now,
		});
	}
	if (stock.item.reserved < reservation.quantity) {
		return saveReceipt({
			transaction,
			request,
			id,
			result: rejected(
				"INVENTORY_STATE_INVALID",
				"Reserved stock is lower than the reservation quantity.",
			),
			now,
		});
	}

	const updatedStock = {
		...stock.item,
		reserved: stock.item.reserved - reservation.quantity,
		updatedAt: now,
	};
	const updatedReservation = {
		...reservation,
		status: "released",
		releasedAt: now,
		updatedAt: now,
	} satisfies StoredReservation;
	await transaction.upsert("inventoryItem", stock.item.id, updatedStock);
	await transaction.upsert("inventoryReservation", id, updatedReservation);
	return saveReceipt({
		transaction,
		request,
		id,
		result: accepted("release", updatedReservation),
		now,
	});
}

type ExpireOptions = {
	transaction: LockingModuleDataTransaction;
	request: Extract<InventoryReservationRequest, { operation: "expire" }>;
	id: string;
	reservation: StoredReservation;
	now: Date;
};

async function expire(
	options: ExpireOptions,
): Promise<InventoryReservationResult> {
	const { transaction, request, id, reservation, now } = options;
	if (reservation.status === "expired") {
		return saveReceipt({
			transaction,
			request,
			id,
			result: accepted("expire", reservation),
			now,
		});
	}
	if (reservation.status !== "reserved") {
		return saveReceipt({
			transaction,
			request,
			id,
			result: rejected(
				"RESERVATION_NOT_ACTIVE",
				"Only an active reservation can expire.",
			),
			now,
		});
	}
	if (reservation.leaseExpiresAt.getTime() > now.getTime()) {
		return saveReceipt({
			transaction,
			request,
			id,
			result: rejected(
				"LEASE_ACTIVE",
				"The reservation lease is still active.",
			),
			now,
		});
	}

	const expired = await expireReservationState(transaction, reservation, now);
	const result = expired.ok
		? accepted("expire", expired.reservation)
		: expired.result;
	return saveReceipt({
		transaction: transaction,
		request: request,
		id: id,
		result: result,
		now: now,
	});
}

async function executeLocked(
	transaction: LockingModuleDataTransaction,
	request: InventoryReservationRequest,
): Promise<InventoryReservationResult> {
	const id = await reservationId(request);
	await transaction.upsert("inventoryReservationLock", id, { id });
	const lock = await transaction.getForUpdate("inventoryReservationLock", id);
	if (!lock) {
		return rejected(
			"INVENTORY_STATE_INVALID",
			"The reservation lock could not be acquired.",
		);
	}

	const replayed = await replayReceipt(transaction, request, id);
	if (replayed) return replayed;

	const now = new Date();
	if (request.operation === "reserve") {
		return reserve(transaction, request, id, now);
	}

	const storedReservation = await readReservation(transaction, id);
	if (storedReservation.state === "missing") {
		return saveReceipt({
			transaction,
			request,
			id,
			result: rejected(
				"RESERVATION_NOT_FOUND",
				"The reservation was not found.",
			),
			now,
		});
	}
	if (storedReservation.state === "invalid") {
		return saveReceipt({
			transaction,
			request,
			id,
			result: rejected(
				"INVENTORY_STATE_INVALID",
				"The stored reservation is invalid.",
			),
			now,
		});
	}

	if (request.operation === "commit") {
		return commit({
			transaction,
			request,
			id,
			reservation: storedReservation.reservation,
			now,
		});
	}
	if (request.operation === "release") {
		return release({
			transaction,
			request,
			id,
			reservation: storedReservation.reservation,
			now,
		});
	}
	return expire({
		transaction,
		request,
		id,
		reservation: storedReservation.reservation,
		now,
	});
}

/**
 * Execute one reservation transition entirely inside Inventory-owned storage.
 * A runtime without row-locking transactions fails closed instead of mutating
 * stock and reservation records separately.
 */
export async function executeInventoryReservation(
	transactions: ModuleTransactionRunner | undefined,
	request: InventoryReservationRequest,
): Promise<InventoryReservationResult> {
	if (!transactions) {
		return rejected(
			"TRANSACTION_UNAVAILABLE",
			"Inventory reservations require transactional storage.",
		);
	}
	return transactions.transaction((transaction) => {
		if (!isLockingTransaction(transaction)) {
			return Promise.resolve(
				rejected(
					"TRANSACTION_UNAVAILABLE",
					"Inventory reservations require row-locking transactions.",
				),
			);
		}
		return executeLocked(transaction, request);
	});
}
