import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createWalmartController } from "../service-impl";

/**
 * Store endpoint integration tests for the walmart module.
 *
 * These tests simulate the business logic executed by the store-facing endpoint:
 *
 * 1. webhooks (/walmart/webhooks): receives inbound Walmart platform events.
 *    On "order.created" with a valid purchaseOrderId, the handler creates a
 *    local order record. All other event types acknowledge receipt only.
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ────────────────────────────────────────────

async function simulateWebhook(
	data: DataService,
	body: {
		type: string;
		payload: Record<string, unknown>;
	},
) {
	const controller = createWalmartController(data);

	if (body.type === "order.created" && body.payload.purchaseOrderId) {
		const order = await controller.receiveOrder({
			purchaseOrderId: body.payload.purchaseOrderId as string,
			items: (body.payload.items as unknown[]) ?? [],
			orderTotal: (body.payload.orderTotal as number) ?? 0,
			shippingTotal: (body.payload.shippingTotal as number) ?? 0,
			walmartFee: (body.payload.walmartFee as number) ?? 0,
			tax: (body.payload.tax as number) ?? 0,
			customerName: body.payload.customerName as string | undefined,
			shippingAddress:
				(body.payload.shippingAddress as Record<string, unknown>) ?? {},
		});
		return { received: true, orderId: order.id };
	}

	return { received: true };
}

// ── Tests: webhooks ────────────────────────────────────────────────────

describe("store endpoint: webhooks", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	describe("order.created event", () => {
		it("creates a local order record and returns the order id", async () => {
			const result = await simulateWebhook(data, {
				type: "order.created",
				payload: {
					purchaseOrderId: "PO-123456",
					orderTotal: 3999,
					shippingTotal: 599,
					walmartFee: 400,
					tax: 320,
					items: [{ itemId: "item_abc", quantity: 2, price: 1699 }],
					customerName: "Jane Smith",
				},
			});

			expect(result.received).toBe(true);
			expect(typeof result.orderId).toBe("string");
		});

		it("persists the order with created status", async () => {
			const result = await simulateWebhook(data, {
				type: "order.created",
				payload: {
					purchaseOrderId: "PO-PERSIST",
					orderTotal: 2499,
					shippingTotal: 0,
					walmartFee: 250,
					tax: 200,
					items: [],
				},
			});

			expect(result.received).toBe(true);

			const controller = createWalmartController(data);
			const orders = await controller.listOrders();
			const order = orders.find((o) => o.purchaseOrderId === "PO-PERSIST");
			expect(order).toBeDefined();
			expect(order?.status).toBe("created");
		});

		it("stores customer name when provided", async () => {
			await simulateWebhook(data, {
				type: "order.created",
				payload: {
					purchaseOrderId: "PO-CUSTOMER",
					orderTotal: 1500,
					shippingTotal: 0,
					walmartFee: 150,
					tax: 120,
					items: [],
					customerName: "Bob Williams",
				},
			});

			const controller = createWalmartController(data);
			const orders = await controller.listOrders();
			const order = orders.find((o) => o.purchaseOrderId === "PO-CUSTOMER");
			expect(order?.customerName).toBe("Bob Williams");
		});

		it("stores line items in the order record", async () => {
			const items = [
				{ itemId: "item_1", quantity: 2, price: 999 },
				{ itemId: "item_2", quantity: 1, price: 2499 },
			];

			await simulateWebhook(data, {
				type: "order.created",
				payload: {
					purchaseOrderId: "PO-ITEMS",
					orderTotal: 4497,
					shippingTotal: 0,
					walmartFee: 450,
					tax: 360,
					items,
				},
			});

			const controller = createWalmartController(data);
			const orders = await controller.listOrders();
			const order = orders.find((o) => o.purchaseOrderId === "PO-ITEMS");
			expect(order?.items).toHaveLength(2);
		});

		it("returns received without orderId when purchaseOrderId is absent", async () => {
			const result = await simulateWebhook(data, {
				type: "order.created",
				payload: {
					// missing purchaseOrderId
					orderTotal: 1000,
					items: [],
				},
			});

			expect(result.received).toBe(true);
			expect("orderId" in result).toBe(false);
		});
	});

	describe("unknown event types", () => {
		it("acknowledges receipt without creating records", async () => {
			const result = await simulateWebhook(data, {
				type: "item.updated",
				payload: { itemId: "item_xyz", status: "published" },
			});

			expect(result.received).toBe(true);
			expect("orderId" in result).toBe(false);
		});

		it("handles feed submission events gracefully", async () => {
			const result = await simulateWebhook(data, {
				type: "feed.submitted",
				payload: { feedId: "feed_001", itemCount: 150 },
			});

			expect(result.received).toBe(true);
		});

		it("handles completely unknown event types gracefully", async () => {
			const result = await simulateWebhook(data, {
				type: "some.unknown.event",
				payload: {},
			});

			expect(result.received).toBe(true);
		});
	});

	describe("multiple orders", () => {
		it("creates independent records for consecutive order.created events", async () => {
			const result1 = await simulateWebhook(data, {
				type: "order.created",
				payload: {
					purchaseOrderId: "PO-MULTI-A",
					orderTotal: 1000,
					shippingTotal: 0,
					walmartFee: 100,
					tax: 80,
					items: [],
				},
			});

			const result2 = await simulateWebhook(data, {
				type: "order.created",
				payload: {
					purchaseOrderId: "PO-MULTI-B",
					orderTotal: 2000,
					shippingTotal: 0,
					walmartFee: 200,
					tax: 160,
					items: [],
				},
			});

			expect(result1.received).toBe(true);
			expect(result2.received).toBe(true);

			if ("orderId" in result1 && "orderId" in result2) {
				expect(result1.orderId).not.toBe(result2.orderId);
			}
		});
	});
});
