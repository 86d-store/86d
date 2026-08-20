import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createUberEatsController } from "../service-impl";

/**
 * Store endpoint integration tests for the uber-eats module.
 *
 * These tests simulate the business logic executed by store-facing endpoints:
 *
 * 1. receive-order: records an incoming order from Uber Eats (no auth — webhook)
 * 2. accept-order: marks an order as accepted (admin only)
 * 3. mark-ready: marks an order as ready for pickup (admin only)
 * 4. cancel-order: cancels an order (admin only)
 * 5. get-order: retrieves order details (admin only)
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ────────────────────────────────────────────

async function simulateReceiveOrder(
	data: DataService,
	body: {
		externalOrderId: string;
		items: Array<Record<string, unknown>>;
		subtotal: number;
		deliveryFee: number;
		tax: number;
		total: number;
		customerName?: string;
		orderType?: string;
	},
) {
	const controller = createUberEatsController(data);
	const order = await controller.receiveOrder(body);
	return { order };
}

async function simulateAcceptOrder(
	data: DataService,
	isAdmin: boolean,
	orderId: string,
) {
	if (!isAdmin) {
		return { error: "Unauthorized", status: 401 };
	}
	const controller = createUberEatsController(data);
	const order = await controller.acceptOrder(orderId);
	if (!order) {
		return { error: "Order not found", status: 404 };
	}
	return { order };
}

async function simulateMarkReady(
	data: DataService,
	isAdmin: boolean,
	orderId: string,
) {
	if (!isAdmin) {
		return { error: "Unauthorized", status: 401 };
	}
	const controller = createUberEatsController(data);
	const order = await controller.markReady(orderId);
	if (!order) {
		return { error: "Order not found", status: 404 };
	}
	return { order };
}

async function simulateCancelOrder(
	data: DataService,
	isAdmin: boolean,
	orderId: string,
) {
	if (!isAdmin) {
		return { error: "Unauthorized", status: 401 };
	}
	const controller = createUberEatsController(data);
	const order = await controller.cancelOrder(orderId);
	if (!order) {
		return { error: "Order not found", status: 404 };
	}
	return { order };
}

async function simulateGetOrder(
	data: DataService,
	isAdmin: boolean,
	orderId: string,
) {
	if (!isAdmin) {
		return { error: "Unauthorized", status: 401 };
	}
	const controller = createUberEatsController(data);
	const order = await controller.getOrder(orderId);
	if (!order) {
		return { error: "Order not found", status: 404 };
	}
	return { order };
}

// ── Tests: receive-order ───────────────────────────────────────────────

describe("store endpoint: receive-order", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("records an incoming order with pending status", async () => {
		const result = await simulateReceiveOrder(data, {
			externalOrderId: "ext_order_123",
			items: [{ name: "Burger", price: 1299, quantity: 2 }],
			subtotal: 2598,
			deliveryFee: 299,
			tax: 225,
			total: 3122,
			customerName: "Jane Doe",
			orderType: "DELIVERY",
		});

		expect("order" in result).toBe(true);
		if ("order" in result) {
			expect(result.order.externalOrderId).toBe("ext_order_123");
			expect(result.order.status).toBe("pending");
			expect(result.order.total).toBe(3122);
			expect(result.order.customerName).toBe("Jane Doe");
		}
	});

	it("accepts orders without optional fields", async () => {
		const result = await simulateReceiveOrder(data, {
			externalOrderId: "ext_order_456",
			items: [{ name: "Pizza", price: 1899, quantity: 1 }],
			subtotal: 1899,
			deliveryFee: 199,
			tax: 190,
			total: 2288,
		});

		expect("order" in result).toBe(true);
		if ("order" in result) {
			expect(result.order.status).toBe("pending");
			expect(result.order.customerName).toBeUndefined();
		}
	});
});

// ── Tests: accept-order ────────────────────────────────────────────────

describe("store endpoint: accept-order", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("rejects unauthenticated requests", async () => {
		const result = await simulateAcceptOrder(data, false, "order_xyz");
		expect(result).toMatchObject({ error: "Unauthorized", status: 401 });
	});

	it("returns 404 for a non-existent order", async () => {
		const result = await simulateAcceptOrder(data, true, "order_nonexistent");
		expect(result).toMatchObject({ error: "Order not found", status: 404 });
	});

	it("transitions a pending order to accepted", async () => {
		const ctrl = createUberEatsController(data);
		const created = await ctrl.receiveOrder({
			externalOrderId: "ext_001",
			items: [],
			subtotal: 1000,
			deliveryFee: 299,
			tax: 100,
			total: 1399,
		});

		const result = await simulateAcceptOrder(data, true, created.id);

		expect("order" in result).toBe(true);
		if ("order" in result) {
			expect(result.order.status).toBe("accepted");
		}
	});
});

// ── Tests: mark-ready ─────────────────────────────────────────────────

describe("store endpoint: mark-ready", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("rejects unauthenticated requests", async () => {
		const result = await simulateMarkReady(data, false, "order_xyz");
		expect(result).toMatchObject({ error: "Unauthorized", status: 401 });
	});

	it("transitions an accepted order to ready", async () => {
		const ctrl = createUberEatsController(data);
		const created = await ctrl.receiveOrder({
			externalOrderId: "ext_002",
			items: [],
			subtotal: 800,
			deliveryFee: 199,
			tax: 80,
			total: 1079,
		});
		await ctrl.acceptOrder(created.id);

		const result = await simulateMarkReady(data, true, created.id);

		expect("order" in result).toBe(true);
		if ("order" in result) {
			expect(result.order.status).toBe("ready");
		}
	});
});

// ── Tests: cancel-order ────────────────────────────────────────────────

describe("store endpoint: cancel-order", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("rejects unauthenticated requests", async () => {
		const result = await simulateCancelOrder(data, false, "order_xyz");
		expect(result).toMatchObject({ error: "Unauthorized", status: 401 });
	});

	it("cancels a pending order", async () => {
		const ctrl = createUberEatsController(data);
		const created = await ctrl.receiveOrder({
			externalOrderId: "ext_003",
			items: [],
			subtotal: 600,
			deliveryFee: 199,
			tax: 60,
			total: 859,
		});

		const result = await simulateCancelOrder(data, true, created.id);

		expect("order" in result).toBe(true);
		if ("order" in result) {
			expect(result.order.status).toBe("cancelled");
		}
	});
});

// ── Tests: get-order ──────────────────────────────────────────────────

describe("store endpoint: get-order", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("rejects unauthenticated requests", async () => {
		const result = await simulateGetOrder(data, false, "order_xyz");
		expect(result).toMatchObject({ error: "Unauthorized", status: 401 });
	});

	it("returns 404 for a non-existent order", async () => {
		const result = await simulateGetOrder(data, true, "order_nonexistent");
		expect(result).toMatchObject({ error: "Order not found", status: 404 });
	});

	it("returns order details for an admin user", async () => {
		const ctrl = createUberEatsController(data);
		const created = await ctrl.receiveOrder({
			externalOrderId: "ext_004",
			items: [{ name: "Tacos", price: 999, quantity: 3 }],
			subtotal: 2997,
			deliveryFee: 299,
			tax: 300,
			total: 3596,
			customerName: "Carlos R",
		});

		const result = await simulateGetOrder(data, true, created.id);

		expect("order" in result).toBe(true);
		if ("order" in result) {
			expect(result.order.id).toBe(created.id);
			expect(result.order.externalOrderId).toBe("ext_004");
			expect(result.order.status).toBe("pending");
			expect(result.order.customerName).toBe("Carlos R");
		}
	});
});
