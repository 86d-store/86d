import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUberEatsController } from "../service-impl";

// ── Provider mock ──────────────────────────────────────────────────────────

const mockProvider = {
	getOrder: vi.fn(),
	getOrders: vi.fn(),
	acceptOrder: vi.fn(),
	cancelOrder: vi.fn(),
	getMenu: vi.fn(),
	updateMenu: vi.fn(),
};

const mockEvents = {
	emit: vi.fn(),
};

// ── Helpers ────────────────────────────────────────────────────────────────

function makeOrderParams(
	overrides: Partial<
		Parameters<ReturnType<typeof createUberEatsController>["receiveOrder"]>[0]
	> = {},
) {
	return {
		externalOrderId: "uber-order-100",
		items: [{ name: "Burger", qty: 1, price: 12.99 }],
		subtotal: 12.99,
		deliveryFee: 3.99,
		tax: 1.3,
		total: 18.28,
		customerName: "Jane Doe",
		customerPhone: "+15551234567",
		specialInstructions: "No onions",
		orderType: "delivery",
		...overrides,
	};
}

// ── Tests with provider ────────────────────────────────────────────────────

describe("uber-eats service-impl with provider", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createUberEatsController>;

	beforeEach(() => {
		mockData = createMockDataService();
		vi.clearAllMocks();

		controller = createUberEatsController(
			mockData,
			mockEvents as never,
			mockProvider as never,
		);
	});

	// ── receiveOrder ─────────────────────────────────────────────────

	describe("receiveOrder", () => {
		it("creates an order with pending status", async () => {
			const order = await controller.receiveOrder(makeOrderParams());

			expect(order.status).toBe("pending");
			expect(order.externalOrderId).toBe("uber-order-100");
			expect(order.total).toBe(18.28);
			expect(order.id).toBeTruthy();
			expect(order.createdAt).toBeInstanceOf(Date);
		});

		it("stores all order details", async () => {
			const order = await controller.receiveOrder(makeOrderParams());

			expect(order.items).toHaveLength(1);
			expect(order.subtotal).toBe(12.99);
			expect(order.deliveryFee).toBe(3.99);
			expect(order.tax).toBe(1.3);
			expect(order.customerName).toBe("Jane Doe");
			expect(order.customerPhone).toBe("+15551234567");
			expect(order.specialInstructions).toBe("No onions");
			expect(order.orderType).toBe("delivery");
		});

		it("persists order to data store", async () => {
			const order = await controller.receiveOrder(makeOrderParams());

			expect(mockData.size("uberOrder")).toBe(1);
			const stored = await mockData.get("uberOrder", order.id);
			expect(stored).not.toBeNull();
		});

		it("emits ubereats.order.received event", async () => {
			const order = await controller.receiveOrder(makeOrderParams());

			expect(mockEvents.emit).toHaveBeenCalledWith("ubereats.order.received", {
				orderId: order.id,
				externalOrderId: "uber-order-100",
				total: 18.28,
			});
		});

		it("generates unique IDs for each order", async () => {
			const o1 = await controller.receiveOrder(
				makeOrderParams({ externalOrderId: "ext-1" }),
			);
			const o2 = await controller.receiveOrder(
				makeOrderParams({ externalOrderId: "ext-2" }),
			);

			expect(o1.id).not.toBe(o2.id);
		});
	});

	// ── acceptOrder ──────────────────────────────────────────────────

	describe("acceptOrder", () => {
		it("accepts a pending order", async () => {
			mockProvider.acceptOrder.mockResolvedValue(undefined);
			const order = await controller.receiveOrder(makeOrderParams());

			const accepted = await controller.acceptOrder(order.id);

			expect(accepted?.status).toBe("accepted");
			expect(accepted?.updatedAt).toBeInstanceOf(Date);
		});

		it("calls provider.acceptOrder with external ID", async () => {
			mockProvider.acceptOrder.mockResolvedValue(undefined);
			const order = await controller.receiveOrder(makeOrderParams());

			await controller.acceptOrder(order.id);

			expect(mockProvider.acceptOrder).toHaveBeenCalledWith("uber-order-100");
		});

		it("returns null for nonexistent order", async () => {
			expect(await controller.acceptOrder("nonexistent")).toBeNull();
		});

		it("returns null if order is not pending", async () => {
			mockProvider.acceptOrder.mockResolvedValue(undefined);
			const order = await controller.receiveOrder(makeOrderParams());
			await controller.acceptOrder(order.id);

			const result = await controller.acceptOrder(order.id);
			expect(result).toBeNull();
		});

		it("throws when provider.acceptOrder fails", async () => {
			mockProvider.acceptOrder.mockRejectedValue(
				new Error("Uber API error: HTTP 400"),
			);
			const order = await controller.receiveOrder(makeOrderParams());

			await expect(controller.acceptOrder(order.id)).rejects.toThrow(
				"Uber Eats accept failed: Uber API error: HTTP 400",
			);
		});

		it("throws with generic message for non-Error rejection", async () => {
			mockProvider.acceptOrder.mockRejectedValue("unknown failure");
			const order = await controller.receiveOrder(makeOrderParams());

			await expect(controller.acceptOrder(order.id)).rejects.toThrow(
				"Uber Eats accept failed: Failed to accept on Uber Eats",
			);
		});

		it("emits ubereats.order.accepted event", async () => {
			mockProvider.acceptOrder.mockResolvedValue(undefined);
			const order = await controller.receiveOrder(makeOrderParams());
			vi.clearAllMocks();

			await controller.acceptOrder(order.id);

			expect(mockEvents.emit).toHaveBeenCalledWith("ubereats.order.accepted", {
				orderId: order.id,
				externalOrderId: "uber-order-100",
			});
		});

		it("persists accepted status to store", async () => {
			mockProvider.acceptOrder.mockResolvedValue(undefined);
			const order = await controller.receiveOrder(makeOrderParams());
			await controller.acceptOrder(order.id);

			const stored = (await mockData.get("uberOrder", order.id)) as Record<
				string,
				unknown
			>;
			expect(stored.status).toBe("accepted");
		});
	});

	// ── markReady ────────────────────────────────────────────────────

	describe("markReady", () => {
		it("marks an accepted order as ready", async () => {
			mockProvider.acceptOrder.mockResolvedValue(undefined);
			const order = await controller.receiveOrder(makeOrderParams());
			await controller.acceptOrder(order.id);

			const ready = await controller.markReady(order.id);
			expect(ready?.status).toBe("ready");
		});

		it("returns null for nonexistent order", async () => {
			expect(await controller.markReady("nonexistent")).toBeNull();
		});

		it("returns null if order is pending", async () => {
			const order = await controller.receiveOrder(makeOrderParams());
			expect(await controller.markReady(order.id)).toBeNull();
		});

		it("returns null if order is already delivered", async () => {
			const order = await controller.receiveOrder(makeOrderParams());
			// Manually set status to delivered
			await mockData.upsert("uberOrder", order.id, {
				...order,
				status: "delivered",
			});

			expect(await controller.markReady(order.id)).toBeNull();
		});

		it("emits ubereats.order.ready event", async () => {
			mockProvider.acceptOrder.mockResolvedValue(undefined);
			const order = await controller.receiveOrder(makeOrderParams());
			await controller.acceptOrder(order.id);
			vi.clearAllMocks();

			await controller.markReady(order.id);

			expect(mockEvents.emit).toHaveBeenCalledWith("ubereats.order.ready", {
				orderId: order.id,
				externalOrderId: "uber-order-100",
			});
		});

		it("allows marking a preparing order as ready", async () => {
			const order = await controller.receiveOrder(makeOrderParams());
			await mockData.upsert("uberOrder", order.id, {
				...order,
				status: "preparing",
			});

			const ready = await controller.markReady(order.id);
			expect(ready?.status).toBe("ready");
		});
	});

	// ── cancelOrder ──────────────────────────────────────────────────

	describe("cancelOrder", () => {
		it("cancels a pending order", async () => {
			mockProvider.cancelOrder.mockResolvedValue(undefined);
			const order = await controller.receiveOrder(makeOrderParams());

			const cancelled = await controller.cancelOrder(order.id, "Out of stock");
			expect(cancelled?.status).toBe("cancelled");
		});

		it("calls provider.cancelOrder with correct arguments", async () => {
			mockProvider.cancelOrder.mockResolvedValue(undefined);
			const order = await controller.receiveOrder(makeOrderParams());

			await controller.cancelOrder(order.id, "Out of stock");

			expect(mockProvider.cancelOrder).toHaveBeenCalledWith(
				"uber-order-100",
				"Out of stock",
				"OTHER",
			);
		});

		it("uses default reason when none provided", async () => {
			mockProvider.cancelOrder.mockResolvedValue(undefined);
			const order = await controller.receiveOrder(makeOrderParams());

			await controller.cancelOrder(order.id);

			expect(mockProvider.cancelOrder).toHaveBeenCalledWith(
				"uber-order-100",
				"Cancelled by merchant",
				"OTHER",
			);
		});

		it("returns null for nonexistent order", async () => {
			expect(await controller.cancelOrder("nonexistent")).toBeNull();
		});

		it("returns null if order is already delivered", async () => {
			const order = await controller.receiveOrder(makeOrderParams());
			await mockData.upsert("uberOrder", order.id, {
				...order,
				status: "delivered",
			});

			expect(await controller.cancelOrder(order.id)).toBeNull();
		});

		it("returns null if order is already cancelled", async () => {
			mockProvider.cancelOrder.mockResolvedValue(undefined);
			const order = await controller.receiveOrder(makeOrderParams());
			await controller.cancelOrder(order.id);

			expect(await controller.cancelOrder(order.id)).toBeNull();
		});

		it("returns null if order is picked-up", async () => {
			const order = await controller.receiveOrder(makeOrderParams());
			await mockData.upsert("uberOrder", order.id, {
				...order,
				status: "picked-up",
			});

			expect(await controller.cancelOrder(order.id)).toBeNull();
		});

		it("throws when provider.cancelOrder fails", async () => {
			mockProvider.cancelOrder.mockRejectedValue(
				new Error("Uber API error: HTTP 409"),
			);
			const order = await controller.receiveOrder(makeOrderParams());

			await expect(controller.cancelOrder(order.id)).rejects.toThrow(
				"Uber Eats cancel failed: Uber API error: HTTP 409",
			);
		});

		it("emits ubereats.order.cancelled event", async () => {
			mockProvider.cancelOrder.mockResolvedValue(undefined);
			const order = await controller.receiveOrder(makeOrderParams());
			vi.clearAllMocks();

			await controller.cancelOrder(order.id);

			expect(mockEvents.emit).toHaveBeenCalledWith("ubereats.order.cancelled", {
				orderId: order.id,
				externalOrderId: "uber-order-100",
			});
		});
	});

	// ── getOrder / listOrders ────────────────────────────────────────

	describe("getOrder", () => {
		it("returns null for missing order", async () => {
			expect(await controller.getOrder("nonexistent")).toBeNull();
		});

		it("returns a stored order", async () => {
			const order = await controller.receiveOrder(makeOrderParams());
			const fetched = await controller.getOrder(order.id);

			expect(fetched?.id).toBe(order.id);
			expect(fetched?.externalOrderId).toBe("uber-order-100");
		});
	});

	describe("listOrders", () => {
		it("lists all orders", async () => {
			await controller.receiveOrder(
				makeOrderParams({ externalOrderId: "ext-1" }),
			);
			await controller.receiveOrder(
				makeOrderParams({ externalOrderId: "ext-2" }),
			);

			const orders = await controller.listOrders();
			expect(orders).toHaveLength(2);
		});

		it("filters by status", async () => {
			mockProvider.acceptOrder.mockResolvedValue(undefined);
			const o1 = await controller.receiveOrder(
				makeOrderParams({ externalOrderId: "ext-1" }),
			);
			await controller.receiveOrder(
				makeOrderParams({ externalOrderId: "ext-2" }),
			);
			await controller.acceptOrder(o1.id);

			const accepted = await controller.listOrders({ status: "accepted" });
			expect(accepted).toHaveLength(1);
			expect(accepted[0].status).toBe("accepted");
		});

		it("supports pagination", async () => {
			await controller.receiveOrder(
				makeOrderParams({ externalOrderId: "ext-1" }),
			);
			await controller.receiveOrder(
				makeOrderParams({ externalOrderId: "ext-2" }),
			);
			await controller.receiveOrder(
				makeOrderParams({ externalOrderId: "ext-3" }),
			);

			const page = await controller.listOrders({ take: 2, skip: 1 });
			expect(page).toHaveLength(2);
		});

		it("returns empty array when no orders exist", async () => {
			const orders = await controller.listOrders();
			expect(orders).toHaveLength(0);
		});
	});

	// ── syncMenu ─────────────────────────────────────────────────────

	describe("syncMenu with provider", () => {
		it("syncs menu from Uber Eats API and returns synced status", async () => {
			mockProvider.getMenu.mockResolvedValue({
				items: [
					{ id: "item-1", name: "Burger" },
					{ id: "item-2", name: "Fries" },
				],
			});

			const sync = await controller.syncMenu(5);

			expect(sync.status).toBe("synced");
			expect(sync.itemCount).toBe(2);
			expect(sync.completedAt).toBeInstanceOf(Date);
		});

		it("uses provided itemCount when API returns no items", async () => {
			mockProvider.getMenu.mockResolvedValue({ items: [] });

			const sync = await controller.syncMenu(10);
			expect(sync.itemCount).toBe(10);
		});

		it("uses provided itemCount when API items is undefined", async () => {
			mockProvider.getMenu.mockResolvedValue({});

			const sync = await controller.syncMenu(7);
			expect(sync.itemCount).toBe(7);
		});

		it("sets status to failed when API throws", async () => {
			mockProvider.getMenu.mockRejectedValue(
				new Error("Uber API error: HTTP 503"),
			);

			const sync = await controller.syncMenu(5);

			expect(sync.status).toBe("failed");
			expect(sync.error).toBe("Uber API error: HTTP 503");
			expect(sync.completedAt).toBeInstanceOf(Date);
		});

		it("handles non-Error thrown from provider", async () => {
			mockProvider.getMenu.mockRejectedValue("string error");

			const sync = await controller.syncMenu(5);
			expect(sync.status).toBe("failed");
			expect(sync.error).toBe("Menu sync failed");
		});

		it("emits ubereats.menu.synced event on success", async () => {
			mockProvider.getMenu.mockResolvedValue({
				items: [{ id: "item-1", name: "Burger" }],
			});

			const sync = await controller.syncMenu(5);

			expect(mockEvents.emit).toHaveBeenCalledWith("ubereats.menu.synced", {
				menuSyncId: sync.id,
				itemCount: 1,
			});
		});

		it("does not emit event on failure", async () => {
			mockProvider.getMenu.mockRejectedValue(new Error("fail"));
			vi.clearAllMocks();

			await controller.syncMenu(5);

			expect(mockEvents.emit).not.toHaveBeenCalled();
		});

		it("persists sync record to store", async () => {
			mockProvider.getMenu.mockResolvedValue({ items: [] });

			const sync = await controller.syncMenu(5);

			expect(mockData.size("menuSync")).toBe(1);
			const stored = await mockData.get("menuSync", sync.id);
			expect(stored).not.toBeNull();
		});
	});

	// ── getLastMenuSync / listMenuSyncs ──────────────────────────────

	describe("getLastMenuSync", () => {
		it("returns null when no syncs exist", async () => {
			expect(await controller.getLastMenuSync()).toBeNull();
		});

		it("returns a sync when syncs exist", async () => {
			mockProvider.getMenu.mockResolvedValue({ items: [] });

			await controller.syncMenu(5);
			await controller.syncMenu(10);

			const last = await controller.getLastMenuSync();
			expect(last).not.toBeNull();
			expect(last?.status).toBe("synced");
		});
	});

	describe("listMenuSyncs", () => {
		it("lists all syncs", async () => {
			mockProvider.getMenu.mockResolvedValue({ items: [] });
			await controller.syncMenu(5);
			await controller.syncMenu(10);

			const syncs = await controller.listMenuSyncs();
			expect(syncs).toHaveLength(2);
		});

		it("supports pagination", async () => {
			mockProvider.getMenu.mockResolvedValue({ items: [] });
			await controller.syncMenu(1);
			await controller.syncMenu(2);
			await controller.syncMenu(3);

			const page = await controller.listMenuSyncs({ take: 2 });
			expect(page).toHaveLength(2);
		});
	});

	// ── getOrderStats ────────────────────────────────────────────────

	describe("getOrderStats", () => {
		it("returns zeroed stats when no orders exist", async () => {
			const stats = await controller.getOrderStats();

			expect(stats.total).toBe(0);
			expect(stats.pending).toBe(0);
			expect(stats.accepted).toBe(0);
			expect(stats.preparing).toBe(0);
			expect(stats.ready).toBe(0);
			expect(stats.delivered).toBe(0);
			expect(stats.cancelled).toBe(0);
			expect(stats.totalRevenue).toBe(0);
		});

		it("counts orders by status", async () => {
			mockProvider.acceptOrder.mockResolvedValue(undefined);
			mockProvider.cancelOrder.mockResolvedValue(undefined);

			const o1 = await controller.receiveOrder(
				makeOrderParams({ externalOrderId: "ext-1", total: 20 }),
			);
			await controller.receiveOrder(
				makeOrderParams({ externalOrderId: "ext-2", total: 15 }),
			);
			await controller.acceptOrder(o1.id);

			const o3 = await controller.receiveOrder(
				makeOrderParams({ externalOrderId: "ext-3", total: 10 }),
			);
			await controller.cancelOrder(o3.id, "test");

			const stats = await controller.getOrderStats();
			expect(stats.total).toBe(3);
			expect(stats.accepted).toBe(1);
			expect(stats.pending).toBe(1);
			expect(stats.cancelled).toBe(1);
		});

		it("excludes cancelled orders from revenue", async () => {
			mockProvider.cancelOrder.mockResolvedValue(undefined);

			await controller.receiveOrder(
				makeOrderParams({ externalOrderId: "ext-1", total: 20 }),
			);
			const o2 = await controller.receiveOrder(
				makeOrderParams({ externalOrderId: "ext-2", total: 15 }),
			);
			await controller.cancelOrder(o2.id, "test");

			const stats = await controller.getOrderStats();
			expect(stats.totalRevenue).toBe(20);
		});

		it("sums revenue from non-cancelled orders", async () => {
			mockProvider.acceptOrder.mockResolvedValue(undefined);

			const o1 = await controller.receiveOrder(
				makeOrderParams({ externalOrderId: "ext-1", total: 18.28 }),
			);
			await controller.acceptOrder(o1.id);
			const o2 = await controller.receiveOrder(
				makeOrderParams({ externalOrderId: "ext-2", total: 25.5 }),
			);
			await controller.acceptOrder(o2.id);

			const stats = await controller.getOrderStats();
			expect(stats.totalRevenue).toBeCloseTo(43.78, 2);
		});
	});
});

