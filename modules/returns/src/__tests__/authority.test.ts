import { orderLineQuantityValidateCapability } from "@86d-app/core/commerce-capabilities";
import { createMockTransactionRunner } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import {
	type OrderLineQuantityAuthority,
	type RequestReturnInput,
	requestAuthoritativeReturn,
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

function returnInput(
	operationId: string,
	quantity: number,
): RequestReturnInput {
	return {
		operationId,
		orderId: "order-return",
		customerId: "customer-owner",
		actor: { type: "account", id: "account-customer" },
		authority: {
			id: "customer-return-authority",
			type: "custom_role",
			role: "customer",
			permissions: ["return:create"],
			storeId: "store-1",
		},
		requestedResolution: "original_payment",
		reasonSnapshot: "The item arrived damaged.",
		items: [
			{
				orderItemId: "order-line-1",
				quantity,
				reasonSnapshot: "damaged",
				conditionSnapshot: "damaged",
			},
		],
	};
}

describe("authoritative Return requests", () => {
	it("replays a duplicate operation without a second request or durable fact", async () => {
		const transactions = createMockTransactionRunner({ storeId: "store-1" });
		const input = returnInput("return-operation-0001", 1);

		const first = await requestAuthoritativeReturn(input, {
			transactions,
			capabilities: orderLineAuthority(2),
			clock: () => new Date("2026-08-13T12:00:00.000Z"),
		});
		const replay = await requestAuthoritativeReturn(input, { transactions });

		expect(first.replayed).toBe(false);
		expect(replay).toEqual({ request: first.request, replayed: true });
		expect(transactions.data.all("returnAuthorityRequest")).toHaveLength(1);
		expect(transactions.emitted).toEqual([
			expect.objectContaining({
				name: "return.requested",
				payload: expect.objectContaining({
					orderId: "order-return",
					customerId: "customer-owner",
				}),
			}),
		]);
	});

	it("rejects cumulative Return quantities beyond the accepted Order line", async () => {
		const transactions = createMockTransactionRunner();
		const capabilities = orderLineAuthority(2);

		await requestAuthoritativeReturn(returnInput("return-operation-0002", 1), {
			transactions,
			capabilities,
		});

		await expect(
			requestAuthoritativeReturn(returnInput("return-operation-0003", 2), {
				transactions,
				capabilities,
			}),
		).rejects.toMatchObject({ code: "RETURN_QUANTITY_EXCEEDED" });
		expect(transactions.data.all("returnAuthorityRequest")).toHaveLength(1);
		expect(transactions.emitted).toHaveLength(1);
	});

	it("rejects reuse of an operation identity for different input", async () => {
		const transactions = createMockTransactionRunner();
		const capabilities = orderLineAuthority(2);
		await requestAuthoritativeReturn(returnInput("return-operation-0004", 1), {
			transactions,
			capabilities,
		});

		await expect(
			requestAuthoritativeReturn(returnInput("return-operation-0004", 2), {
				transactions,
				capabilities,
			}),
		).rejects.toMatchObject({ code: "RETURN_OPERATION_CONFLICT" });
	});
});
