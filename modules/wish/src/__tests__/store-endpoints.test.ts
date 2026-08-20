import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createWishController } from "../service-impl";

/**
 * Store endpoint integration tests for the wish module.
 *
 * These tests simulate the business logic executed by the store-facing endpoint:
 *
 * 1. webhooks (/wish/webhooks): receives inbound Wish platform events.
 *    On "order.created" with a valid wishOrderId, the handler creates a local
 *    order record. All other event types acknowledge receipt without side-effects.
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
	const controller = createWishController(data);

	if (body.type === "order.created" && body.payload.wishOrderId) {
		const order = await controller.receiveOrder({
			wishOrderId: body.payload.wishOrderId as string,
			items: (body.payload.items as unknown[]) ?? [],
			orderTotal: (body.payload.orderTotal as number) ?? 0,
			shippingTotal: (body.payload.shippingTotal as number) ?? 0,
			wishFee: (body.payload.wishFee as number) ?? 0,
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
					wishOrderId: "wish-order-abc",
					orderTotal: 1999,
					shippingTotal: 299,
					wishFee: 200,
					items: [{ productId: "prod_xyz", quantity: 1, price: 1700 }],
					customerName: "Maria Garcia",
				},
			});

			expect(result.received).toBe(true);
			expect(typeof result.orderId).toBe("string");
		});

		it("persists the order with pending status", async () => {
			const result = await simulateWebhook(data, {
				type: "order.created",
				payload: {
					wishOrderId: "wish-persist-001",
					orderTotal: 2500,
					shippingTotal: 0,
					wishFee: 250,
					items: [],
				},
			});

			expect(result.received).toBe(true);

			if ("orderId" in result) {
				const controller = createWishController(data);
				const order = await controller.getOrder(result.orderId);
				expect(order).not.toBeNull();
				expect(order?.wishOrderId).toBe("wish-persist-001");
				expect(order?.status).toBe("pending");
			}
		});

		it("stores customer name when provided", async () => {
			const result = await simulateWebhook(data, {
				type: "order.created",
				payload: {
					wishOrderId: "wish-customer-001",
					orderTotal: 1200,
					shippingTotal: 0,
					wishFee: 120,
					items: [],
					customerName: "Carlos Rivera",
				},
			});

			if ("orderId" in result) {
				const controller = createWishController(data);
				const order = await controller.getOrder(result.orderId);
				expect(order?.customerName).toBe("Carlos Rivera");
			}
		});

		it("stores line items when provided", async () => {
			const items = [
				{ productId: "prod_a", quantity: 3, price: 599 },
				{ productId: "prod_b", quantity: 1, price: 1299 },
			];

			const result = await simulateWebhook(data, {
				type: "order.created",
				payload: {
					wishOrderId: "wish-items-001",
					orderTotal: 3096,
					shippingTotal: 0,
					wishFee: 310,
					items,
				},
			});

			if ("orderId" in result) {
				const controller = createWishController(data);
				const order = await controller.getOrder(result.orderId);
				expect(order?.items).toHaveLength(2);
			}
		});

		it("returns received without orderId when wishOrderId is absent", async () => {
			const result = await simulateWebhook(data, {
				type: "order.created",
				payload: {
					// missing wishOrderId
					orderTotal: 999,
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
				type: "product.approved",
				payload: { productId: "prod_001" },
			});

			expect(result.received).toBe(true);
			expect("orderId" in result).toBe(false);
		});

		it("handles refund events gracefully", async () => {
			const result = await simulateWebhook(data, {
				type: "refund.issued",
				payload: { orderId: "wish-refund-001", amount: 1999 },
			});

			expect(result.received).toBe(true);
		});

		it("handles completely unknown event types gracefully", async () => {
			const result = await simulateWebhook(data, {
				type: "completely.unknown.type",
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
					wishOrderId: "wish-multi-1",
					orderTotal: 800,
					shippingTotal: 0,
					wishFee: 80,
					items: [],
				},
			});

			const result2 = await simulateWebhook(data, {
				type: "order.created",
				payload: {
					wishOrderId: "wish-multi-2",
					orderTotal: 1600,
					shippingTotal: 0,
					wishFee: 160,
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
