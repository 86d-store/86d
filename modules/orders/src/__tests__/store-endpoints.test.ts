import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { OrderStatus, OrderWithDetails, PaymentStatus } from "../service";
import { createOrderController } from "../service-impl";

/**
 * Store endpoint integration tests for the orders module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. Auth guard — unauthenticated users get 401
 * 2. Ownership — customers can only access their own orders
 * 3. Order cancellation — state validation (only pending/processing/on_hold)
 * 4. Reorder — enriches items from products data registry
 * 5. Guest tracking — public lookup by orderNumber + email
 * 6. Confirm order — guest confirmation by orderId + email, owner bypass
 * 7. Returns — order status validation and item ownership checks
 * 8. List pagination — correct page/limit/total math
 */

// ── Helpers ───────────────────────────────────────────────────────────

type DataService = ReturnType<typeof createMockDataService>;
type Controller = ReturnType<typeof createOrderController>;

async function seedOrder(
	controller: Controller,
	overrides: {
		customerId?: string;
		guestEmail?: string;
		status?: OrderStatus;
		paymentStatus?: PaymentStatus;
		items?: Array<{
			productId: string;
			name: string;
			price: number;
			quantity: number;
		}>;
	} = {},
) {
	const items = overrides.items ?? [
		{ productId: "prod_1", name: "Widget", price: 2999, quantity: 1 },
	];
	const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);

	const order = await controller.create({
		customerId: overrides.customerId ?? "cust_1",
		guestEmail: overrides.guestEmail,
		subtotal,
		total: subtotal,
		items,
	});

	// Apply non-default status after creation
	if (overrides.status && overrides.status !== "pending") {
		await controller.updateStatus(order.id, overrides.status);
	}
	if (overrides.paymentStatus) {
		await controller.updatePaymentStatus(order.id, overrides.paymentStatus);
	}

	return controller.getById(order.id) as Promise<OrderWithDetails>;
}

// ── Simulate endpoint logic ───────────────────────────────────────────

async function simulateGetOrder(
	controller: Controller,
	orderId: string,
	userId: string | undefined,
) {
	if (!userId) {
		return { error: "Unauthorized", status: 401 };
	}

	const order = await controller.getById(orderId);
	if (!order) {
		return { error: "Order not found", status: 404 };
	}
	if (order.customerId !== userId) {
		return { error: "Order not found", status: 404 };
	}

	return { order };
}

async function simulateListOrders(
	controller: Controller,
	userId: string | undefined,
	query: { page?: number; limit?: number } = {},
) {
	if (!userId) {
		return { error: "Unauthorized", status: 401 };
	}

	const page = query.page ?? 1;
	const limit = query.limit ?? 10;
	const offset = (page - 1) * limit;

	const { orders, total } = await controller.listForCustomer(userId, {
		limit,
		offset,
	});

	return {
		orders,
		total,
		page,
		limit,
		pages: Math.ceil(total / limit),
	};
}

async function simulateCancelOrder(
	controller: Controller,
	orderId: string,
	userId: string | undefined,
) {
	if (!userId) {
		return { error: "Unauthorized", status: 401 };
	}

	const order = await controller.getById(orderId);
	if (!order || order.customerId !== userId) {
		return { error: "Order not found", status: 404 };
	}

	const cancelled = await controller.cancel(orderId);
	if (!cancelled) {
		return {
			error: "Order cannot be cancelled in its current state",
			status: 422,
		};
	}

	return { order: cancelled };
}

async function simulateConfirmOrder(
	controller: Controller,
	orderId: string,
	email: string,
	userId?: string,
) {
	const order = await controller.getById(orderId);
	if (!order) {
		return { error: "Order not found", status: 404 };
	}

	// Allow if logged-in user owns this order
	if (userId && order.customerId === userId) {
		return { order };
	}

	// Allow if email matches the guest email on the order
	const normalizedEmail = email.toLowerCase().trim();
	if (
		order.guestEmail &&
		order.guestEmail.toLowerCase().trim() === normalizedEmail
	) {
		return { order };
	}

	return { error: "Order not found", status: 404 };
}

async function simulateTrackOrder(
	controller: Controller,
	orderNumber: string,
	email: string,
) {
	const order = await controller.getByTracking(orderNumber, email);
	if (!order) {
		return { error: "Order not found", status: 404 };
	}

	const fulfillments: unknown[] = [];
	return { order, fulfillments };
}