// ── Tests without provider ─────────────────────────────────────────────────

describe("uber-eats service-impl without provider", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createUberEatsController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createUberEatsController(mockData);
	});

	it("accepts order without calling provider", async () => {
		const order = await controller.receiveOrder(makeOrderParams());
		const accepted = await controller.acceptOrder(order.id);

		expect(accepted?.status).toBe("accepted");
	});

	it("cancels order without calling provider", async () => {
		const order = await controller.receiveOrder(makeOrderParams());
		const cancelled = await controller.cancelOrder(order.id);

		expect(cancelled?.status).toBe("cancelled");
	});

	it("syncs menu locally without provider", async () => {
		const sync = await controller.syncMenu(15);

		expect(sync.status).toBe("synced");
		expect(sync.itemCount).toBe(15);
		expect(sync.completedAt).toBeInstanceOf(Date);
	});

	it("computes order stats without provider", async () => {
		await controller.receiveOrder(
			makeOrderParams({ externalOrderId: "ext-1", total: 10 }),
		);
		await controller.receiveOrder(
			makeOrderParams({ externalOrderId: "ext-2", total: 20 }),
		);

		const stats = await controller.getOrderStats();
		expect(stats.total).toBe(2);
		expect(stats.totalRevenue).toBe(30);
	});
});

