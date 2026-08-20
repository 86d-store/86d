import type { ScopedEventEmitter } from "@86d-app/core/events";
import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it, vi } from "vitest";
import { createDoordashController } from "../service-impl";

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

describe("doordash.delivery.created event", () => {
	it("emits when a delivery is created", async () => {
		const events = createMockEvents();
		const ctrl = createDoordashController(createMockDataService(), events);

		const delivery = await ctrl.createDelivery({
			orderId: "order-1",
			pickupAddress: {},
			dropoffAddress: {},
			fee: 5.0,
		});

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("doordash.delivery.created");
		expect(events.emitted[0].payload).toEqual({
			deliveryId: delivery.id,
			orderId: "order-1",
		});
	});
});

describe("doordash.delivery.picked-up event", () => {
	it("emits when delivery is picked up", async () => {
		const events = createMockEvents();
		const ctrl = createDoordashController(createMockDataService(), events);

		const delivery = await ctrl.createDelivery({
			orderId: "order-2",
			pickupAddress: {},
			dropoffAddress: {},
			fee: 5.0,
		});
		events.emitted.length = 0;

		await ctrl.updateDeliveryStatus(delivery.id, "picked-up");

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("doordash.delivery.picked-up");
	});
});

describe("doordash.delivery.delivered event", () => {
	it("emits when delivery is delivered", async () => {
		const events = createMockEvents();
		const ctrl = createDoordashController(createMockDataService(), events);

		const delivery = await ctrl.createDelivery({
			orderId: "order-3",
			pickupAddress: {},
			dropoffAddress: {},
			fee: 5.0,
		});
		events.emitted.length = 0;

		await ctrl.updateDeliveryStatus(delivery.id, "delivered");

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("doordash.delivery.delivered");
	});
});

describe("doordash.delivery.cancelled event", () => {
	it("emits when delivery is cancelled", async () => {
		const events = createMockEvents();
		const ctrl = createDoordashController(createMockDataService(), events);

		const delivery = await ctrl.createDelivery({
			orderId: "order-4",
			pickupAddress: {},
			dropoffAddress: {},
			fee: 5.0,
		});
		events.emitted.length = 0;

		await ctrl.cancelDelivery(delivery.id);

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("doordash.delivery.cancelled");
	});

	it("does not emit when cancel fails on delivered delivery", async () => {
		const events = createMockEvents();
		const ctrl = createDoordashController(createMockDataService(), events);

		const delivery = await ctrl.createDelivery({
			orderId: "order-5",
			pickupAddress: {},
			dropoffAddress: {},
			fee: 5.0,
		});
		await ctrl.updateDeliveryStatus(delivery.id, "delivered");
		events.emitted.length = 0;

		await ctrl.cancelDelivery(delivery.id);

		expect(
			events.emitted.filter((e) => e.type === "doordash.delivery.cancelled"),
		).toHaveLength(0);
	});
});

describe("no events without emitter", () => {
	it("works without event emitter", async () => {
		const ctrl = createDoordashController(createMockDataService());

		const delivery = await ctrl.createDelivery({
			orderId: "order-6",
			pickupAddress: {},
			dropoffAddress: {},
			fee: 5.0,
		});
		await ctrl.updateDeliveryStatus(delivery.id, "picked-up");
		await ctrl.updateDeliveryStatus(delivery.id, "delivered");
	});
});

describe("full delivery lifecycle event sequence", () => {
	it("emits events in correct order", async () => {
		const events = createMockEvents();
		const ctrl = createDoordashController(createMockDataService(), events);

		const delivery = await ctrl.createDelivery({
			orderId: "order-7",
			pickupAddress: {},
			dropoffAddress: {},
			fee: 5.0,
		});
		await ctrl.updateDeliveryStatus(delivery.id, "accepted");
		await ctrl.updateDeliveryStatus(delivery.id, "picked-up");
		await ctrl.updateDeliveryStatus(delivery.id, "delivered");

		const types = events.emitted.map((e) => e.type);
		expect(types).toEqual([
			"doordash.delivery.created",
			"doordash.delivery.picked-up",
			"doordash.delivery.delivered",
		]);
	});
});
