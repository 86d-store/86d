import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type {
	CreateReturnItemParams,
	ReturnController,
	ReturnRequestWithItems,
} from "../service";
import { createReturnController } from "../service-impl";

/**
 * Store endpoint integration tests for the returns module.
 *
 * All store endpoints require authentication. Tests verify:
 *
 * 1. submit-return — auth, order ownership, refund amount calculation, item validation
 * 2. get-return — auth, ownership (customerId check), 404-not-403
 * 3. list-returns — auth, scoped to customer, pagination
 * 4. cancel-return — auth, ownership, status restrictions
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Helpers ─────────────────────────────────────────────────────────────

function returnItemParams(
	overrides: Partial<CreateReturnItemParams> = {},
): CreateReturnItemParams {
	return {
		orderItemId: "item_1",
		productName: "Widget",
		quantity: 1,
		unitPrice: 2500,
		reason: "defective",
		...overrides,
	};
}

async function seedReturn(
	controller: ReturnController,
	overrides: {
		orderId?: string;
		customerId?: string;
		reason?: string;
		items?: CreateReturnItemParams[];
	} = {},
) {
	return controller.create({
		orderId: overrides.orderId ?? "order_1",
		customerId: overrides.customerId ?? "cust_1",
		reason: overrides.reason ?? "Item was defective",
		items: overrides.items ?? [returnItemParams()],
	});
}

// ── Simulate endpoint logic ─────────────────────────────────────────────

async function simulateSubmitReturn(
	controller: ReturnController,
	body: {
		orderId: string;
		reason: string;
		refundMethod?: "original_payment" | "store_credit" | "exchange";
		customerNotes?: string;
		items: CreateReturnItemParams[];
	},
	session: { userId: string } | null,
	orderCtrl?: {
		getById(id: string): Promise<{ customerId?: string } | null>;
	},
) {
	if (!session) return { error: "Unauthorized", status: 401 };

	// Verify order ownership (mirrors endpoint logic)
	if (orderCtrl) {
		const order = await orderCtrl.getById(body.orderId);
		if (!order || order.customerId !== session.userId) {
			return { error: "Order not found", status: 404 };
		}
	}

	if (body.items.length === 0) {
		return { error: "At least one item is required", status: 400 };
	}

	const returnRequest = await controller.create({
		orderId: body.orderId,
		customerId: session.userId,
		reason: body.reason,
		refundMethod: body.refundMethod,
		customerNotes: body.customerNotes,
		items: body.items,
	});

	return { return: returnRequest };
}

async function simulateGetReturn(
	controller: ReturnController,
	returnId: string,
	session: { userId: string } | null,
) {
	if (!session) return { error: "Unauthorized", status: 401 };
	const returnRequest = await controller.getById(returnId);
	if (!returnRequest || returnRequest.customerId !== session.userId) {
		return { error: "Not found", status: 404 };
	}
	return { return: returnRequest };
}

async function simulateListReturns(
	controller: ReturnController,
	query: { take?: number; skip?: number },
	session: { userId: string } | null,
) {
	if (!session) return { error: "Unauthorized", status: 401 };
	const take = Math.min(query.take ?? 20, 50);
	const skip = query.skip ?? 0;
	const returns = await controller.getByCustomerId(session.userId, {
		take,
		skip,
	});
	return { returns };
}

async function simulateCancelReturn(
	controller: ReturnController,
	returnId: string,
	session: { userId: string } | null,
) {
	if (!session) return { error: "Unauthorized", status: 401 };
	const existing = await controller.getById(returnId);
	if (!existing || existing.customerId !== session.userId) {
		return { error: "Not found", status: 404 };
	}
	const result = await controller.cancel(returnId);
	return { return: result };
}

// ── Tests ───────────────────────────────────────────────────────────────

let data: DataService;
let controller: ReturnController;

beforeEach(() => {
	data = createMockDataService();
	controller = createReturnController(data);
});

describe("submit-return (POST /returns/submit)", () => {
	it("requires authentication", async () => {
		const result = await simulateSubmitReturn(
			controller,
			{
				orderId: "order_1",
				reason: "defective",
				items: [returnItemParams()],
			},
			null,
		);
		expect(result).toEqual({ error: "Unauthorized", status: 401 });
	});

	it("creates a return request with correct refund amount", async () => {
		const result = await simulateSubmitReturn(
			controller,
			{
				orderId: "order_1",
				reason: "Item arrived broken",
				items: [
					returnItemParams({ unitPrice: 2500, quantity: 2 }),
					returnItemParams({
						orderItemId: "item_2",
						productName: "Gadget",
						unitPrice: 1000,
						quantity: 1,
					}),
				],
			},
			{ userId: "cust_1" },
		);
		expect("return" in result).toBe(true);
		if ("return" in result && result.return) {
			const ret = result.return as ReturnRequestWithItems;
			expect(ret.status).toBe("requested");
			expect(ret.customerId).toBe("cust_1");
			expect(ret.refundAmount).toBe(6000); // 2500*2 + 1000*1
			expect(ret.items).toHaveLength(2);
		}
	});

	it("defaults refundMethod to original_payment", async () => {
		const result = await simulateSubmitReturn(
			controller,
			{
				orderId: "order_1",
				reason: "Wrong item",
				items: [returnItemParams()],
			},
			{ userId: "cust_1" },
		);
		if ("return" in result && result.return) {
			const ret = result.return as ReturnRequestWithItems;
			expect(ret.refundMethod).toBe("original_payment");
		}
	});

	it("accepts store_credit refund method", async () => {
		const result = await simulateSubmitReturn(
			controller,
			{
				orderId: "order_1",
				reason: "Changed mind",
				refundMethod: "store_credit",
				items: [returnItemParams()],
			},
			{ userId: "cust_1" },
		);
		if ("return" in result && result.return) {
			const ret = result.return as ReturnRequestWithItems;
			expect(ret.refundMethod).toBe("store_credit");
		}
	});

	it("verifies order ownership when order controller is available", async () => {
		const mockOrderCtrl = {
			async getById(id: string) {
				if (id === "order_1") return { customerId: "cust_1" };
				return null;
			},
		};

		// Owner can submit
		const ok = await simulateSubmitReturn(
			controller,
			{
				orderId: "order_1",
				reason: "defective",
				items: [returnItemParams()],
			},
			{ userId: "cust_1" },
			mockOrderCtrl,
		);
		expect("return" in ok).toBe(true);

		// Non-owner gets 404
		const denied = await simulateSubmitReturn(
			controller,
			{
				orderId: "order_1",
				reason: "defective",
				items: [returnItemParams()],
			},
			{ userId: "cust_2" },
			mockOrderCtrl,
		);
		expect(denied).toEqual({ error: "Order not found", status: 404 });
	});

	it("returns 404 for non-existent order", async () => {
		const mockOrderCtrl = {
			async getById(_id: string) {
				return null;
			},
		};

		const result = await simulateSubmitReturn(
			controller,
			{
				orderId: "nonexistent",
				reason: "defective",
				items: [returnItemParams()],
			},
			{ userId: "cust_1" },
			mockOrderCtrl,
		);
		expect(result).toEqual({ error: "Order not found", status: 404 });
	});
});

describe("get-return (GET /returns/:id)", () => {
	it("requires authentication", async () => {
		const result = await simulateGetReturn(controller, "any", null);
		expect(result).toEqual({ error: "Unauthorized", status: 401 });
	});

	it("returns the return request for the owner", async () => {
		const created = await seedReturn(controller, {
			customerId: "cust_1",
		});
		const result = await simulateGetReturn(controller, created.id, {
			userId: "cust_1",
		});
		expect("return" in result).toBe(true);
		if ("return" in result && result.return) {
			const ret = result.return as ReturnRequestWithItems;
			expect(ret.id).toBe(created.id);
			expect(ret.items).toHaveLength(1);
		}
	});

	it("returns 404 for another customer's return (not 403)", async () => {
		const created = await seedReturn(controller, {
			customerId: "cust_1",
		});
		const result = await simulateGetReturn(controller, created.id, {
			userId: "cust_2",
		});
		expect(result).toEqual({ error: "Not found", status: 404 });
	});

	it("returns 404 for non-existent return", async () => {
		const result = await simulateGetReturn(controller, "nonexistent", {
			userId: "cust_1",
		});
		expect(result).toEqual({ error: "Not found", status: 404 });
	});
});

describe("list-returns (GET /returns)", () => {
	it("requires authentication", async () => {
		const result = await simulateListReturns(controller, {}, null);
		expect(result).toEqual({ error: "Unauthorized", status: 401 });
	});

	it("returns only the authenticated customer's returns", async () => {
		await seedReturn(controller, { customerId: "cust_1" });
		await seedReturn(controller, { customerId: "cust_1" });
		await seedReturn(controller, { customerId: "cust_2" });

		const result = await simulateListReturns(
			controller,
			{},
			{
				userId: "cust_1",
			},
		);
		expect("returns" in result).toBe(true);
		if ("returns" in result) {
			expect(result.returns).toHaveLength(2);
		}
	});

	it("paginates with take/skip", async () => {
		for (let i = 0; i < 5; i++) {
			await seedReturn(controller, {
				customerId: "cust_1",
				orderId: `order_${i}`,
			});
		}

		const page1 = await simulateListReturns(
			controller,
			{ take: 2, skip: 0 },
			{ userId: "cust_1" },
		);
		if ("returns" in page1) {
			expect(page1.returns).toHaveLength(2);
		}

		const page3 = await simulateListReturns(
			controller,
			{ take: 2, skip: 4 },
			{ userId: "cust_1" },
		);
		if ("returns" in page3) {
			expect(page3.returns).toHaveLength(1);
		}
	});

	it("returns empty list for customer with no returns", async () => {
		const result = await simulateListReturns(
			controller,
			{},
			{
				userId: "cust_999",
			},
		);
		if ("returns" in result) {
			expect(result.returns).toHaveLength(0);
		}
	});
});

describe("cancel-return (POST /returns/:id/cancel)", () => {
	it("requires authentication", async () => {
		const result = await simulateCancelReturn(controller, "any", null);
		expect(result).toEqual({ error: "Unauthorized", status: 401 });
	});

	it("cancels a requested return", async () => {
		const created = await seedReturn(controller, {
			customerId: "cust_1",
		});
		const result = await simulateCancelReturn(controller, created.id, {
			userId: "cust_1",
		});
		expect("return" in result).toBe(true);
		if ("return" in result && result.return) {
			expect(result.return.status).toBe("cancelled");
		}
	});

	it("cancels an approved return", async () => {
		const created = await seedReturn(controller, {
			customerId: "cust_1",
		});
		await controller.approve(created.id);

		const result = await simulateCancelReturn(controller, created.id, {
			userId: "cust_1",
		});
		if ("return" in result && result.return) {
			expect(result.return.status).toBe("cancelled");
		}
	});

	it("throws when cancelling a completed return", async () => {
		const created = await seedReturn(controller, {
			customerId: "cust_1",
		});
		await controller.approve(created.id);
		await controller.complete(created.id, 2500);

		await expect(
			simulateCancelReturn(controller, created.id, {
				userId: "cust_1",
			}),
		).rejects.toThrow(/Cannot cancel/);
	});

	it("returns 404 for another customer's return", async () => {
		const created = await seedReturn(controller, {
			customerId: "cust_1",
		});
		const result = await simulateCancelReturn(controller, created.id, {
			userId: "cust_2",
		});
		expect(result).toEqual({ error: "Not found", status: 404 });
	});
});

describe("cross-endpoint lifecycle", () => {
	it("submit → get → list → cancel flow", async () => {
		const session = { userId: "cust_1" };

		// Submit
		const submitted = await simulateSubmitReturn(
			controller,
			{
				orderId: "order_1",
				reason: "Wrong color",
				customerNotes: "Expected blue, got red",
				items: [
					returnItemParams({
						productName: "T-Shirt",
						unitPrice: 3000,
						reason: "wrong_item",
					}),
				],
			},
			session,
		);
		expect("return" in submitted).toBe(true);
		const returnId = (submitted as { return: ReturnRequestWithItems }).return
			.id;

		// Get
		const fetched = await simulateGetReturn(controller, returnId, session);
		expect("return" in fetched).toBe(true);
		if ("return" in fetched && fetched.return) {
			const ret = fetched.return as ReturnRequestWithItems;
			expect(ret.reason).toBe("Wrong color");
			expect(ret.refundAmount).toBe(3000);
		}

		// List
		const listed = await simulateListReturns(controller, {}, session);
		if ("returns" in listed) {
			expect(listed.returns).toHaveLength(1);
		}

		// Cancel
		const cancelled = await simulateCancelReturn(controller, returnId, session);
		if ("return" in cancelled && cancelled.return) {
			expect(cancelled.return.status).toBe("cancelled");
		}

		// Verify still visible after cancellation
		const afterCancel = await simulateGetReturn(controller, returnId, session);
		if ("return" in afterCancel && afterCancel.return) {
			const ret = afterCancel.return as ReturnRequestWithItems;
			expect(ret.status).toBe("cancelled");
		}
	});
});
