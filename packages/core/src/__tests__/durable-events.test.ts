import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import {
	consumeDurableEvent,
	type DurableEventEnvelope,
	type DurableEventPayload,
	defineDurableEvent,
} from "../durable-events";

const inventoryAdjusted = defineDurableEvent({
	name: "inventory.adjusted",
	version: 1,
	owner: "inventory",
	payload: z
		.object({
			productId: z.string().min(1),
			delta: z.number().int(),
			quantity: z.number().int().nonnegative(),
		})
		.strict(),
});

describe("durable event contracts", () => {
	it("preserves literal identity and infers payload and envelope types", () => {
		type Payload = DurableEventPayload<typeof inventoryAdjusted>;
		type Envelope = DurableEventEnvelope<typeof inventoryAdjusted>;

		expectTypeOf<Payload>().toEqualTypeOf<{
			productId: string;
			delta: number;
			quantity: number;
		}>();
		expectTypeOf<Envelope["name"]>().toEqualTypeOf<"inventory.adjusted">();
		expectTypeOf<Envelope["version"]>().toEqualTypeOf<1>();
		expectTypeOf<Envelope["sourceModule"]>().toEqualTypeOf<"inventory">();
	});

	it("validates payloads at the contract seam", () => {
		expect(
			inventoryAdjusted.payload.safeParse({
				productId: "product-1",
				delta: 4,
				quantity: 9,
			}),
		).toMatchObject({ success: true });
		expect(
			inventoryAdjusted.payload.safeParse({
				productId: "product-1",
				delta: 4,
				quantity: 9,
				shopperEmail: "must-not-pass@example.com",
			}),
		).toMatchObject({ success: false });
	});

	it("binds a stable consumer identity to one accepted event version", () => {
		const consumer = consumeDurableEvent({
			consumer: "audit-log.inventory-adjusted.v1",
			owner: "audit-log",
			definition: inventoryAdjusted,
			handle: async (_context, event) => {
				expectTypeOf(event.payload).toEqualTypeOf<{
					productId: string;
					delta: number;
					quantity: number;
				}>();
			},
		});

		expect(consumer.consumer).toBe("audit-log.inventory-adjusted.v1");
		expect(consumer.owner).toBe("audit-log");
		expect(consumer.definition).toBe(inventoryAdjusted);
	});
});
