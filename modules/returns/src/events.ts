import {
	actorReferenceSchema,
	authoritySnapshotSchema,
} from "@86d-app/contracts/command";
import { defineDurableEvent } from "@86d-app/core/durable-events";
import { z } from "zod";

export const returnReasonSnapshotSchema = z.enum([
	"damaged",
	"defective",
	"wrong_item",
	"not_as_described",
	"changed_mind",
	"too_small",
	"too_large",
	"other",
]);

export const returnConditionSnapshotSchema = z.enum([
	"unopened",
	"opened",
	"used",
	"damaged",
]);

export const returnResolutionSchema = z.enum([
	"original_payment",
	"store_credit",
	"exchange",
]);

/** Immutable fact that Returns accepted a quantity-bounded request. */
export const returnRequestedV1 = defineDurableEvent({
	name: "return.requested",
	version: 1,
	owner: "returns",
	payload: z
		.object({
			returnRequestId: z.string().min(1).max(255),
			operationId: z.string().min(8).max(200),
			orderId: z.string().min(1).max(200),
			customerId: z.string().min(1).max(200),
			actor: actorReferenceSchema,
			authority: authoritySnapshotSchema,
			requestedResolution: returnResolutionSchema,
			reasonSnapshot: z.string().min(1).max(1_000),
			items: z
				.array(
					z
						.object({
							orderItemId: z.string().min(1).max(200),
							quantity: z.number().int().positive().max(1_000_000),
							reasonSnapshot: returnReasonSnapshotSchema,
							conditionSnapshot: returnConditionSnapshotSchema,
						})
						.strict(),
				)
				.min(1)
				.max(1_000),
		})
		.strict(),
});
