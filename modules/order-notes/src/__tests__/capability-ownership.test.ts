import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it, vi } from "vitest";
import { createOrderNotesController } from "../service-impl";
import { addNote } from "../store/endpoints/add-note";

function extractHandler(endpoint: unknown) {
	return endpoint as (ctx: Record<string, unknown>) => Promise<unknown>;
}

describe("order-note capability ownership", () => {
	it("does not write a note when order authorization is unavailable", async () => {
		const controller = createOrderNotesController(createMockDataService());
		const add = vi.spyOn(controller, "addNote");
		const result = await extractHandler(addNote)({
			params: { orderId: "order-1" },
			body: { content: "Where is it?" },
			context: {
				controllers: { orderNotes: controller },
				capabilities: {
					invoke: vi.fn().mockResolvedValue({
						ok: false,
						failure: {
							code: "CAPABILITY_UNAVAILABLE",
							capability: "orders.customer.authorize",
							version: "1.0.0",
						},
					}),
				},
				session: { user: { id: "customer-1", name: "A", email: "a@b.co" } },
			},
		});

		expect(result).toEqual({
			code: "ORDER_AUTHORIZATION_UNAVAILABLE",
			error: "Order authorization is unavailable.",
			status: 503,
		});
		expect(add).not.toHaveBeenCalled();
	});
});
