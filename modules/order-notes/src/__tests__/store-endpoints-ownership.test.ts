import { provideCapability } from "@86d-app/core/capabilities";
import { orderCustomerAuthorizeCapability } from "@86d-app/core/commerce-capabilities";
import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";

const orderCustomerAuthorizeProvider = provideCapability(
	orderCustomerAuthorizeCapability,
	async (ctx, request) => {
		const order = await ctx.data.get("order", request.orderId);
		if (!order) {
			return {
				ok: false,
				failure: { code: "order_not_found" as const },
			};
		}
		if (order.customerId !== request.customerId) {
			return { ok: false, failure: { code: "not_owner" as const } };
		}
		return { ok: true, decision: { authorized: true as const } };
	},
);

async function customerOwnsOrder(
	data: ReturnType<typeof createMockDataService>,
	orderId: string,
	customerId: string,
) {
	if (!customerId) return false;
	const result = await orderCustomerAuthorizeProvider.handle(
		{ data, storeId: "store-1", options: {} },
		{ orderId, customerId },
	);
	return result.ok;
}

describe("customerOwnsOrder", () => {
	let ordersData: ReturnType<typeof createMockDataService>;

	beforeEach(() => {
		ordersData = createMockDataService();
	});

	it("returns true when order belongs to the customer", async () => {
		await ordersData.upsert("order", "order_1", {
			id: "order_1",
			customerId: "cust_1",
			orderNumber: "1001",
		});

		const result = await customerOwnsOrder(ordersData, "order_1", "cust_1");
		expect(result).toBe(true);
	});

	it("returns false when order belongs to a different customer", async () => {
		await ordersData.upsert("order", "order_1", {
			id: "order_1",
			customerId: "cust_1",
			orderNumber: "1001",
		});

		const result = await customerOwnsOrder(ordersData, "order_1", "cust_2");
		expect(result).toBe(false);
	});

	it("returns false when order does not exist", async () => {
		const result = await customerOwnsOrder(
			ordersData,
			"nonexistent_order",
			"cust_1",
		);
		expect(result).toBe(false);
	});

	it("returns false when customerId is empty string", async () => {
		await ordersData.upsert("order", "order_1", {
			id: "order_1",
			customerId: "cust_1",
			orderNumber: "1001",
		});

		const result = await customerOwnsOrder(ordersData, "order_1", "");
		expect(result).toBe(false);
	});

	it("is order-scoped: cust_1 cannot access cust_2's order", async () => {
		await ordersData.upsert("order", "order_a", {
			id: "order_a",
			customerId: "cust_1",
			orderNumber: "1001",
		});
		await ordersData.upsert("order", "order_b", {
			id: "order_b",
			customerId: "cust_2",
			orderNumber: "1002",
		});

		expect(await customerOwnsOrder(ordersData, "order_a", "cust_1")).toBe(true);
		expect(await customerOwnsOrder(ordersData, "order_b", "cust_1")).toBe(
			false,
		);
		expect(await customerOwnsOrder(ordersData, "order_a", "cust_2")).toBe(
			false,
		);
		expect(await customerOwnsOrder(ordersData, "order_b", "cust_2")).toBe(true);
	});
});
