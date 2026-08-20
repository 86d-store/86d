import { orderLineQuantityValidateCapability } from "@86d-app/core/commerce-capabilities";
import { createMockTransactionRunner } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import {
	createAuthoritativeFulfillment,
	FulfillmentAuthorityError,
	type OrderLineQuantityAuthority,
} from "../authority";

function orderLineAuthority(
	orderedQuantity: number,
): OrderLineQuantityAuthority {
	return {
		async invoke(_definition, request) {
			const validated =
				orderLineQuantityValidateCapability.request.parse(request);
			return {
				ok: true,
				decision: orderLineQuantityValidateCapability.decision.parse({
					orderId: validated.orderId,
					items: validated.items.map((item) => ({
						orderItemId: item.orderItemId,
						requestedQuantity: item.quantity,
						orderedQuantity,
					})),
				}),
			};
		},
	};
}

describe("authoritative Fulfillment obligations", () => {
	it("supports split obligations without exceeding the accepted Order line", async () => {
		const transactions = createMockTransactionRunner({ storeId: "store-1" });
		const capabilities = orderLineAuthority(3);

		const first = await createAuthoritativeFulfillment({
			transactions,
			capabilities,
			orderId: "order-split",
			items: [{ lineItemId: "order-line-1", quantity: 2 }],
		});
		const second = await createAuthoritativeFulfillment({
			transactions,
			capabilities,
			orderId: "order-split",
			items: [{ lineItemId: "order-line-1", quantity: 1 }],
		});

		expect(first.id).not.toBe(second.id);
		expect(transactions.data.all("fulfillment")).toHaveLength(2);
		expect(transactions.emitted).toEqual([
			expect.objectContaining({
				name: "fulfillment.created",
				payload: expect.objectContaining({ orderId: "order-split" }),
			}),
			expect.objectContaining({
				name: "fulfillment.created",
				payload: expect.objectContaining({ orderId: "order-split" }),
			}),
		]);

		await expect(
			createAuthoritativeFulfillment({
				transactions,
				capabilities,
				orderId: "order-split",
				items: [{ lineItemId: "order-line-1", quantity: 1 }],
			}),
		).rejects.toMatchObject({
			code: "FULFILLMENT_QUANTITY_EXCEEDED",
		});
		expect(transactions.data.all("fulfillment")).toHaveLength(2);
		expect(transactions.emitted).toHaveLength(2);
	});

	it("fails closed without both the Order decision and owner transaction", async () => {
		await expect(
			createAuthoritativeFulfillment({
				orderId: "order-1",
				items: [{ lineItemId: "line-1", quantity: 1 }],
			}),
		).rejects.toBeInstanceOf(FulfillmentAuthorityError);

		await expect(
			createAuthoritativeFulfillment({
				transactions: createMockTransactionRunner(),
				orderId: "order-1",
				items: [{ lineItemId: "line-1", quantity: 1 }],
			}),
		).rejects.toMatchObject({ code: "FULFILLMENT_AUTHORITY_UNAVAILABLE" });
	});
});