// ── Order state machine edge cases ──────────────────────────────────────────

describe("uber-eats order state transitions", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createUberEatsController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createUberEatsController(mockData);
	});

	it("follows pending → accepted → ready lifecycle", async () => {
		const order = await controller.receiveOrder(makeOrderParams());
		expect(order.status).toBe("pending");

		const accepted = await controller.acceptOrder(order.id);
		expect(accepted?.status).toBe("accepted");

		const ready = await controller.markReady(order.id);
		expect(ready?.status).toBe("ready");
	});

	it("cannot accept a cancelled order", async () => {
		const order = await controller.receiveOrder(makeOrderParams());
		await controller.cancelOrder(order.id);

		expect(await controller.acceptOrder(order.id)).toBeNull();
	});

	it("cannot mark a pending order as ready", async () => {
		const order = await controller.receiveOrder(makeOrderParams());
		expect(await controller.markReady(order.id)).toBeNull();
	});

	it("cannot cancel a delivered order", async () => {
		const order = await controller.receiveOrder(makeOrderParams());
		await mockData.upsert("uberOrder", order.id, {
			...order,
			status: "delivered",
		});

		expect(await controller.cancelOrder(order.id)).toBeNull();
	});

	it("can cancel an accepted order", async () => {
		const order = await controller.receiveOrder(makeOrderParams());
		await controller.acceptOrder(order.id);

		const cancelled = await controller.cancelOrder(order.id);
		expect(cancelled?.status).toBe("cancelled");
	});

	it("can cancel a ready order", async () => {
		const order = await controller.receiveOrder(makeOrderParams());
		await controller.acceptOrder(order.id);
		await controller.markReady(order.id);

		const cancelled = await controller.cancelOrder(order.id);
		expect(cancelled?.status).toBe("cancelled");
	});
});
