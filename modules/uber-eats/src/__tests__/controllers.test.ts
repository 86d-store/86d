import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createUberEatsController } from "../service-impl";

describe("uber-eats controller", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createUberEatsController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createUberEatsController(mockData);
	});

	// ── Order creation ───────────────────────────────────────────────

	describe("receiveOrder", () => {
		it("creates an order with pending status", async () => {
			const order = await controller.receiveOrder({
				externalOrderId: "ue-order-1",
				items: [{ name: "Burger", qty: 2 }],
				subtotal: 20.0,
				deliveryFee: 3.99,
				tax: 1.6,
				total: 25.59,
			});
			expect(order.id).toBeDefined();
			expect(order.status).toBe("pending");
			expect(order.externalOrderId).toBe("ue-order-1");
			expect(order.total).toBe(25.59);
		});

		it("includes customer info", async () => {
			const order = await controller.receiveOrder({
				externalOrderId: "ue-order-2",
				items: [{ name: "Pizza" }],
				subtotal: 15.0,
				deliveryFee: 2.99,
				tax: 1.2,
				total: 19.19,
				customerName: "John",
				customerPhone: "555-1234",
				specialInstructions: "No onions",
			});
			expect(order.customerName).toBe("John");
			expect(order.customerPhone).toBe("555-1234");
			expect(order.specialInstructions).toBe("No onions");
		});

		it("sets timestamps", async () => {
			const before = new Date();
			const order = await controller.receiveOrder({
				externalOrderId: "ue-order-3",
				items: [],
				subtotal: 10,
				deliveryFee: 3,
				tax: 1,
				total: 14,
			});
			const after = new Date();
			expect(order.createdAt.getTime()).toBeGreaterThanOrEqual(
				before.getTime(),
			);
			expect(order.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
		});
	});

	// ── Order state transitions ──────────────────────────────────────

	describe("acceptOrder", () => {
		it("accepts a pending order", async () => {
			const order = await controller.receiveOrder({
				externalOrderId: "ue-1",
				items: [],
				subtotal: 10,
				deliveryFee: 3,
				tax: 1,
				total: 14,
			});
			const accepted = await controller.acceptOrder(order.id);
			expect(accepted?.status).toBe("accepted");
		});

		it("cannot accept a non-pending order", async () => {
			const order = await controller.receiveOrder({
				externalOrderId: "ue-2",
				items: [],
				subtotal: 10,
				deliveryFee: 3,
				tax: 1,
				total: 14,
			});
			await controller.acceptOrder(order.id);
			const result = await controller.acceptOrder(order.id);
			expect(result).toBeNull();
		});

		it("returns null for non-existent order", async () => {
			const result = await controller.acceptOrder("non-existent");
			expect(result).toBeNull();
		});
	});

	describe("markReady", () => {
		it("marks an accepted order as ready", async () => {
			const order = await controller.receiveOrder({
				externalOrderId: "ue-3",
				items: [],
				subtotal: 10,
				deliveryFee: 3,
				tax: 1,
				total: 14,
			});
			await controller.acceptOrder(order.id);
			const ready = await controller.markReady(order.id);
			expect(ready?.status).toBe("ready");
		});

		it("cannot mark a pending order as ready", async () => {
			const order = await controller.receiveOrder({
				externalOrderId: "ue-4",
				items: [],
				subtotal: 10,
				deliveryFee: 3,
				tax: 1,
				total: 14,
			});
			const result = await controller.markReady(order.id);
			expect(result).toBeNull();
		});

		it("cannot mark a cancelled order as ready", async () => {
			const order = await controller.receiveOrder({
				externalOrderId: "ue-5",
				items: [],
				subtotal: 10,
				deliveryFee: 3,
				tax: 1,
				total: 14,
			});
			await controller.cancelOrder(order.id);
			const result = await controller.markReady(order.id);
			expect(result).toBeNull();
		});

		it("returns null for non-existent order", async () => {
			const result = await controller.markReady("non-existent");
			expect(result).toBeNull();
		});
	});

	describe("cancelOrder", () => {
		it("cancels a pending order", async () => {
			const order = await controller.receiveOrder({
				externalOrderId: "ue-6",
				items: [],
				subtotal: 10,
				deliveryFee: 3,
				tax: 1,
				total: 14,
			});
			const cancelled = await controller.cancelOrder(order.id);
			expect(cancelled?.status).toBe("cancelled");
		});

		it("cancels an accepted order", async () => {
			const order = await controller.receiveOrder({
				externalOrderId: "ue-7",
				items: [],
				subtotal: 10,
				deliveryFee: 3,
				tax: 1,
				total: 14,
			});
			await controller.acceptOrder(order.id);
			const cancelled = await controller.cancelOrder(order.id);
			expect(cancelled?.status).toBe("cancelled");
		});

		it("cannot cancel an already cancelled order", async () => {
			const order = await controller.receiveOrder({
				externalOrderId: "ue-8",
				items: [],
				subtotal: 10,
				deliveryFee: 3,
				tax: 1,
				total: 14,
			});
			await controller.cancelOrder(order.id);
			const result = await controller.cancelOrder(order.id);
			expect(result).toBeNull();
		});

		it("returns null for non-existent order", async () => {
			const result = await controller.cancelOrder("non-existent");
			expect(result).toBeNull();
		});
	});

	// ── Get and list orders ──────────────────────────────────────────

	describe("getOrder", () => {
		it("retrieves an existing order", async () => {
			const created = await controller.receiveOrder({
				externalOrderId: "ue-9",
				items: [],
				subtotal: 10,
				deliveryFee: 3,
				tax: 1,
				total: 14,
			});
			const found = await controller.getOrder(created.id);
			expect(found).not.toBeNull();
			expect(found?.externalOrderId).toBe("ue-9");
		});

		it("returns null for non-existent order", async () => {
			const result = await controller.getOrder("non-existent");
			expect(result).toBeNull();
		});
	});

	describe("listOrders", () => {
		it("lists all orders", async () => {
			await controller.receiveOrder({
				externalOrderId: "ue-a",
				items: [],
				subtotal: 10,
				deliveryFee: 3,
				tax: 1,
				total: 14,
			});
			await controller.receiveOrder({
				externalOrderId: "ue-b",
				items: [],
				subtotal: 20,
				deliveryFee: 3,
				tax: 2,
				total: 25,
			});
			const all = await controller.listOrders();
			expect(all).toHaveLength(2);
		});

		it("filters by status", async () => {
			const order = await controller.receiveOrder({
				externalOrderId: "ue-c",
				items: [],
				subtotal: 10,
				deliveryFee: 3,
				tax: 1,
				total: 14,
			});
			await controller.receiveOrder({
				externalOrderId: "ue-d",
				items: [],
				subtotal: 20,
				deliveryFee: 3,
				tax: 2,
				total: 25,
			});
			await controller.acceptOrder(order.id);

			const accepted = await controller.listOrders({ status: "accepted" });
			expect(accepted).toHaveLength(1);
			expect(accepted[0].externalOrderId).toBe("ue-c");
		});

		it("supports pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.receiveOrder({
					externalOrderId: `ue-${i}`,
					items: [],
					subtotal: 10,
					deliveryFee: 3,
					tax: 1,
					total: 14,
				});
			}
			const page = await controller.listOrders({ take: 3 });
			expect(page).toHaveLength(3);
		});

		it("returns empty when skip exceeds total", async () => {
			await controller.receiveOrder({
				externalOrderId: "ue-only",
				items: [],
				subtotal: 10,
				deliveryFee: 3,
				tax: 1,
				total: 14,
			});
			const result = await controller.listOrders({ skip: 100 });
			expect(result).toEqual([]);
		});
	});

	// ── Menu sync ────────────────────────────────────────────────────

	describe("syncMenu", () => {
		it("creates a synced menu sync record", async () => {
			const sync = await controller.syncMenu(25);
			expect(sync.id).toBeDefined();
			expect(sync.status).toBe("synced");
			expect(sync.itemCount).toBe(25);
			expect(sync.completedAt).toBeInstanceOf(Date);
		});
	});

	describe("getLastMenuSync", () => {
		it("returns null when no syncs exist", async () => {
			const result = await controller.getLastMenuSync();
			expect(result).toBeNull();
		});

		it("returns a sync record when syncs exist", async () => {
			await controller.syncMenu(10);
			await controller.syncMenu(20);
			const last = await controller.getLastMenuSync();
			expect(last).not.toBeNull();
			expect(last?.itemCount).toBeGreaterThanOrEqual(10);
		});
	});

	describe("listMenuSyncs", () => {
		it("lists all syncs", async () => {
			await controller.syncMenu(10);
			await controller.syncMenu(20);
			await controller.syncMenu(30);
			const all = await controller.listMenuSyncs();
			expect(all).toHaveLength(3);
		});

		it("supports pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.syncMenu(i * 10);
			}
			const page = await controller.listMenuSyncs({ take: 2 });
			expect(page).toHaveLength(2);
		});
	});

	// ── Order stats ──────────────────────────────────────────────────

	describe("getOrderStats", () => {
		it("returns all zeroes when no orders exist", async () => {
			const stats = await controller.getOrderStats();
			expect(stats.total).toBe(0);
			expect(stats.pending).toBe(0);
			expect(stats.totalRevenue).toBe(0);
		});

		it("aggregates order counts by status", async () => {
			const o1 = await controller.receiveOrder({
				externalOrderId: "s-1",
				items: [],
				subtotal: 10,
				deliveryFee: 3,
				tax: 1,
				total: 14,
			});
			await controller.receiveOrder({
				externalOrderId: "s-2",
				items: [],
				subtotal: 20,
				deliveryFee: 3,
				tax: 2,
				total: 25,
			});
			await controller.acceptOrder(o1.id);

			const stats = await controller.getOrderStats();
			expect(stats.total).toBe(2);
			expect(stats.accepted).toBe(1);
			expect(stats.pending).toBe(1);
		});

		it("excludes cancelled orders from revenue", async () => {
			const o1 = await controller.receiveOrder({
				externalOrderId: "r-1",
				items: [],
				subtotal: 10,
				deliveryFee: 3,
				tax: 1,
				total: 14,
			});
			await controller.receiveOrder({
				externalOrderId: "r-2",
				items: [],
				subtotal: 20,
				deliveryFee: 3,
				tax: 2,
				total: 25,
			});
			await controller.cancelOrder(o1.id);

			const stats = await controller.getOrderStats();
			expect(stats.totalRevenue).toBe(25);
			expect(stats.cancelled).toBe(1);
		});
	});
});
