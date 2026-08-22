import { orderLineQuantityValidateCapability } from "@86d-app/core/commerce-capabilities";
import type {
	LockingModuleDataTransaction,
	ModuleDataTransaction,
	ModuleTransactionRunner,
} from "@86d-app/core/durable-events";
import { z } from "zod";
import { fulfillmentCreatedV1 } from "./events";
import type { Fulfillment, FulfillmentItem } from "./service";

const MAX_OBLIGATION_QUANTITY = 1_000_000;

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

const storedFulfillmentAllocationSchema = z
	.object({
		status: z.enum([
			"pending",
			"processing",
			"shipped",
			"delivered",
			"cancelled",
		]),
		items: z
			.array(
				z
					.object({
						lineItemId: z.string().min(1).max(200),
						quantity: z.number().int().positive().max(MAX_OBLIGATION_QUANTITY),
					})
					.strict(),
			)
			.min(1)
			.max(1_000),
	})
	.passthrough();

export type FulfillmentAuthorityErrorCode =
	| "FULFILLMENT_AUTHORITY_UNAVAILABLE"
	| "FULFILLMENT_DATA_INVALID"
	| "FULFILLMENT_QUANTITY_EXCEEDED"
	| "ORDER_LINE_INVALID"
	| "ORDER_NOT_FOUND"
	| "ORDER_NOT_FULFILLABLE";

export class FulfillmentAuthorityError extends Error {
	readonly code: FulfillmentAuthorityErrorCode;

