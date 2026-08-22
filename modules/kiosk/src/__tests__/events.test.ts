import type { ScopedEventEmitter } from "@86d-app/core/events";
import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it, vi } from "vitest";
import { createKioskController } from "../service-impl";

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

describe("kiosk.registered event", () => {
	it("emits when a station is registered", async () => {
		const events = createMockEvents();
		const ctrl = createKioskController(createMockDataService(), events);

		const station = await ctrl.registerStation({ name: "Kiosk 1" });

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("kiosk.registered");
		expect(events.emitted[0].payload).toEqual({
			stationId: station.id,
			name: "Kiosk 1",
		});
	});
});

describe("kiosk.heartbeat event", () => {
	it("emits on heartbeat", async () => {
		const events = createMockEvents();
		const ctrl = createKioskController(createMockDataService(), events);

		const station = await ctrl.registerStation({ name: "HB" });
		events.emitted.length = 0;

		await ctrl.heartbeat(station.id);

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("kiosk.heartbeat");
	});

	it("does not emit for non-existent station", async () => {
		const events = createMockEvents();
		const ctrl = createKioskController(createMockDataService(), events);

		await ctrl.heartbeat("non-existent");
		expect(
			events.emitted.filter((e) => e.type === "kiosk.heartbeat"),
		).toHaveLength(0);
	});
});

describe("kiosk.session.started event", () => {
	it("emits when session starts", async () => {
		const events = createMockEvents();
		const ctrl = createKioskController(createMockDataService(), events);

		const station = await ctrl.registerStation({ name: "S1" });
		events.emitted.length = 0;

		const session = await ctrl.startSession(station.id);

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("kiosk.session.started");
		expect(events.emitted[0].payload).toEqual({
			sessionId: session?.id as string,
			stationId: station.id,
		});
	});
});

describe("kiosk.order.paid event", () => {
	it("emits when session is completed", async () => {
		const events = createMockEvents();
		const ctrl = createKioskController(createMockDataService(), events);

		const station = await ctrl.registerStation({ name: "S1" });
		const session = await ctrl.startSession(station.id);
		await ctrl.addItem(session?.id as string, {
			name: "Burger",
			price: 10,
			quantity: 1,
		});
		events.emitted.length = 0;

		await ctrl.completeSession(session?.id as string, "credit-card");

		const paidEvent = events.emitted.find((e) => e.type === "kiosk.order.paid");
		expect(paidEvent).toBeDefined();
		const payload = paidEvent?.payload as Record<string, unknown>;
		expect(payload.paymentMethod).toBe("credit-card");
	});
});

describe("kiosk.session.ended event", () => {
	it("emits with completed status on completion", async () => {
		const events = createMockEvents();
		const ctrl = createKioskController(createMockDataService(), events);

		const station = await ctrl.registerStation({ name: "S1" });
		const session = await ctrl.startSession(station.id);
		events.emitted.length = 0;

		await ctrl.completeSession(session?.id as string, "card");

		const endedEvent = events.emitted.find(
			(e) => e.type === "kiosk.session.ended",
		);
		expect(endedEvent).toBeDefined();
		const payload = endedEvent?.payload as Record<string, unknown>;
		expect(payload.status).toBe("completed");
	});

	it("emits with abandoned status on abandon", async () => {
		const events = createMockEvents();
		const ctrl = createKioskController(createMockDataService(), events);

		const station = await ctrl.registerStation({ name: "S1" });
		const session = await ctrl.startSession(station.id);
		events.emitted.length = 0;

		await ctrl.abandonSession(session?.id as string);

		const endedEvent = events.emitted.find(
			(e) => e.type === "kiosk.session.ended",
		);
		expect(endedEvent).toBeDefined();
		const payload = endedEvent?.payload as Record<string, unknown>;
		expect(payload.status).toBe("abandoned");
	});
});

describe("no events without emitter", () => {
	it("works without event emitter", async () => {
		const ctrl = createKioskController(createMockDataService());

		const station = await ctrl.registerStation({ name: "S1" });
		await ctrl.heartbeat(station.id);
		const session = await ctrl.startSession(station.id);
		await ctrl.addItem(session?.id as string, {
			name: "Item",
			price: 5,
			quantity: 1,
		});
		await expect(
			ctrl.completeSession(session?.id as string, "cash"),
		).resolves.toBeUndefined();
	});
});

describe("full kiosk lifecycle event sequence", () => {
	it("emits events in correct order", async () => {
		const events = createMockEvents();
		const ctrl = createKioskController(createMockDataService(), events);

		const station = await ctrl.registerStation({ name: "S1" });
		await ctrl.heartbeat(station.id);
		const session = await ctrl.startSession(station.id);
		await ctrl.addItem(session?.id as string, {
			name: "Item",
			price: 5,
			quantity: 1,
		});
		await ctrl.completeSession(session?.id as string, "card");

		const types = events.emitted.map((e) => e.type);
		expect(types).toEqual([
			"kiosk.registered",
			"kiosk.heartbeat",
			"kiosk.session.started",
			"kiosk.order.paid",
			"kiosk.session.ended",
		]);
	});
});
