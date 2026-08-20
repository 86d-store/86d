import { createEventBus, createScopedEmitter } from "@86d-app/core/events";
import {
	createMockDataService,
	createMockModuleContext,
} from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import loyalty from "../index";

describe("Loyalty activation and durable-fact containment", () => {
	it("is disabled by default across endpoints, pages, and Store search", () => {
		const module = loyalty();

		expect(module.endpoints).toEqual({ store: {}, admin: {} });
		expect(module.admin?.pages).toEqual([]);
		expect(module.store?.pages).toEqual([]);
		expect(module.search).toBeUndefined();
	});

	it("does not award twice from duplicate process-local Order facts", async () => {
		const data = createMockDataService();
		const bus = createEventBus();
		const loyaltyEvents = createScopedEmitter(bus, "loyalty");
		const orderEvents = createScopedEmitter(bus, "orders");
		const module = loyalty({ enabled: true });

		await module.init?.({
			...createMockModuleContext({ data }),
			events: loyaltyEvents,
		});
		await data.upsert("loyaltyRule", "rule-1", {
			id: "rule-1",
			name: "Base earn",
			type: "per_dollar",
			points: 1,
			active: true,
		});

		const fact = {
			orderId: "order-1",
			customerId: "customer-1",
			total: 5_000,
			currency: "USD",
		};
		await orderEvents.emit("order.placed", fact);
		await orderEvents.emit("order.placed", fact);

		expect(bus.listenerCount("order.placed")).toBe(0);
		expect(data.all("loyaltyAccount")).toHaveLength(0);
		expect(data.all("loyaltyTransaction")).toHaveLength(0);
	});

	it("does not apply duplicate cancellation or refund reversals without a durable loyalty ledger", async () => {
		const data = createMockDataService();
		const bus = createEventBus();
		const module = loyalty({ enabled: true });
		await module.init?.({
			...createMockModuleContext({ data }),
			events: createScopedEmitter(bus, "loyalty"),
		});
		const orderEvents = createScopedEmitter(bus, "orders");
		const fact = { orderId: "order-1", customerId: "customer-1" };

		await orderEvents.emit("order.cancelled", fact);
		await orderEvents.emit("order.cancelled", fact);
		await orderEvents.emit("order.refunded", fact);
		await orderEvents.emit("order.refunded", fact);

		expect(data.all("loyaltyAccount")).toHaveLength(0);
		expect(data.all("loyaltyTransaction")).toHaveLength(0);
	});
});
