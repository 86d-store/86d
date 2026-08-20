import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createUberEatsController } from "../service-impl";

describe("uber-eats endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createUberEatsController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createUberEatsController(mockData);
	});

	describe("order state machine safety", () => {
		it("cannot accept a cancelled order", async () => {
			const order = await controller.receiveOrder({
				externalOrderId: "s-1",
				items: [],
				subtotal: 10,
				deliveryFee: 3,
				tax: 1,
				total: 14,
			});
			await controller.cancelOrder(order.id);
			const result = await controller.acceptOrder(order.id);
			expect(result).toBeNull();
		});

		it("cannot mark a pending order as ready", async () => {
			const order = await controller.receiveOrder({
				externalOrderId: "s-2",
				items: [],
				subtotal: 10,
				deliveryFee: 3,
				tax: 1,
				total: 14,
			});
			const result = await controller.markReady(order.id);
			expect(result).toBeNull();
		});

		it("get order returns null for non-existent id", async () => {
			const result = await controller.getOrder("nonexistent");
			expect(result).toBeNull();
		});

		it("cancel returns null for non-existent order", async () => {
			const result = await controller.cancelOrder("nonexistent");
			expect(result).toBeNull();
		});
	});

	describe("stats accuracy after state changes", () => {
		it("reflects current state after multiple transitions", async () => {
			const o1 = await controller.receiveOrder({
				externalOrderId: "s-a",
				items: [],
				subtotal: 10,
				deliveryFee: 3,
				tax: 1,
				total: 14,
			});
			const o2 = await controller.receiveOrder({
				externalOrderId: "s-b",
				items: [],
				subtotal: 20,
				deliveryFee: 3,
				tax: 2,
				total: 25,
			});
			await controller.acceptOrder(o1.id);
			await controller.cancelOrder(o2.id);

			const stats = await controller.getOrderStats();
			expect(stats.accepted).toBe(1);
			expect(stats.cancelled).toBe(1);
			expect(stats.totalRevenue).toBe(14);
		});
	});
});