	constructor(code: FulfillmentAuthorityErrorCode, message: string) {
		super(message);
		this.name = "FulfillmentAuthorityError";
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

function normalizeItems(items: readonly FulfillmentItem[]): FulfillmentItem[] {
	const quantities = new Map<string, number>();
	for (const item of items) {
		if (
			item.lineItemId.length < 1 ||
			item.lineItemId.length > 200 ||
			!Number.isSafeInteger(item.quantity) ||
			item.quantity < 1 ||
			item.quantity > MAX_OBLIGATION_QUANTITY
		) {
			throw new FulfillmentAuthorityError(
				"ORDER_LINE_INVALID",
				"Fulfillment items must identify an Order line with a positive quantity.",
			);
		}
		const quantity = (quantities.get(item.lineItemId) ?? 0) + item.quantity;
		if (!Number.isSafeInteger(quantity) || quantity > MAX_OBLIGATION_QUANTITY) {
			throw new FulfillmentAuthorityError(
				"ORDER_LINE_INVALID",
				"Fulfillment line quantity exceeds the supported bound.",
			);
		}
		quantities.set(item.lineItemId, quantity);
	}
	if (quantities.size === 0) {
		throw new FulfillmentAuthorityError(
			"ORDER_LINE_INVALID",
			"Fulfillment must contain at least one Order line.",
		);
	}
	return [...quantities].map(([lineItemId, quantity]) => ({
		lineItemId,
		quantity,
	}));
}

async function lockOrderAllocations(
	transaction: LockingModuleDataTransaction,
	orderId: string,
): Promise<void> {
	await transaction.upsert("fulfillmentOrderLock", orderId, {
		id: orderId,
		orderId,
	});
	const locked = await transaction.getForUpdate(
		"fulfillmentOrderLock",
		orderId,
	);
	if (!locked) {
		throw new FulfillmentAuthorityError(
			"FULFILLMENT_AUTHORITY_UNAVAILABLE",
			"Fulfillment could not lock this Order's delivery obligations.",
		);
	}
}

function mapOrderFailure(code: string): FulfillmentAuthorityError {
	if (code === "ORDER_NOT_FOUND") {
		return new FulfillmentAuthorityError(code, "Order not found.");
	}
	if (code === "ORDER_NOT_FULFILLABLE") {
		return new FulfillmentAuthorityError(
			code,
			"The Order does not accept new delivery obligations.",
		);
	}
	if (
		code === "ORDER_LINE_NOT_FOUND" ||
		code === "ORDER_LINE_QUANTITY_EXCEEDED" ||
		code === "ORDER_LINE_DATA_INVALID"
	) {
		return new FulfillmentAuthorityError(
			"ORDER_LINE_INVALID",
			"A requested delivery obligation does not match the accepted Order lines.",
		);
	}
	return new FulfillmentAuthorityError(
		"FULFILLMENT_AUTHORITY_UNAVAILABLE",
		"Order line validation is unavailable.",
	);
}

function allocatedQuantities(
	rows: readonly Record<string, unknown>[],
): Map<string, number> {
	const quantities = new Map<string, number>();
	for (const row of rows) {
		const parsed = storedFulfillmentAllocationSchema.safeParse(row);
		if (!parsed.success) {
			throw new FulfillmentAuthorityError(
				"FULFILLMENT_DATA_INVALID",
				"Stored Fulfillment obligations are invalid.",
			);
		}
		if (parsed.data.status === "cancelled") continue;
		for (const item of parsed.data.items) {
			const quantity = (quantities.get(item.lineItemId) ?? 0) + item.quantity;
			if (!Number.isSafeInteger(quantity)) {
				throw new FulfillmentAuthorityError(
					"FULFILLMENT_DATA_INVALID",
					"Stored Fulfillment quantities exceed safe integer bounds.",
				);
			}
			quantities.set(item.lineItemId, quantity);
		}
	}
	return quantities;
}

export async function createAuthoritativeFulfillment(input: {
	capabilities?: OrderLineQuantityAuthority | undefined;
	transactions?: ModuleTransactionRunner | undefined;
	orderId: string;
	items: readonly FulfillmentItem[];
	notes?: string | undefined;
}): Promise<Fulfillment> {
	const { capabilities, transactions } = input;
	if (!capabilities || !transactions) {
		throw new FulfillmentAuthorityError(
			"FULFILLMENT_AUTHORITY_UNAVAILABLE",
			"Fulfillment requires Order capability and transactional storage.",
		);
	}
	const items = normalizeItems(input.items);

	return transactions.transaction(async (transaction) => {
		if (!isLockingTransaction(transaction)) {
			throw new FulfillmentAuthorityError(
				"FULFILLMENT_AUTHORITY_UNAVAILABLE",
				"Fulfillment requires row-locking transactional storage.",
			);
		}
		await lockOrderAllocations(transaction, input.orderId);

		const validation = await capabilities.invoke(
			orderLineQuantityValidateCapability,
			{
				orderId: input.orderId,
				items: items.map((item) => ({
					orderItemId: item.lineItemId,
					quantity: item.quantity,
				})),
			},
		);
		if (!validation.ok) {
			throw mapOrderFailure(validation.failure.code);
		}

		const existing = await transaction.findMany("fulfillment", {
			where: { orderId: input.orderId },
		});
		const allocated = allocatedQuantities(existing);
		for (const item of validation.decision.items) {
			const total =
				(allocated.get(item.orderItemId) ?? 0) + item.requestedQuantity;
			if (!Number.isSafeInteger(total) || total > item.orderedQuantity) {
				throw new FulfillmentAuthorityError(
					"FULFILLMENT_QUANTITY_EXCEEDED",
					"Cumulative active Fulfillment obligations exceed the Order line quantity.",
				);
			}
		}

		const now = new Date();
		const fulfillment = {
			id: crypto.randomUUID(),
			orderId: input.orderId,
			status: "pending",
			items,
			...(input.notes !== undefined ? { notes: input.notes } : {}),
			createdAt: now,
			updatedAt: now,
		} satisfies Fulfillment;
		await transaction.upsert("fulfillment", fulfillment.id, fulfillment);
		await transaction.emit(fulfillmentCreatedV1, {
			aggregate: { type: "fulfillment", id: fulfillment.id },
			occurredAt: now,
			payload: {
				fulfillmentId: fulfillment.id,
				orderId: fulfillment.orderId,
				items: fulfillment.items.map((item) => ({
					orderItemId: item.lineItemId,
					quantity: item.quantity,
				})),
			},
		});
		return fulfillment;
	});
}
