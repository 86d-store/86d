import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createKioskController } from "../service-impl";

function defined<T>(val: T | null | undefined, label = "value"): T {
	if (val == null) throw new Error(`Expected ${label} to be defined`);
	return val;
}

const mockEvents = {
	emit: vi.fn(),
};

describe("kiosk service-impl", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createKioskController>;

	beforeEach(() => {
		mockData = createMockDataService();
		vi.clearAllMocks();
		controller = createKioskController(mockData, mockEvents as never);
	});

	// ── Station CRUD ─────────────────────────────────────────────────

	describe("registerStation", () => {
		it("creates a station with defaults", async () => {
			const station = await controller.registerStation({
				name: "Front Counter",
				location: "Lobby",
			});

			expect(station.name).toBe("Front Counter");
			expect(station.location).toBe("Lobby");
			expect(station.isOnline).toBe(false);
			expect(station.isActive).toBe(true);
			expect(station.settings).toEqual({});
			expect(station.id).toBeTruthy();
			expect(station.createdAt).toBeInstanceOf(Date);
		});

		it("stores custom settings", async () => {
			const station = await controller.registerStation({
				name: "Kiosk 1",
				location: "Entrance",
				settings: { theme: "dark", language: "en" },
			});

			expect(station.settings).toEqual({ theme: "dark", language: "en" });
		});

		it("emits kiosk.registered event", async () => {
			const station = await controller.registerStation({
				name: "Kiosk 1",
				location: "Entrance",
			});

			expect(mockEvents.emit).toHaveBeenCalledWith("kiosk.registered", {
				stationId: station.id,
				name: "Kiosk 1",
			});
		});

		it("persists station to data store", async () => {
			await controller.registerStation({
				name: "Kiosk 1",
				location: "Entrance",
			});

			expect(mockData.size("kioskStation")).toBe(1);
		});
	});

	describe("updateStation", () => {
		it("updates station fields", async () => {
			const station = await controller.registerStation({
				name: "Old Name",
				location: "Lobby",
			});

			const updated = await controller.updateStation(station.id, {
				name: "New Name",
				location: "Counter",
			});

			expect(updated?.name).toBe("New Name");
			expect(updated?.location).toBe("Counter");
		});

		it("deactivates a station", async () => {
			const station = await controller.registerStation({
				name: "Kiosk 1",
				location: "Lobby",
			});

			const updated = await controller.updateStation(station.id, {
				isActive: false,
			});
			expect(updated?.isActive).toBe(false);
		});

		it("returns null for nonexistent station", async () => {
			expect(
				await controller.updateStation("nonexistent", { name: "X" }),
			).toBeNull();
		});

		it("preserves unchanged fields", async () => {
			const station = await controller.registerStation({
				name: "Kiosk 1",
				location: "Lobby",
			});

			const updated = await controller.updateStation(station.id, {
				name: "Kiosk 2",
			});
			expect(updated?.location).toBe("Lobby");
		});
	});

	describe("deleteStation", () => {
		it("deletes an existing station", async () => {
			const station = await controller.registerStation({
				name: "Kiosk 1",
				location: "Lobby",
			});

			expect(await controller.deleteStation(station.id)).toBe(true);
			expect(mockData.size("kioskStation")).toBe(0);
		});

		it("returns false for nonexistent station", async () => {
			expect(await controller.deleteStation("nonexistent")).toBe(false);
		});
	});

	describe("listStations", () => {
		it("lists all stations", async () => {
			await controller.registerStation({ name: "A", location: "L1" });
			await controller.registerStation({ name: "B", location: "L2" });

			const stations = await controller.listStations();
			expect(stations).toHaveLength(2);
		});

		it("filters by isActive", async () => {
			const s = await controller.registerStation({
				name: "A",
				location: "L1",
			});
			await controller.registerStation({ name: "B", location: "L2" });
			await controller.updateStation(s.id, { isActive: false });

			const active = await controller.listStations({ isActive: true });
			expect(active).toHaveLength(1);
			expect(active[0].name).toBe("B");
		});
	});

	describe("getStation", () => {
		it("returns null for missing station", async () => {
			expect(await controller.getStation("nonexistent")).toBeNull();
		});

		it("returns stored station", async () => {
			const station = await controller.registerStation({
				name: "Kiosk 1",
				location: "Lobby",
			});

			const fetched = await controller.getStation(station.id);
			expect(fetched?.name).toBe("Kiosk 1");
		});
	});

	// ── Heartbeat ────────────────────────────────────────────────────

	describe("heartbeat", () => {
		it("sets station online and records heartbeat time", async () => {
			const station = await controller.registerStation({
				name: "Kiosk 1",
				location: "Lobby",
			});
			expect(station.isOnline).toBe(false);

			const updated = await controller.heartbeat(station.id);
			expect(updated?.isOnline).toBe(true);
			expect(updated?.lastHeartbeat).toBeInstanceOf(Date);
		});

		it("returns null for nonexistent station", async () => {
			expect(await controller.heartbeat("nonexistent")).toBeNull();
		});

		it("emits kiosk.heartbeat event", async () => {
			const station = await controller.registerStation({
				name: "Kiosk 1",
				location: "Lobby",
			});
			vi.clearAllMocks();

			await controller.heartbeat(station.id);

			expect(mockEvents.emit).toHaveBeenCalledWith("kiosk.heartbeat", {
				stationId: station.id,
			});
		});
	});

	// ── Session lifecycle ────────────────────────────────────────────

	describe("startSession", () => {
		it("creates a new session for an active station", async () => {
			const station = await controller.registerStation({
				name: "Kiosk 1",
				location: "Lobby",
			});

			const session = await controller.startSession(station.id);

			expect(session?.status).toBe("active");
			expect(session?.stationId).toBe(station.id);
			expect(session?.items).toEqual([]);
			expect(session?.subtotal).toBe(0);
			expect(session?.tax).toBe(0);
			expect(session?.tip).toBe(0);
			expect(session?.total).toBe(0);
			expect(session?.paymentStatus).toBe("pending");
		});

		it("links session to station", async () => {
			const station = await controller.registerStation({
				name: "Kiosk 1",
				location: "Lobby",
			});

			const session = await controller.startSession(station.id);
			const updatedStation = await controller.getStation(station.id);

			expect(updatedStation?.currentSessionId).toBe(session?.id);
		});

		it("returns null for nonexistent station", async () => {
			expect(await controller.startSession("nonexistent")).toBeNull();
		});

		it("returns null for inactive station", async () => {
			const station = await controller.registerStation({
				name: "Kiosk 1",
				location: "Lobby",
			});
			await controller.updateStation(station.id, { isActive: false });

			expect(await controller.startSession(station.id)).toBeNull();
		});

		it("emits kiosk.session.started event", async () => {
			const station = await controller.registerStation({
				name: "Kiosk 1",
				location: "Lobby",
			});
			vi.clearAllMocks();

			const session = await controller.startSession(station.id);

			expect(mockEvents.emit).toHaveBeenCalledWith("kiosk.session.started", {
				sessionId: session?.id,
				stationId: station.id,
			});
		});
	});

	// ── Item operations ──────────────────────────────────────────────

	describe("addItem", () => {
		it("adds an item and recalculates totals", async () => {
			const station = await controller.registerStation({
				name: "K1",
				location: "L1",
			});
			const session = await controller.startSession(station.id);

			const updated = await controller.addItem(defined(session).id, {
				name: "Burger",
				price: 10,
				quantity: 2,
			});

			expect(updated?.items).toHaveLength(1);
			expect(updated?.subtotal).toBe(20);
			expect(updated?.tax).toBe(1.6); // 20 * 0.08
			expect(updated?.total).toBe(21.6); // 20 + 1.60
		});

		it("assigns unique ID to each item", async () => {
			const station = await controller.registerStation({
				name: "K1",
				location: "L1",
			});
			const session = await controller.startSession(station.id);

			await controller.addItem(defined(session).id, {
				name: "Burger",
				price: 10,
				quantity: 1,
			});
			const updated = await controller.addItem(defined(session).id, {
				name: "Fries",
				price: 5,
				quantity: 1,
			});

			expect(updated?.items).toHaveLength(2);
			expect(updated?.items[0].id).not.toBe(updated?.items[1].id);
		});

		it("returns null for nonexistent session", async () => {
			expect(
				await controller.addItem("nonexistent", {
					name: "X",
					price: 1,
					quantity: 1,
				}),
			).toBeNull();
		});

		it("returns null for non-active session", async () => {
			const station = await controller.registerStation({
				name: "K1",
				location: "L1",
			});
			const session = await controller.startSession(station.id);
			await controller.completeSession(defined(session).id, "cash");

			expect(
				await controller.addItem(defined(session).id, {
					name: "X",
					price: 1,
					quantity: 1,
				}),
			).toBeNull();
		});

		it("handles precise tax calculation", async () => {
			const station = await controller.registerStation({
				name: "K1",
				location: "L1",
			});
			const session = await controller.startSession(station.id);

			// $9.99 * 0.08 = 0.7992, should round to 0.80
			const updated = await controller.addItem(defined(session).id, {
				name: "Item",
				price: 9.99,
				quantity: 1,
			});

			expect(updated?.tax).toBe(0.8);
			expect(updated?.total).toBe(10.79);
		});
	});

	describe("removeItem", () => {
		it("removes an item and recalculates totals", async () => {
			const station = await controller.registerStation({
				name: "K1",
				location: "L1",
			});
			const session = await controller.startSession(station.id);

			const withItem = await controller.addItem(defined(session).id, {
				name: "Burger",
				price: 10,
				quantity: 1,
			});
			const itemId = defined(withItem).items[0].id;

			const updated = await controller.removeItem(defined(session).id, itemId);
			expect(updated?.items).toHaveLength(0);
			expect(updated?.subtotal).toBe(0);
			expect(updated?.total).toBe(0);
		});

		it("returns null if item not found", async () => {
			const station = await controller.registerStation({
				name: "K1",
				location: "L1",
			});
			const session = await controller.startSession(station.id);

			expect(
				await controller.removeItem(defined(session).id, "nonexistent-item"),
			).toBeNull();
		});

		it("returns null for nonexistent session", async () => {
			expect(await controller.removeItem("nonexistent", "item-id")).toBeNull();
		});
	});

	describe("updateItemQuantity", () => {
		it("updates quantity and recalculates", async () => {
			const station = await controller.registerStation({
				name: "K1",
				location: "L1",
			});
			const session = await controller.startSession(station.id);

			const withItem = await controller.addItem(defined(session).id, {
				name: "Burger",
				price: 10,
				quantity: 1,
			});
			const itemId = defined(withItem).items[0].id;

			const updated = await controller.updateItemQuantity(
				defined(session).id,
				itemId,
				3,
			);
			expect(updated?.items[0].quantity).toBe(3);
			expect(updated?.subtotal).toBe(30);
		});

		it("removes item when quantity is 0", async () => {
			const station = await controller.registerStation({
				name: "K1",
				location: "L1",
			});
			const session = await controller.startSession(station.id);

			const withItem = await controller.addItem(defined(session).id, {
				name: "Burger",
				price: 10,
				quantity: 1,
			});
			const itemId = defined(withItem).items[0].id;

			const updated = await controller.updateItemQuantity(
				defined(session).id,
				itemId,
				0,
			);
			expect(updated?.items).toHaveLength(0);
		});

		it("removes item when quantity is negative", async () => {
			const station = await controller.registerStation({
				name: "K1",
				location: "L1",
			});
			const session = await controller.startSession(station.id);

			const withItem = await controller.addItem(defined(session).id, {
				name: "Burger",
				price: 10,
				quantity: 1,
			});
			const itemId = defined(withItem).items[0].id;

			const updated = await controller.updateItemQuantity(
				defined(session).id,
				itemId,
				-1,
			);
			expect(updated?.items).toHaveLength(0);
		});

		it("returns null for nonexistent item", async () => {
			const station = await controller.registerStation({
				name: "K1",
				location: "L1",
			});
			const session = await controller.startSession(station.id);

			expect(
				await controller.updateItemQuantity(defined(session).id, "nope", 5),
			).toBeNull();
		});
	});

	// ── Complete / abandon ───────────────────────────────────────────

	describe("completeSession", () => {
		it("completes a session with payment", async () => {
			const station = await controller.registerStation({
				name: "K1",
				location: "L1",
			});
			const session = await controller.startSession(station.id);
			await controller.addItem(defined(session).id, {
				name: "Burger",
				price: 10,
				quantity: 1,
			});

			const completed = await controller.completeSession(
				defined(session).id,
				"card",
			);

			expect(completed?.status).toBe("completed");
			expect(completed?.paymentMethod).toBe("card");
			expect(completed?.paymentStatus).toBe("paid");
			expect(completed?.completedAt).toBeInstanceOf(Date);
		});

		it("clears station currentSessionId", async () => {
			const station = await controller.registerStation({
				name: "K1",
				location: "L1",
			});
			const session = await controller.startSession(station.id);
			await controller.completeSession(defined(session).id, "cash");

			const updatedStation = await controller.getStation(station.id);
			expect(updatedStation?.currentSessionId).toBeUndefined();
		});

		it("returns null for nonexistent session", async () => {
			expect(
				await controller.completeSession("nonexistent", "card"),
			).toBeNull();
		});

		it("returns null for non-active session", async () => {
			const station = await controller.registerStation({
				name: "K1",
				location: "L1",
			});
			const session = await controller.startSession(station.id);
			await controller.completeSession(defined(session).id, "cash");

			expect(
				await controller.completeSession(defined(session).id, "card"),
			).toBeNull();
		});

		it("emits kiosk.order.paid and kiosk.session.ended events", async () => {
			const station = await controller.registerStation({
				name: "K1",
				location: "L1",
			});
			const session = await controller.startSession(station.id);
			vi.clearAllMocks();

			await controller.completeSession(defined(session).id, "card");

			expect(mockEvents.emit).toHaveBeenCalledWith("kiosk.order.paid", {
				sessionId: defined(session).id,
				stationId: station.id,
				total: 0,
				paymentMethod: "card",
			});
			expect(mockEvents.emit).toHaveBeenCalledWith("kiosk.session.ended", {
				sessionId: defined(session).id,
				stationId: station.id,
				status: "completed",
			});
		});
	});

	describe("abandonSession", () => {
		it("marks session as abandoned", async () => {
			const station = await controller.registerStation({
				name: "K1",
				location: "L1",
			});
			const session = await controller.startSession(station.id);

			const abandoned = await controller.abandonSession(defined(session).id);
			expect(abandoned?.status).toBe("abandoned");
			expect(abandoned?.completedAt).toBeInstanceOf(Date);
		});

		it("clears station currentSessionId", async () => {
			const station = await controller.registerStation({
				name: "K1",
				location: "L1",
			});
			const session = await controller.startSession(station.id);
			await controller.abandonSession(defined(session).id);

			const updatedStation = await controller.getStation(station.id);
			expect(updatedStation?.currentSessionId).toBeUndefined();
		});

		it("returns null for non-active session", async () => {
			const station = await controller.registerStation({
				name: "K1",
				location: "L1",
			});
			const session = await controller.startSession(station.id);
			await controller.abandonSession(defined(session).id);

			expect(await controller.abandonSession(defined(session).id)).toBeNull();
		});

		it("emits kiosk.session.ended with abandoned status", async () => {
			const station = await controller.registerStation({
				name: "K1",
				location: "L1",
			});
			const session = await controller.startSession(station.id);
			vi.clearAllMocks();

			await controller.abandonSession(defined(session).id);

			expect(mockEvents.emit).toHaveBeenCalledWith("kiosk.session.ended", {
				sessionId: defined(session).id,
				stationId: station.id,
				status: "abandoned",
			});
		});
	});

	// ── Stats ────────────────────────────────────────────────────────

	describe("getStationStats", () => {
		it("returns zeroed stats for new station", async () => {
			const station = await controller.registerStation({
				name: "K1",
				location: "L1",
			});

			const stats = await controller.getStationStats(station.id);
			expect(stats.totalSessions).toBe(0);
			expect(stats.completedSessions).toBe(0);
			expect(stats.abandonedSessions).toBe(0);
			expect(stats.totalRevenue).toBe(0);
		});

		it("counts completed and abandoned sessions", async () => {
			const station = await controller.registerStation({
				name: "K1",
				location: "L1",
			});

			const s1 = await controller.startSession(station.id);
			await controller.addItem(defined(s1).id, {
				name: "Burger",
				price: 10,
				quantity: 1,
			});
			await controller.completeSession(defined(s1).id, "card");

			const s2 = await controller.startSession(station.id);
			await controller.abandonSession(defined(s2).id);

			const stats = await controller.getStationStats(station.id);
			expect(stats.totalSessions).toBe(2);
			expect(stats.completedSessions).toBe(1);
			expect(stats.abandonedSessions).toBe(1);
		});

		it("sums revenue from completed sessions", async () => {
			const station = await controller.registerStation({
				name: "K1",
				location: "L1",
			});

			const s1 = await controller.startSession(station.id);
			await controller.addItem(defined(s1).id, {
				name: "Burger",
				price: 10,
				quantity: 1,
			});
			await controller.completeSession(defined(s1).id, "card");

			const stats = await controller.getStationStats(station.id);
			expect(stats.totalRevenue).toBe(10.8); // 10 + 0.80 tax
		});
	});

	describe("getOverallStats", () => {
		it("returns zeroed stats when empty", async () => {
			const stats = await controller.getOverallStats();
			expect(stats.totalStations).toBe(0);
			expect(stats.onlineStations).toBe(0);
			expect(stats.totalSessions).toBe(0);
		});

		it("counts stations and online status", async () => {
			const s1 = await controller.registerStation({
				name: "K1",
				location: "L1",
			});
			await controller.registerStation({ name: "K2", location: "L2" });
			await controller.heartbeat(s1.id);

			const stats = await controller.getOverallStats();
			expect(stats.totalStations).toBe(2);
			expect(stats.onlineStations).toBe(1);
		});

		it("aggregates sessions across all stations", async () => {
			const s1 = await controller.registerStation({
				name: "K1",
				location: "L1",
			});
			const s2 = await controller.registerStation({
				name: "K2",
				location: "L2",
			});

			const sess1 = await controller.startSession(s1.id);
			await controller.addItem(defined(sess1).id, {
				name: "Burger",
				price: 10,
				quantity: 1,
			});
			await controller.completeSession(defined(sess1).id, "card");

			const sess2 = await controller.startSession(s2.id);
			await controller.abandonSession(defined(sess2).id);

			const stats = await controller.getOverallStats();
			expect(stats.totalSessions).toBe(2);
			expect(stats.completedSessions).toBe(1);
			expect(stats.abandonedSessions).toBe(1);
			expect(stats.totalRevenue).toBe(10.8);
		});
	});
});
