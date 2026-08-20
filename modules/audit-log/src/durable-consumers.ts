import {
	consumeDurableEvent,
	inventoryStockAdjustedV1,
} from "@86d-app/core/durable-events";
import type { AuditEntry } from "./service";

/** Stable identity for this consumer's registration and dedupe receipts. */
export const INVENTORY_STOCK_ADJUSTED_CONSUMER =
	"audit-log.inventory-stock-adjusted.v1";

function describe(payload: {
	productId: string;
	variantId?: string | undefined;
	delta: number;
	quantity: number;
}): string {
	const item = payload.variantId
		? `${payload.productId}/${payload.variantId}`
		: payload.productId;
	const direction =
		payload.delta >= 0 ? `+${payload.delta}` : `${payload.delta}`;
	return `Stock for ${item} adjusted by ${direction} to ${payload.quantity}.`;
}

/**
 * Record an audit entry for a completed stock adjustment.
 *
 * The entry is keyed by the durable event ID, so an at-least-once redelivery
 * rewrites the same row instead of creating a second audit record. The Audit Log
 * never becomes the authority for stock; Inventory owns that.
 */
export const inventoryStockAdjustedAudit = consumeDurableEvent({
	consumer: INVENTORY_STOCK_ADJUSTED_CONSUMER,
	owner: "audit-log",
	definition: inventoryStockAdjustedV1,
	handle: async (context, event) => {
		const entry: AuditEntry = {
			id: event.id,
			action: "update",
			resource: "inventory",
			resourceId: event.aggregate.id,
			actorType: "system",
			description: describe(event.payload),
			changes: {
				delta: event.payload.delta,
				quantity: event.payload.quantity,
				reserved: event.payload.reserved,
				available: event.payload.available,
			},
			metadata: {
				sourceModule: event.sourceModule,
				eventName: event.name,
				eventVersion: event.version,
				aggregateSequence: event.aggregate.sequence,
			},
			createdAt: event.occurredAt,
		};
		await context.data.upsert(
			"auditEntry",
			event.id,
			entry as unknown as Record<string, unknown>,
		);
	},
});
