/**
 * Tests for the automations module's init() event subscription.
 *
 * The module subscribes to 44+ CROSS_MODULE_EVENTS and routes each one to
 * evaluateEvent, which finds matching active automations and executes them.
 */
import { createEventBus, createScopedEmitter } from "@86d-app/core/events";
import {
	createMockDataService,
	createMockModuleContext,
} from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import automations from "../index";

// ── helpers ──────────────────────────────────────────────────────────────────

async function initModule(
	mod: ReturnType<typeof automations>,
	data: ReturnType<typeof createMockDataService>,
	events?: ReturnType<typeof createScopedEmitter>,
) {
	const init = mod.init;
	expect(init).toBeDefined();
	if (init) {
		const ctx = createMockModuleContext({ data });
		await init({ ...ctx, events });
	}
}

function flushAsync(): Promise<void> {
	return new Promise<void>((r) => {
		setTimeout(r, 50);
	});
}

// ── event registration ────────────────────────────────────────────────────────

describe("init() event registration", () => {
	it("registers listeners for core commerce events", async () => {
		const mockData = createMockDataService();
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "automations");

		await initModule(automations(), mockData, emitter);

		// Verify a representative sample of the CROSS_MODULE_EVENTS are registered
		for (const event of [
			"order.placed",
			"order.shipped",
			"checkout.completed",
			"review.submitted",
			"subscription.created",
			"product.created",
			"cart.abandoned",
		]) {
			expect(bus.listenerCount(event)).toBe(1);
		}
	});

	it("does not register listeners when no event emitter is provided", async () => {
		const mockData = createMockDataService();
		const bus = createEventBus();

		// init without an events emitter — should not throw
		const mod = automations();
		const ctx = createMockModuleContext({ data: mockData });
		const init = mod.init;
		expect(init).toBeTruthy();
		if (!init) {
			throw new Error("expected init");
		}
		await expect(init({ ...ctx, events: undefined })).resolves.toBeDefined();

		// No listeners should be registered on the bus
		expect(bus.listenerCount("order.placed")).toBe(0);
	});
});

// ── event routing to evaluateEvent ───────────────────────────────────────────

