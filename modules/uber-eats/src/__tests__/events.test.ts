import type { ScopedEventEmitter } from "@86d-app/core/events";
import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it, vi } from "vitest";
import { createUberEatsController } from "../service-impl";

function createMockEvents(): ScopedEventEmitter & {
	emitted: Array<{ type: string; payload: unknown }>;
} {
	const emitted: Array<{ type: string; payload: unknown }> = [];
	return {
		emitted,
		emit: vi.fn(async (type: string, payload: unknown) => {
			emitted.push({ type, payload });
		}),
		on: vi.fn(() => () => {}),
		off: vi.fn(),
	};
}

describe("ubereats.order.received event", () => {
	it("emits when an order is received", async () => {
		const events = createMockEvents();
		const ctrl = createUberEatsController(createMockDataService(), events);

		const order = await ctrl.receiveOrder({
			externalOrderId: "ue-1",
			items: [{ name: "Burger" }],
			subtotal: 10,
			deliveryFee: 3,
			tax: 1,
			total: 14,
		});

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("ubereats.order.received");
		expect(events.emitted[0].payload).toEqual({
			orderId: order.id,
			externalOrderId: "ue-1",
			total: 14,
		});
	});
});

describe("ubereats.order.accepted event", () => {
	it("emits when order is accepted", async () => {
		const events = createMockEvents();
		const ctrl = createUberEatsController(createMockDataService(), events);

		const order = await ctrl.receiveOrder({
			externalOrderId: "ue-2",
			items: [],
			subtotal: 10,
			deliveryFee: 3,
			tax: 1,
			total: 14,
		});
		events.emitted.length = 0;

		await ctrl.acceptOrder(order.id);

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("ubereats.order.accepted");
	});
});

describe("ubereats.order.ready event", () => {
	it("emits when order is marked ready", async () => {
		const events = createMockEvents();
		const ctrl = createUberEatsController(createMockDataService(), events);

		const order = await ctrl.receiveOrder({
			externalOrderId: "ue-3",
			items: [],
			subtotal: 10,
			deliveryFee: 3,
			tax: 1,
			total: 14,
		});
		await ctrl.acceptOrder(order.id);
		events.emitted.length = 0;

		await ctrl.markReady(order.id);

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("ubereats.order.ready");
	});
});

describe("ubereats.order.cancelled event", () => {
	it("emits when order is cancelled", async () => {
		const events = createMockEvents();
		const ctrl = createUberEatsController(createMockDataService(), events);

		const order = await ctrl.receiveOrder({
			externalOrderId: "ue-4",
			items: [],
			subtotal: 10,
			deliveryFee: 3,
			tax: 1,
			total: 14,
		});
		events.emitted.length = 0;

		await ctrl.cancelOrder(order.id);

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("ubereats.order.cancelled");
	});

	it("does not emit when cancel fails", async () => {
		const events = createMockEvents();
		const ctrl = createUberEatsController(createMockDataService(), events);

		const order = await ctrl.receiveOrder({
			externalOrderId: "ue-5",
			items: [],
			subtotal: 10,
			deliveryFee: 3,
			tax: 1,
			total: 14,
		});
		await ctrl.cancelOrder(order.id);
		events.emitted.length = 0;

		await ctrl.cancelOrder(order.id);
		expect(
			events.emitted.filter((e) => e.type === "ubereats.order.cancelled"),
		).toHaveLength(0);
	});
});

describe("ubereats.menu.synced event", () => {
	it("emits when menu is synced", async () => {
		const events = createMockEvents();
		const ctrl = createUberEatsController(createMockDataService(), events);

		const sync = await ctrl.syncMenu(15);

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("ubereats.menu.synced");
		expect(events.emitted[0].payload).toEqual({
			menuSyncId: sync.id,
			itemCount: 15,
		});
	});
});

describe("no events without emitter", () => {
	it("works without event emitter", async () => {
		const ctrl = createUberEatsController(createMockDataService());

		const order = await ctrl.receiveOrder({
			externalOrderId: "ue-6",
			items: [],
			subtotal: 10,
			deliveryFee: 3,
			tax: 1,
			total: 14,
		});
		await ctrl.acceptOrder(order.id);
		const ready = await ctrl.markReady(order.id);
		await ctrl.syncMenu(10);
		expect(ready.status).toBe("ready");
	});
});

describe("full order lifecycle event sequence", () => {
	it("emits events in correct order", async () => {
		const events = createMockEvents();
		const ctrl = createUberEatsController(createMockDataService(), events);

		const order = await ctrl.receiveOrder({
			externalOrderId: "ue-7",
			items: [],
			subtotal: 10,
			deliveryFee: 3,
			tax: 1,
			total: 14,
		});
		await ctrl.acceptOrder(order.id);
		await ctrl.markReady(order.id);

		const types = events.emitted.map((e) => e.type);
		expect(types).toEqual([
			"ubereats.order.received",
			"ubereats.order.accepted",
			"ubereats.order.ready",
		]);
	});
});