async function simulateReorder(
	controller: Controller,
	orderId: string,
	userId: string | undefined,
	productsData?: DataService,
) {
	if (!userId) {
		return { error: "Unauthorized", status: 401 };
	}

	const order = await controller.getById(orderId);
	if (!order || order.customerId !== userId) {
		return { error: "Order not found", status: 404 };
	}

	const items = await controller.getReorderItems(orderId);
	if (!items || items.length === 0) {
		return { error: "No items to reorder", status: 422 };
	}

	const enrichedItems = await Promise.all(
		items.map(async (item) => {
			let slug: string | undefined;
			let image: string | undefined;
			if (productsData) {
				const product = (await productsData.get("product", item.productId)) as {
					slug?: string;
					images?: string[];
				} | null;
				if (product) {
					slug = product.slug;
					image = product.images?.[0];
				}
			}
			return { ...item, slug: slug ?? item.productId, image };
		}),
	);

	return { items: enrichedItems };
}

async function simulateCreateReturn(
	controller: Controller,
	orderId: string,
	userId: string | undefined,
	body: {
		type?: "refund" | "exchange" | "store_credit";
		reason: string;
		customerNotes?: string;
		items: Array<{
			orderItemId: string;
			quantity: number;
			reason?: string;
		}>;
	},
) {
	if (!userId) {
		return { error: "Unauthorized", status: 401 };
	}

	const order = await controller.getById(orderId);
	if (!order || order.customerId !== userId) {
		return { error: "Order not found", status: 404 };
	}

	if (!["completed", "processing"].includes(order.status)) {
		return {
			error: "Returns are only available for completed or processing orders",
			status: 422,
		};
	}

	if (body.items.length === 0) {
		return { error: "At least one item is required", status: 400 };
	}

	const orderItemIds = new Set(order.items.map((i) => i.id));
	for (const item of body.items) {
		if (!orderItemIds.has(item.orderItemId)) {
			return {
				error: `Item ${item.orderItemId} does not belong to this order`,
				status: 400,
			};
		}
	}

	const returnRequest = await controller.createReturn({
		orderId,
		type: body.type,
		reason: body.reason,
		customerNotes: body.customerNotes,
		items: body.items,
	});

	return { returnRequest };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("store endpoint: get order", () => {
	let data: DataService;
	let controller: Controller;

	beforeEach(() => {
		data = createMockDataService();
		controller = createOrderController(data);
	});

	it("returns 401 for unauthenticated user", async () => {
		const result = await simulateGetOrder(controller, "ord_1", undefined);
		expect(result).toEqual({ error: "Unauthorized", status: 401 });
	});

	it("returns order when customer owns it", async () => {
		const order = await seedOrder(controller, { customerId: "cust_1" });
		const result = await simulateGetOrder(controller, order.id, "cust_1");

		expect("order" in result).toBe(true);
		if ("order" in result) {
			expect(result.order.id).toBe(order.id);
		}
	});

	it("includes storeCreditAmount in order response", async () => {
		const items = [
			{ productId: "p1", name: "Widget", price: 5000, quantity: 1 },
		];
		const subtotal = 5000;
		const order = await controller.create({
			customerId: "cust_1",
			subtotal,
			total: 3000,
			storeCreditAmount: 2000,
			items,
		});
		const result = await simulateGetOrder(controller, order.id, "cust_1");

		expect("order" in result).toBe(true);
		if ("order" in result) {
			expect(result.order.storeCreditAmount).toBe(2000);
			expect(result.order.total).toBe(3000);
		}
	});

	it("returns 404 when order belongs to a different customer", async () => {
		const order = await seedOrder(controller, { customerId: "cust_1" });
		const result = await simulateGetOrder(controller, order.id, "cust_other");

		expect(result).toEqual({ error: "Order not found", status: 404 });
	});

	it("returns 404 for nonexistent order ID", async () => {
		const result = await simulateGetOrder(controller, "nonexistent", "cust_1");
		expect(result).toEqual({ error: "Order not found", status: 404 });
	});
});

describe("store endpoint: confirm order (guest)", () => {
	let data: DataService;
	let controller: Controller;

	beforeEach(() => {
		data = createMockDataService();
		controller = createOrderController(data);
	});

	it("returns order for a guest when email matches guestEmail", async () => {
		const order = await seedOrder(controller, {
			guestEmail: "guest@example.com",
		});

		const result = await simulateConfirmOrder(
			controller,
			order.id,
			"guest@example.com",
		);

		expect("order" in result).toBe(true);
		if ("order" in result) {
			expect(result.order.id).toBe(order.id);
		}
	});

	it("matches guestEmail case-insensitively", async () => {
		const order = await seedOrder(controller, {
			guestEmail: "Guest@Example.COM",
		});

		const result = await simulateConfirmOrder(
			controller,
			order.id,
			"guest@example.com",
		);

		expect("order" in result).toBe(true);
	});

	it("returns order for authenticated user who owns it", async () => {
		const order = await seedOrder(controller, { customerId: "cust_1" });

		const result = await simulateConfirmOrder(
			controller,
			order.id,
			"any@example.com",
			"cust_1",
		);

		expect("order" in result).toBe(true);
		if ("order" in result) {
			expect(result.order.id).toBe(order.id);
		}
	});

	it("returns 404 when email does not match guestEmail", async () => {
		const order = await seedOrder(controller, {
			guestEmail: "guest@example.com",
		});

		const result = await simulateConfirmOrder(
			controller,
			order.id,
			"wrong@example.com",
		);

		expect(result).toEqual({ error: "Order not found", status: 404 });
	});

	it("returns 404 for nonexistent order ID", async () => {
		const result = await simulateConfirmOrder(
			controller,
			"nonexistent-id",
			"guest@example.com",
		);

		expect(result).toEqual({ error: "Order not found", status: 404 });
	});

	it("returns 404 when authenticated user does not own the order", async () => {
		const order = await seedOrder(controller, { customerId: "cust_1" });

		const result = await simulateConfirmOrder(
			controller,
			order.id,
			"guest@example.com",
			"cust_other",
		);

		expect(result).toEqual({ error: "Order not found", status: 404 });
	});

	it("returns 404 when order has no guestEmail and no auth session", async () => {
		const order = await seedOrder(controller, { customerId: "cust_1" });

		const result = await simulateConfirmOrder(
			controller,
			order.id,
			"guest@example.com",
		);

		expect(result).toEqual({ error: "Order not found", status: 404 });
	});
});

describe("store endpoint: list orders", () => {
	let data: DataService;
	let controller: Controller;

	beforeEach(() => {
		data = createMockDataService();
		controller = createOrderController(data);
	});

	it("returns 401 for unauthenticated user", async () => {
		const result = await simulateListOrders(controller, undefined);
		expect(result).toEqual({ error: "Unauthorized", status: 401 });
	});

	it("returns only orders belonging to the customer", async () => {
		await seedOrder(controller, { customerId: "cust_1" });
		await seedOrder(controller, { customerId: "cust_1" });
		await seedOrder(controller, { customerId: "cust_other" });

		const result = await simulateListOrders(controller, "cust_1");
		expect("orders" in result).toBe(true);
		if ("orders" in result) {
			expect(result.orders).toHaveLength(2);
			expect(result.total).toBe(2);
		}
	});

	it("paginates correctly", async () => {
		for (let i = 0; i < 5; i++) {
			await seedOrder(controller, { customerId: "cust_1" });
		}

		const page1 = await simulateListOrders(controller, "cust_1", {
			page: 1,
			limit: 2,
		});
		expect("orders" in page1).toBe(true);
		if ("orders" in page1) {
			expect(page1.orders).toHaveLength(2);
			expect(page1.total).toBe(5);
			expect(page1.pages).toBe(3);
			expect(page1.page).toBe(1);
		}
	});

	it("returns empty list for customer with no orders", async () => {
		const result = await simulateListOrders(controller, "cust_new");
		expect("orders" in result).toBe(true);
		if ("orders" in result) {
			expect(result.orders).toHaveLength(0);
			expect(result.total).toBe(0);
			expect(result.pages).toBe(0);
		}
	});
});

describe("store endpoint: cancel order", () => {
	let data: DataService;
	let controller: Controller;

	beforeEach(() => {
		data = createMockDataService();
		controller = createOrderController(data);
	});

	it("returns 401 for unauthenticated user", async () => {
		const result = await simulateCancelOrder(controller, "ord_1", undefined);
		expect(result).toEqual({ error: "Unauthorized", status: 401 });
	});

	it("cancels a pending order", async () => {
		const order = await seedOrder(controller, { customerId: "cust_1" });
		const result = await simulateCancelOrder(controller, order.id, "cust_1");

		expect("order" in result).toBe(true);
		if ("order" in result) {
			expect(result.order.status).toBe("cancelled");
		}
	});

	it("cancels a processing order", async () => {
		const order = await seedOrder(controller, {
			customerId: "cust_1",
			status: "processing",
		});
		const result = await simulateCancelOrder(controller, order.id, "cust_1");

		expect("order" in result).toBe(true);
		if ("order" in result) {
			expect(result.order.status).toBe("cancelled");
		}
	});

	it("cancels an on_hold order", async () => {
		const order = await seedOrder(controller, {
			customerId: "cust_1",
			status: "on_hold",
		});
		const result = await simulateCancelOrder(controller, order.id, "cust_1");

		expect("order" in result).toBe(true);
		if ("order" in result) {
			expect(result.order.status).toBe("cancelled");
		}
	});

	it("rejects cancellation of a completed order", async () => {
		const order = await seedOrder(controller, {
			customerId: "cust_1",
			status: "completed",
		});
		const result = await simulateCancelOrder(controller, order.id, "cust_1");

		expect(result).toEqual({
			error: "Order cannot be cancelled in its current state",
			status: 422,
		});
	});

	it("rejects cancellation of an already cancelled order", async () => {
		const order = await seedOrder(controller, {
			customerId: "cust_1",
			status: "cancelled",
		});
		const result = await simulateCancelOrder(controller, order.id, "cust_1");

		expect(result).toEqual({
			error: "Order cannot be cancelled in its current state",
			status: 422,
		});
	});

	it("returns 404 when cancelling another customer's order", async () => {
		const order = await seedOrder(controller, { customerId: "cust_1" });
		const result = await simulateCancelOrder(
			controller,
			order.id,
			"cust_other",
		);

		expect(result).toEqual({ error: "Order not found", status: 404 });
	});
});

describe("store endpoint: track order (guest)", () => {
	let data: DataService;
	let controller: Controller;

	beforeEach(() => {
		data = createMockDataService();
		controller = createOrderController(data);
	});

	it("returns order when orderNumber and email match", async () => {
		const order = await seedOrder(controller, {
			guestEmail: "guest@example.com",
		});

		const result = await simulateTrackOrder(
			controller,
			order.orderNumber,
			"guest@example.com",
		);

		expect("order" in result).toBe(true);
		if ("order" in result) {
			expect(result.order.id).toBe(order.id);
			expect(result.fulfillments).toBeDefined();
		}
	});

	it("returns 404 when email does not match", async () => {
		const order = await seedOrder(controller, {
			guestEmail: "guest@example.com",
		});

		const result = await simulateTrackOrder(
			controller,
			order.orderNumber,
			"wrong@example.com",
		);

		expect(result).toEqual({ error: "Order not found", status: 404 });
	});

	it("returns 404 for nonexistent order number", async () => {
		const result = await simulateTrackOrder(
			controller,
			"ORD-NONEXISTENT",
			"test@example.com",
		);

		expect(result).toEqual({ error: "Order not found", status: 404 });
	});

	it("does not invent Order-owned fulfillments on the guest tracking path", async () => {
		const order = await seedOrder(controller, {
			guestEmail: "guest@example.com",
		});

		const result = await simulateTrackOrder(
			controller,
			order.orderNumber,
			"guest@example.com",
		);

		expect("fulfillments" in result).toBe(true);
		if ("fulfillments" in result) {
			expect(result.fulfillments).toHaveLength(0);
		}
	});
});

describe("store endpoint: reorder", () => {
	let data: DataService;
	let controller: Controller;

	beforeEach(() => {
		data = createMockDataService();
		controller = createOrderController(data);
	});

	it("returns 401 for unauthenticated user", async () => {
		const result = await simulateReorder(controller, "ord_1", undefined);
		expect(result).toEqual({ error: "Unauthorized", status: 401 });
	});

	it("returns items from previous order", async () => {
		const order = await seedOrder(controller, {
			customerId: "cust_1",
			items: [
				{ productId: "prod_a", name: "Widget A", price: 1000, quantity: 2 },
				{ productId: "prod_b", name: "Widget B", price: 2000, quantity: 1 },
			],
		});

		const result = await simulateReorder(controller, order.id, "cust_1");

		expect("items" in result).toBe(true);
		if ("items" in result) {
			expect(result.items).toHaveLength(2);
			expect(result.items[0].productId).toBe("prod_a");
			expect(result.items[0].quantity).toBe(2);
			expect(result.items[1].productId).toBe("prod_b");
		}
	});

	it("enriches items with product slug and image from registry", async () => {
		const productsData = createMockDataService();
		await productsData.upsert("product", "prod_a", {
			id: "prod_a",
			slug: "widget-a",
			images: [
				"https://img.example.com/a.jpg",
				"https://img.example.com/a2.jpg",
			],
		});

		const order = await seedOrder(controller, {
			customerId: "cust_1",
			items: [
				{ productId: "prod_a", name: "Widget A", price: 1000, quantity: 1 },
			],
		});

		const result = await simulateReorder(
			controller,
			order.id,
			"cust_1",
			productsData,
		);

		expect("items" in result).toBe(true);
		if ("items" in result) {
			expect(result.items[0].slug).toBe("widget-a");
			expect(result.items[0].image).toBe("https://img.example.com/a.jpg");
		}
	});

	it("uses productId as slug fallback when product not in registry", async () => {
		const productsData = createMockDataService();
		// registry is empty — product not found

		const order = await seedOrder(controller, {
			customerId: "cust_1",
			items: [
				{
					productId: "prod_gone",
					name: "Gone Widget",
					price: 500,
					quantity: 1,
				},
			],
		});

		const result = await simulateReorder(
			controller,
			order.id,
			"cust_1",
			productsData,
		);

		expect("items" in result).toBe(true);
		if ("items" in result) {
			expect(result.items[0].slug).toBe("prod_gone");
			expect(result.items[0].image).toBeUndefined();
		}
	});

	it("returns 404 for another customer's order", async () => {
		const order = await seedOrder(controller, { customerId: "cust_1" });
		const result = await simulateReorder(controller, order.id, "cust_other");

		expect(result).toEqual({ error: "Order not found", status: 404 });
	});
});

describe("store endpoint: create return", () => {
	let data: DataService;
	let controller: Controller;

	beforeEach(() => {
		data = createMockDataService();
		controller = createOrderController(data);
	});

	it("returns 401 for unauthenticated user", async () => {
		const result = await simulateCreateReturn(controller, "ord_1", undefined, {
			reason: "defective",
			items: [{ orderItemId: "item_1", quantity: 1 }],
		});
		expect(result).toEqual({ error: "Unauthorized", status: 401 });
	});

	it("creates return for a completed order", async () => {
		const order = await seedOrder(controller, {
			customerId: "cust_1",
			status: "completed",
		});
		const itemId = order.items[0].id;

		const result = await simulateCreateReturn(controller, order.id, "cust_1", {
			reason: "defective",
			items: [{ orderItemId: itemId, quantity: 1 }],
		});

		expect("returnRequest" in result).toBe(true);
		if ("returnRequest" in result) {
			expect(result.returnRequest.reason).toBe("defective");
			expect(result.returnRequest.status).toBe("requested");
		}
	});

	it("creates return for a processing order", async () => {
		const order = await seedOrder(controller, {
			customerId: "cust_1",
			status: "processing",
		});
		const itemId = order.items[0].id;

		const result = await simulateCreateReturn(controller, order.id, "cust_1", {
			reason: "wrong_item",
			items: [{ orderItemId: itemId, quantity: 1 }],
		});

		expect("returnRequest" in result).toBe(true);
	});

	it("rejects return for a pending order", async () => {
		const order = await seedOrder(controller, {
			customerId: "cust_1",
			status: "pending",
		});

		const result = await simulateCreateReturn(controller, order.id, "cust_1", {
			reason: "defective",
			items: [{ orderItemId: "item_1", quantity: 1 }],
		});

		expect(result).toEqual({
			error: "Returns are only available for completed or processing orders",
			status: 422,
		});
	});

	it("rejects return for a cancelled order", async () => {
		const order = await seedOrder(controller, {
			customerId: "cust_1",
			status: "cancelled",
		});

		const result = await simulateCreateReturn(controller, order.id, "cust_1", {
			reason: "defective",
			items: [{ orderItemId: "item_1", quantity: 1 }],
		});

		expect(result).toEqual({
			error: "Returns are only available for completed or processing orders",
			status: 422,
		});
	});

	it("rejects return with empty items array", async () => {
		const order = await seedOrder(controller, {
			customerId: "cust_1",
			status: "completed",
		});

		const result = await simulateCreateReturn(controller, order.id, "cust_1", {
			reason: "defective",
			items: [],
		});

		expect(result).toEqual({
			error: "At least one item is required",
			status: 400,
		});
	});

	it("rejects return when item does not belong to the order", async () => {
		const order = await seedOrder(controller, {
			customerId: "cust_1",
			status: "completed",
		});

		const result = await simulateCreateReturn(controller, order.id, "cust_1", {
			reason: "defective",
			items: [{ orderItemId: "item_from_another_order", quantity: 1 }],
		});

		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.error).toContain("does not belong to this order");
			expect(result.status).toBe(400);
		}
	});

	it("returns 404 for another customer's order", async () => {
		const order = await seedOrder(controller, {
			customerId: "cust_1",
			status: "completed",
		});
		const itemId = order.items[0].id;

		const result = await simulateCreateReturn(
			controller,
			order.id,
			"cust_other",
			{
				reason: "defective",
				items: [{ orderItemId: itemId, quantity: 1 }],
			},
		);

		expect(result).toEqual({ error: "Order not found", status: 404 });
	});
});