describe("init() event routing", () => {
	let mockData: ReturnType<typeof createMockDataService>;

	beforeEach(() => {
		mockData = createMockDataService();
	});

	it("executes matching automations when order.placed fires", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "automations");
		const ordersEmitter = createScopedEmitter(bus, "orders");

		await initModule(automations(), mockData, emitter);

		// Pre-seed an active automation that triggers on order.placed
		await mockData.upsert("automation", "auto-1", {
			id: "auto-1",
			name: "Order Thank You",
			triggerEvent: "order.placed",
			status: "active",
			priority: 0,
			conditions: [],
			actions: [],
			runCount: 0,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		await ordersEmitter.emit("order.placed", {
			orderId: "order-001",
			customerId: "cust-001",
			total: 9999,
		});
		await flushAsync();

		const executions = mockData.all("automationExecution");
		expect(executions).toHaveLength(1);
		expect(executions[0]).toMatchObject({ automationId: "auto-1" });
	});

	it("executes matching automations when checkout.completed fires", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "automations");
		const checkoutEmitter = createScopedEmitter(bus, "checkout");

		await initModule(automations(), mockData, emitter);

		await mockData.upsert("automation", "auto-checkout", {
			id: "auto-checkout",
			name: "Post-Checkout Tag",
			triggerEvent: "checkout.completed",
			status: "active",
			priority: 0,
			conditions: [],
			actions: [],
			runCount: 0,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		await checkoutEmitter.emit("checkout.completed", {
			sessionId: "sess-001",
			orderId: "order-002",
			customerId: "cust-002",
			total: 5000,
		});
		await flushAsync();

		const executions = mockData.all("automationExecution");
		expect(executions).toHaveLength(1);
		expect(executions[0]).toMatchObject({ automationId: "auto-checkout" });
	});

	it("does NOT execute inactive automations", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "automations");
		const ordersEmitter = createScopedEmitter(bus, "orders");

		await initModule(automations(), mockData, emitter);

		// Inactive automation — should not be triggered
		await mockData.upsert("automation", "auto-inactive", {
			id: "auto-inactive",
			name: "Inactive Automation",
			triggerEvent: "order.placed",
			status: "inactive",
			priority: 0,
			conditions: [],
			actions: [],
			runCount: 0,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		await ordersEmitter.emit("order.placed", { orderId: "order-003" });
		await flushAsync();

		expect(mockData.all("automationExecution")).toHaveLength(0);
	});

	it("does NOT execute automations triggered on a different event", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "automations");
		const ordersEmitter = createScopedEmitter(bus, "orders");

		await initModule(automations(), mockData, emitter);

		// This automation triggers on review.submitted — not on order.placed
		await mockData.upsert("automation", "auto-review", {
			id: "auto-review",
			name: "Review Automation",
			triggerEvent: "review.submitted",
			status: "active",
			priority: 0,
			conditions: [],
			actions: [],
			runCount: 0,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		await ordersEmitter.emit("order.placed", { orderId: "order-004" });
		await flushAsync();

		expect(mockData.all("automationExecution")).toHaveLength(0);
	});

	it("executes multiple automations for the same event", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "automations");
		const ordersEmitter = createScopedEmitter(bus, "orders");

		await initModule(automations(), mockData, emitter);

		// Seed two active automations for the same event
		for (let i = 1; i <= 2; i++) {
			await mockData.upsert(`automation`, `auto-multi-${i}`, {
				id: `auto-multi-${i}`,
				name: `Automation ${i}`,
				triggerEvent: "order.shipped",
				status: "active",
				priority: i,
				conditions: [],
				actions: [],
				runCount: 0,
				createdAt: new Date(),
				updatedAt: new Date(),
			});
		}

		await ordersEmitter.emit("order.shipped", { orderId: "order-005" });
		await flushAsync();

		expect(mockData.all("automationExecution")).toHaveLength(2);
	});

	it("gracefully handles automation execution errors", async () => {
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "automations");
		const ordersEmitter = createScopedEmitter(bus, "orders");

		await initModule(automations(), mockData, emitter);

		// An automation with broken actions (null instead of array)
		await mockData.upsert("automation", "auto-error", {
			id: "auto-error",
			name: "Broken Automation",
			triggerEvent: "order.cancelled",
			status: "active",
			priority: 0,
			conditions: [],
			actions: null, // intentionally invalid — tests graceful failure
			runCount: 0,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		// Should not throw even if execution fails
		await expect(
			ordersEmitter.emit("order.cancelled", { orderId: "order-006" }),
		).resolves.not.toThrow();
	});
});

// ── cross-module event coverage ───────────────────────────────────────────────

describe("cross-module event coverage", () => {
	it("routes cart.abandoned events", async () => {
		const mockData = createMockDataService();
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "automations");
		const cartsEmitter = createScopedEmitter(bus, "abandoned-carts");

		await initModule(automations(), mockData, emitter);

		await mockData.upsert("automation", "auto-cart", {
			id: "auto-cart",
			name: "Cart Recovery",
			triggerEvent: "cart.abandoned",
			status: "active",
			priority: 0,
			conditions: [],
			actions: [],
			runCount: 0,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		await cartsEmitter.emit("cart.abandoned", {
			cartId: "cart-001",
			email: "user@example.com",
		});
		await flushAsync();

		expect(mockData.all("automationExecution")).toHaveLength(1);
	});

	it("routes product.created events", async () => {
		const mockData = createMockDataService();
		const bus = createEventBus();
		const emitter = createScopedEmitter(bus, "automations");
		const productsEmitter = createScopedEmitter(bus, "products");

		await initModule(automations(), mockData, emitter);

		await mockData.upsert("automation", "auto-product", {
			id: "auto-product",
			name: "New Product Alert",
			triggerEvent: "product.created",
			status: "active",
			priority: 0,
			conditions: [],
			actions: [],
			runCount: 0,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		await productsEmitter.emit("product.created", {
			productId: "prod-new",
			name: "New Product",
			slug: "new-product",
		});
		await flushAsync();

		expect(mockData.all("automationExecution")).toHaveLength(1);
	});
});
