import type {
	ActorReference,
	AuthoritySnapshot,
} from "@86d-app/contracts/command";
import {
	inventoryStockAdjustedV2,
	type LockingModuleDataTransaction,
} from "@86d-app/core/durable-events";
import { z } from "zod";

const resourceIdentifier = z.string().min(1).max(200);
const traceIdentifier = z.string().min(1).max(255);

export const inventoryStockAdjustInputSchema = z
	.object({
		productId: resourceIdentifier,
		variantId: resourceIdentifier.optional(),
		locationId: resourceIdentifier.optional(),
		delta: z.number().int().min(-1_000_000).max(1_000_000),
		correlationId: traceIdentifier,
		causationId: traceIdentifier.optional(),
	})
	.strict()
	.superRefine((input, context) => {
		if (inventoryItemId(input).length > 255) {
			context.addIssue({
				code: "custom",
				message: "The combined inventory item identity is too long.",
				path: ["productId"],
			});
		}
	});

export const inventoryStockAdjustOutcomeSchema = z
	.object({
		operationId: z.string().min(8).max(200),
		correlationId: traceIdentifier,
		causationId: traceIdentifier.optional(),
		productId: resourceIdentifier,
		variantId: resourceIdentifier.optional(),
		locationId: resourceIdentifier.optional(),
		requestedDelta: z.number().int(),
		appliedDelta: z.number().int(),
		quantity: z.number().int().nonnegative(),
		reserved: z.number().int().nonnegative(),
		available: z.number().int().nonnegative(),
	})
	.strict();

export type InventoryStockAdjustInput = z.infer<
	typeof inventoryStockAdjustInputSchema
>;
export type InventoryStockAdjustOutcome = z.infer<
	typeof inventoryStockAdjustOutcomeSchema
>;

export type InventoryStockAdjustContext = Readonly<{
	executionId: string;
	operationId: string;
	actor: ActorReference;
	authority: AuthoritySnapshot;
	occurredAt: Date;
}>;

export type InventoryStockAdjustResult =
	| { ok: true; outcome: InventoryStockAdjustOutcome }
	| { ok: false; reason: "invalid_state" | "not_found" };

const storedInventoryItemSchema = z
	.object({
		id: z.string().min(1).max(255),
		productId: resourceIdentifier,
		variantId: resourceIdentifier.optional(),
		locationId: resourceIdentifier.optional(),
		productName: z.string().max(500).optional(),
		variantName: z.string().max(500).optional(),
		quantity: z.number().int().nonnegative(),
		reserved: z.number().int().nonnegative(),
		lowStockThreshold: z.number().int().nonnegative().optional(),
		allowBackorder: z.boolean(),
		createdAt: z.union([z.date(), z.string().datetime()]),
		updatedAt: z.union([z.date(), z.string().datetime()]),
	})
	.strict();

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

/**
 * Inventory-owned adapter for the `inventory.stock.adjust` Store Command.
 * The caller supplies an owner-local transaction already opened by Command
 * persistence, so the stock row, outbox fact, Command receipt, and audit result
 * share one database commit.
 */
export async function adjustInventoryStockFromCommand(
	transaction: LockingModuleDataTransaction,
	input: InventoryStockAdjustInput,
	context: InventoryStockAdjustContext,
): Promise<InventoryStockAdjustResult> {
	const id = inventoryItemId(input);
	const stored = await transaction.getForUpdate("inventoryItem", id);
	if (!stored) {
		return { ok: false, reason: "not_found" };
	}
	const parsed = storedInventoryItemSchema.safeParse(stored);
	if (!parsed.success) {
		return { ok: false, reason: "invalid_state" };
	}
	if (parsed.data.reserved > parsed.data.quantity) {
		return { ok: false, reason: "invalid_state" };
	}

	// Completed reservations own real units. Administrative shrinkage may consume
	// only unreserved stock; otherwise a later commit could lose its held units.
	const quantity = Math.max(
		parsed.data.reserved,
		parsed.data.quantity + input.delta,
	);
	const appliedDelta = quantity - parsed.data.quantity;
	const available = Math.max(0, quantity - parsed.data.reserved);
	const updated = {
		...parsed.data,
		createdAt:
			parsed.data.createdAt instanceof Date
				? parsed.data.createdAt
				: new Date(parsed.data.createdAt),
		updatedAt: context.occurredAt,
		quantity,
	};

	await transaction.upsert("inventoryItem", id, updated);
	await transaction.emit(inventoryStockAdjustedV2, {
		aggregate: { type: "inventory-item", id },
		occurredAt: context.occurredAt,
		payload: {
			productId: input.productId,
			...(input.variantId === undefined ? {} : { variantId: input.variantId }),
			...(input.locationId === undefined
				? {}
				: { locationId: input.locationId }),
			delta: appliedDelta,
			quantity,
			reserved: parsed.data.reserved,
			available,
			command: {
				executionId: context.executionId,
				operationId: context.operationId,
				correlationId: input.correlationId,
				...(input.causationId === undefined
					? {}
					: { causationId: input.causationId }),
				actor: context.actor,
				authorityId: context.authority.id,
			},
		},
	});

	return {
		ok: true,
		outcome: {
			operationId: context.operationId,
			correlationId: input.correlationId,
			...(input.causationId === undefined
				? {}
				: { causationId: input.causationId }),
			productId: input.productId,
			...(input.variantId === undefined ? {} : { variantId: input.variantId }),
			...(input.locationId === undefined
				? {}
				: { locationId: input.locationId }),
			requestedDelta: input.delta,
			appliedDelta,
			quantity,
			reserved: parsed.data.reserved,
			available,
		},
	};
}
