import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createKioskController } from "../service-impl";

/**
 * Store endpoint integration tests for the kiosk module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. start-session: begins a kiosk ordering session
 * 2. get-session: retrieves a session by id
 * 3. add-item: adds an item to the session cart
 * 4. remove-item: removes an item from the session cart
 * 5. update-item: updates item quantity (removes when qty === 0)
 * 6. complete-session: completes the kiosk order
 * 7. abandon-session: abandons the session
 * 8. heartbeat: marks a station online and updates lastHeartbeat
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateStartSession(data: DataService, stationId: string) {
	const controller = createKioskController(data);
	const station = await controller.getStation(stationId);
	if (!station) {
		return { error: "Station not found", status: 404 };
	}
	const session = await controller.startSession(stationId);
	if (!session) {
		return { error: "Cannot start session", status: 400 };
	}
	return { session };
}

async function simulateAddItem(
	data: DataService,
	sessionId: string,
	item: { name: string; price: number; quantity: number },
) {
	const controller = createKioskController(data);
	const session = await controller.addItem(sessionId, item);
	if (!session) {
		return { error: "Session not found", status: 404 };
	}
	return { session };
}

async function simulateCompleteSession(
	data: DataService,
	sessionId: string,
	paymentMethod: string,
) {
	const controller = createKioskController(data);
	const session = await controller.completeSession(sessionId, paymentMethod);
	if (!session) {
		return { error: "Cannot complete session", status: 400 };
	}
	return { session };
}

async function simulateAbandonSession(data: DataService, sessionId: string) {
	const controller = createKioskController(data);
	const session = await controller.abandonSession(sessionId);
	if (!session) {
		return { error: "Session not found", status: 404 };
	}
	return { session };
}

async function simulateGetSession(data: DataService, sessionId: string) {
	const controller = createKioskController(data);
	const session = await controller.getSession(sessionId);
	if (!session) {
		return { error: "Session not found", status: 404 };
	}
	return { session };
}

async function simulateRemoveItem(
	data: DataService,
	sessionId: string,
	itemId: string,
) {
	const controller = createKioskController(data);
	const session = await controller.removeItem(sessionId, itemId);
	if (!session) {
		return { error: "Session or item not found", status: 404 };
	}
	return { session };
}

async function simulateUpdateItem(
	data: DataService,
	sessionId: string,
	itemId: string,
	quantity: number,
) {
	const controller = createKioskController(data);
	const session = await controller.updateItemQuantity(
		sessionId,
		itemId,
		quantity,
	);
	if (!session) {
		return { error: "Session or item not found", status: 404 };
	}
	return { session };
}

async function simulateHeartbeat(data: DataService, stationId: string) {
	const controller = createKioskController(data);
	const station = await controller.heartbeat(stationId);
	if (!station) {
		return { error: "Station not found", status: 404 };
	}
	return { station };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: start session", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("starts a session at a registered station", async () => {
		const ctrl = createKioskController(data);
		const station = await ctrl.registerStation({
			name: "Front Kiosk",
			location: "entrance",
		});

		const result = await simulateStartSession(data, station.id);

		expect("session" in result).toBe(true);
		if (!("session" in result)) {
			throw new Error("expected 'session' in result");
		}
		expect(result.session.stationId).toBe(station.id);
		expect(result.session.status).toBe("active");
	});

	it("returns 404 for nonexistent station", async () => {
		const result = await simulateStartSession(data, "ghost_station");

		expect(result).toEqual({ error: "Station not found", status: 404 });
	});
});

describe("store endpoint: add/remove items", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("adds an item to the session", async () => {
		const ctrl = createKioskController(data);
		const station = await ctrl.registerStation({
			name: "Kiosk 1",
			location: "lobby",
		});
		const session = await ctrl.startSession(station.id);
		if (!session) throw new Error("startSession returned null");

		const result = await simulateAddItem(data, session.id, {
			name: "Burger",
			quantity: 2,
			price: 899,
		});

		expect("session" in result).toBe(true);
		if (!("session" in result)) {
			throw new Error("expected 'session' in result");
		}
		expect(result.session.items.length).toBeGreaterThanOrEqual(1);
	});
});

describe("store endpoint: complete session", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("completes a session with payment", async () => {
		const ctrl = createKioskController(data);
		const station = await ctrl.registerStation({
			name: "Kiosk 2",
			location: "counter",
		});
		const session = await ctrl.startSession(station.id);
		if (!session) throw new Error("startSession returned null");
		await ctrl.addItem(session.id, {
			name: "Fries",
			quantity: 1,
			price: 399,
		});

		const result = await simulateCompleteSession(data, session.id, "card");

		expect("session" in result).toBe(true);
		if (!("session" in result)) {
			throw new Error("expected 'session' in result");
		}
		expect(result.session.status).toBe("completed");
	});
});

describe("store endpoint: abandon session", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("abandons an active session", async () => {
		const ctrl = createKioskController(data);
		const station = await ctrl.registerStation({
			name: "Kiosk 3",
			location: "patio",
		});
		const session = await ctrl.startSession(station.id);
		if (!session) throw new Error("startSession returned null");

		const result = await simulateAbandonSession(data, session.id);

		expect("session" in result).toBe(true);
		if (!("session" in result)) {
			throw new Error("expected 'session' in result");
		}
		expect(result.session.status).toBe("abandoned");
	});
});

describe("store endpoint: get session", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns an active session by id", async () => {
		const ctrl = createKioskController(data);
		const station = await ctrl.registerStation({
			name: "Kiosk 4",
			location: "bar",
		});
		const session = await ctrl.startSession(station.id);
		if (!session) throw new Error("startSession returned null");

		const result = await simulateGetSession(data, session.id);

		expect("session" in result).toBe(true);
		if (!("session" in result)) {
			throw new Error("expected 'session' in result");
		}
		expect(result.session.id).toBe(session.id);
		expect(result.session.status).toBe("active");
	});

	it("returns 404 for nonexistent session", async () => {
		const result = await simulateGetSession(data, "ghost_session");

		expect(result).toEqual({ error: "Session not found", status: 404 });
	});

	it("returns session with correct stationId", async () => {
		const ctrl = createKioskController(data);
		const station = await ctrl.registerStation({
			name: "Kiosk 5",
			location: "drive-thru",
		});
		const session = await ctrl.startSession(station.id);
		if (!session) throw new Error("startSession returned null");

		const result = await simulateGetSession(data, session.id);

		expect("session" in result).toBeTruthy();
		if (!("session" in result)) {
			throw new Error("expected 'session' in result");
		}
		expect(result.session.stationId).toBe(station.id);
	});
});

describe("store endpoint: remove item", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("removes an item from the session", async () => {
		const ctrl = createKioskController(data);
		const station = await ctrl.registerStation({
			name: "Kiosk 6",
			location: "kiosk-a",
		});
		const session = await ctrl.startSession(station.id);
		if (!session) throw new Error("startSession returned null");

		const updated = await ctrl.addItem(session.id, {
			name: "Pizza",
			quantity: 1,
			price: 1200,
		});
		if (!updated) throw new Error("addItem returned null");
		const itemId = updated.items[0].id;

		const result = await simulateRemoveItem(data, session.id, itemId);

		expect("session" in result).toBe(true);
		if (!("session" in result)) {
			throw new Error("expected 'session' in result");
		}
		expect(result.session.items).toHaveLength(0);
		expect(result.session.subtotal).toBe(0);
	});

	it("returns 404 for nonexistent item", async () => {
		const ctrl = createKioskController(data);
		const station = await ctrl.registerStation({
			name: "Kiosk 7",
			location: "kiosk-b",
		});
		const session = await ctrl.startSession(station.id);
		if (!session) throw new Error("startSession returned null");

		const result = await simulateRemoveItem(data, session.id, "ghost_item");

		expect(result).toEqual({ error: "Session or item not found", status: 404 });
	});

	it("returns 404 for nonexistent session", async () => {
		const result = await simulateRemoveItem(
			data,
			"ghost_session",
			"ghost_item",
		);

		expect(result).toEqual({ error: "Session or item not found", status: 404 });
	});

	it("recalculates totals after removal", async () => {
		const ctrl = createKioskController(data);
		const station = await ctrl.registerStation({
			name: "Kiosk 8",
			location: "kiosk-c",
		});
		const session = await ctrl.startSession(station.id);
		if (!session) throw new Error("startSession returned null");

		await ctrl.addItem(session.id, { name: "Soda", quantity: 1, price: 300 });
		const withTwo = await ctrl.addItem(session.id, {
			name: "Fries",
			quantity: 2,
			price: 400,
		});
		if (!withTwo) throw new Error("addItem returned null");
		const sodaId = withTwo.items.find((i) => i.name === "Soda")?.id;
		if (!sodaId) throw new Error("Could not find Soda item");

		const result = await simulateRemoveItem(data, session.id, sodaId);

		expect("session" in result).toBeTruthy();
		if (!("session" in result)) {
			throw new Error("expected 'session' in result");
		}
		expect(result.session.items).toHaveLength(1);
		expect(result.session.subtotal).toBe(800);
	});
});

describe("store endpoint: update item quantity", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("updates item quantity", async () => {
		const ctrl = createKioskController(data);
		const station = await ctrl.registerStation({
			name: "Kiosk 9",
			location: "kiosk-d",
		});
		const session = await ctrl.startSession(station.id);
		if (!session) throw new Error("startSession returned null");

		const withItem = await ctrl.addItem(session.id, {
			name: "Burger",
			quantity: 1,
			price: 900,
		});
		if (!withItem) throw new Error("addItem returned null");
		const itemId = withItem.items[0].id;

		const result = await simulateUpdateItem(data, session.id, itemId, 3);

		expect("session" in result).toBe(true);
		if (!("session" in result)) {
			throw new Error("expected 'session' in result");
		}
		expect(result.session.items[0].quantity).toBe(3);
		expect(result.session.subtotal).toBe(2700);
	});

	it("removes item when quantity is set to 0", async () => {
		const ctrl = createKioskController(data);
		const station = await ctrl.registerStation({
			name: "Kiosk 10",
			location: "kiosk-e",
		});
		const session = await ctrl.startSession(station.id);
		if (!session) throw new Error("startSession returned null");

		const withItem = await ctrl.addItem(session.id, {
			name: "Drink",
			quantity: 2,
			price: 350,
		});
		if (!withItem) throw new Error("addItem returned null");
		const itemId = withItem.items[0].id;

		const result = await simulateUpdateItem(data, session.id, itemId, 0);

		expect("session" in result).toBe(true);
		if (!("session" in result)) {
			throw new Error("expected 'session' in result");
		}
		expect(result.session.items).toHaveLength(0);
		expect(result.session.subtotal).toBe(0);
	});

	it("returns 404 for nonexistent item", async () => {
		const ctrl = createKioskController(data);
		const station = await ctrl.registerStation({
			name: "Kiosk 11",
			location: "kiosk-f",
		});
		const session = await ctrl.startSession(station.id);
		if (!session) throw new Error("startSession returned null");

		const result = await simulateUpdateItem(data, session.id, "ghost_item", 2);

		expect(result).toEqual({ error: "Session or item not found", status: 404 });
	});

	it("returns 404 for nonexistent session", async () => {
		const result = await simulateUpdateItem(
			data,
			"ghost_session",
			"ghost_item",
			1,
		);

		expect(result).toEqual({ error: "Session or item not found", status: 404 });
	});
});

describe("store endpoint: heartbeat", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("marks station as online", async () => {
		const ctrl = createKioskController(data);
		const station = await ctrl.registerStation({
			name: "Kiosk 12",
			location: "kiosk-g",
		});

		const result = await simulateHeartbeat(data, station.id);

		expect("station" in result).toBe(true);
		if (!("station" in result)) {
			throw new Error("expected 'station' in result");
		}
		expect(result.station.isOnline).toBe(true);
		expect(result.station.lastHeartbeat).toBeDefined();
	});

	it("returns 404 for nonexistent station", async () => {
		const result = await simulateHeartbeat(data, "ghost_station");

		expect(result).toEqual({ error: "Station not found", status: 404 });
	});

	it("updates lastHeartbeat timestamp", async () => {
		const ctrl = createKioskController(data);
		const station = await ctrl.registerStation({
			name: "Kiosk 13",
			location: "kiosk-h",
		});

		const before = new Date();
		const result = await simulateHeartbeat(data, station.id);
		const after = new Date();

		expect("station" in result && result.station.lastHeartbeat).toBeTruthy();
		if (!("station" in result && result.station.lastHeartbeat)) {
			throw new Error(
				"expected 'station' in result && result.station.lastHeartbeat",
			);
		}
		const hb = new Date(result.station.lastHeartbeat);
		expect(hb.getTime()).toBeGreaterThanOrEqual(before.getTime());
		expect(hb.getTime()).toBeLessThanOrEqual(after.getTime() + 100);
	});
});
