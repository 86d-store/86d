import { defineDurableEvent } from "@86d-app/core/durable-events";
import { z } from "zod";

/** Authoritative delivery obligation accepted against immutable Order lines. */
export const fulfillmentCreatedV1 = defineDurableEvent({
	name: "fulfillment.created",
	version: 1,
	owner: "fulfillment",
	payload: z
		.object({
			fulfillmentId: z.string().min(1).max(255),
			orderId: z.string().min(1).max(200),
			items: z
				.array(
					z
						.object({
							orderItemId: z.string().min(1).max(200),
							quantity: z.number().int().positive().max(1_000_000),
						})
						.strict(),
				)
				.min(1)
				.max(1_000),
		})
		.strict(),
});
