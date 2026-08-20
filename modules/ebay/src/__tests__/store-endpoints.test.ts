import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createEbayController } from "../service-impl";

/**
 * Store endpoint integration tests for the ebay module.
 *
 * These tests simulate the business logic executed by the store-facing endpoint:
 *
 * 1. webhooks (/ebay/webhooks): receives inbound eBay platform events.
 *    On "order.created" with a valid ebayOrderId, the handler creates a local
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
	const controller = createEbayController(data);

	if (body.type === "order.created" && body.payload.ebayOrderId) {
		const order = await controller.receiveOrder({
			ebayOrderId: body.payload.ebayOrderId as string,
			items: (body.payload.items as unknown[]) ?? [],
			subtotal: (body.payload.subtotal as number) ?? 0,
			shippingCost: (body.payload.shippingCost as number) ?? 0,
			ebayFee: (body.payload.ebayFee as number) ?? 0,
			paymentProcessingFee: (body.payload.paymentProcessingFee as number) ?? 0,
			total: (body.payload.total as number) ?? 0,
			buyerUsername: body.payload.buyerUsername as string | undefined,
			buyerName: body.payload.buyerName as string | undefined,
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
					ebayOrderId: "ebay-order-001",
					total: 4599,
					subtotal: 3999,
					shippingCost: 600,
					ebayFee: 390,
					paymentProcessingFee: 150,
					items: [{ listingId: "listing_abc", quantity: 1, price: 3999 }],
					buyerUsername: "buyer123",
				},
			});

			expect(result.received).toBe(true);
			expect(typeof result.orderId).toBe("string");
		});

		it("persists the order so it can be retrieved later", async () => {
			const result = await simulateWebhook(data, {
				type: "order.created",
				payload: {
					ebayOrderId: "ebay-order-persist",
					total: 1999,
					subtotal: 1999,
					shippingCost: 0,
					ebayFee: 200,
					paymentProcessingFee: 75,
					items: [],
				},
			});

			expect(result.received).toBe(true);

			if ("orderId" in result) {
				const controller = createEbayController(data);
				const order = await controller.getOrder(result.orderId);
				expect(order).not.toBeNull();
				expect(order?.ebayOrderId).toBe("ebay-order-persist");
				expect(order?.status).toBe("pending");
			}
		});

		it("sets status to pending for a new order", async () => {
			const result = await simulateWebhook(data, {
				type: "order.created",
				payload: {
					ebayOrderId: "ebay-order-status",
					total: 2500,
					subtotal: 2500,
					shippingCost: 0,
					ebayFee: 250,
					paymentProcessingFee: 95,
					items: [],
				},
			});

			if ("orderId" in result) {
				const controller = createEbayController(data);
				const order = await controller.getOrder(result.orderId);
				expect(order?.status).toBe("pending");
			}
		});

		it("stores buyer details when provided", async () => {
			const result = await simulateWebhook(data, {
				type: "order.created",
				payload: {
					ebayOrderId: "ebay-order-buyer",
					total: 3200,
					subtotal: 3200,
					shippingCost: 0,
					ebayFee: 320,
					paymentProcessingFee: 120,
					items: [],
					buyerUsername: "shopper99",
					buyerName: "Alex Johnson",
				},
			});

			if ("orderId" in result) {
				const controller = createEbayController(data);
				const order = await controller.getOrder(result.orderId);
				expect(order?.buyerUsername).toBe("shopper99");
				expect(order?.buyerName).toBe("Alex Johnson");
			}
		});

		it("returns received without orderId when ebayOrderId is absent", async () => {
			const result = await simulateWebhook(data, {
				type: "order.created",
				payload: {
					// missing ebayOrderId
					total: 1000,
					items: [],
				},
			});

			expect(result.received).toBe(true);
			expect("orderId" in result).toBe(false);
		});
	});

	describe("unknown event types", () => {
		it("acknowledges receipt without creating any records", async () => {
			const result = await simulateWebhook(data, {
				type: "listing.updated",
				payload: { listingId: "listing_xyz", status: "active" },
			});

			expect(result.received).toBe(true);
			expect("orderId" in result).toBe(false);
		});

		it("handles feedback.received event gracefully", async () => {
			const result = await simulateWebhook(data, {
				type: "feedback.received",
				payload: { feedbackId: "fb_001", rating: 5 },
			});

			expect(result.received).toBe(true);
		});

		it("handles completely unknown event types gracefully", async () => {
			const result = await simulateWebhook(data, {
				type: "unknown.event.type",
				payload: {},
			});

			expect(result.received).toBe(true);
		});
	});

	describe("multiple orders", () => {
		it("creates independent records for multiple order.created events", async () => {
			const result1 = await simulateWebhook(data, {
				type: "order.created",
				payload: {
					ebayOrderId: "ebay-multi-1",
					total: 1000,
					subtotal: 1000,
					shippingCost: 0,
					ebayFee: 100,
					paymentProcessingFee: 40,
					items: [],
				},
			});

			const result2 = await simulateWebhook(data, {
				type: "order.created",
				payload: {
					ebayOrderId: "ebay-multi-2",
					total: 2000,
					subtotal: 2000,
					shippingCost: 0,
					ebayFee: 200,
					paymentProcessingFee: 75,
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
