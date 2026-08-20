import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createKioskController } from "../service-impl";

describe("kiosk controller", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createKioskController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createKioskController(mockData);
	});

	// ── Station CRUD ─────────────────────────────────────────────────

	describe("registerStation", () => {
		it("registers a station with default settings", async () => {
			const station = await controller.registerStation({ name: "Kiosk 1" });
			expect(station.id).toBeDefined();
			expect(station.name).toBe("Kiosk 1");
			expect(station.isOnline).toBe(false);
			expect(station.isActive).toBe(true);
			expect(station.settings).toEqual({});
		});

		it("registers a station with location and settings", async () => {
			const station = await controller.registerStation({
				name: "Kiosk 2",
				location: "Lobby",
				settings: { theme: "dark" },
			});
			expect(station.location).toBe("Lobby");
			expect(station.settings).toEqual({ theme: "dark" });
		});
	});

	describe("updateStation", () => {
		it("updates station name", async () => {
			const station = await controller.registerStation({ name: "Old" });
			const updated = await controller.updateStation(station.id, {
				name: "New",
			});
			expect(updated?.name).toBe("New");
		});

		it("deactivates a station", async () => {
			const station = await controller.registerStation({ name: "Active" });
			const updated = await controller.updateStation(station.id, {
				isActive: false,
			});
			expect(updated?.isActive).toBe(false);
		});

		it("returns null for non-existent station", async () => {
			const result = await controller.updateStation("non-existent", {
				name: "Nope",
			});
			expect(result).toBeNull();
		});

		it("preserves unmodified fields", async () => {
			const station = await controller.registerStation({
				name: "Keep",
				location: "Front",
			});
			const updated = await controller.updateStation(station.id, {
				name: "Changed",
			});
			expect(updated?.location).toBe("Front");
		});
	});

	describe("deleteStation", () => {
		it("deletes an existing station", async () => {
			const station = await controller.registerStation({ name: "Delete" });
			expect(await controller.deleteStation(station.id)).toBe(true);
		});

		it("returns false for non-existent station", async () => {
			expect(await controller.deleteStation("non-existent")).toBe(false);
		});

		it("double delete returns false", async () => {
			const station = await controller.registerStation({ name: "Once" });
			await controller.deleteStation(station.id);
			expect(await controller.deleteStation(station.id)).toBe(false);
		});
	});

	describe("listStations", () => {
		it("lists all stations", async () => {
			await controller.registerStation({ name: "S1" });
			await controller.registerStation({ name: "S2" });
			const all = await controller.listStations();
			expect(all).toHaveLength(2);
		});

		it("filters by active status", async () => {
			const s1 = await controller.registerStation({ name: "S1" });
			await controller.registerStation({ name: "S2" });
			await controller.updateStation(s1.id, { isActive: false });
			const active = await controller.listStations({ isActive: true });
			expect(active).toHaveLength(1);
		});
	});

	describe("getStation", () => {
		it("retrieves an existing station", async () => {
			const station = await controller.registerStation({ name: "Get" });
			const found = await controller.getStation(station.id);
			expect(found?.name).toBe("Get");
		});

		it("returns null for non-existent station", async () => {
			expect(await controller.getStation("non-existent")).toBeNull();
		});
	});

	// ── Heartbeat ────────────────────────────────────────────────────

	describe("heartbeat", () => {
		it("sets station to online", async () => {
			const station = await controller.registerStation({ name: "HB" });
			expect(station.isOnline).toBe(false);

			const updated = await controller.heartbeat(station.id);
			expect(updated?.isOnline).toBe(true);
			expect(updated?.lastHeartbeat).toBeInstanceOf(Date);
		});

		it("returns null for non-existent station", async () => {
			expect(await controller.heartbeat("non-existent")).toBeNull();
		});
	});

	// ── Session lifecycle ────────────────────────────────────────────

	describe("startSession", () => {
		it("starts a session for an active station", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = await controller.startSession(station.id);
			expect(session).not.toBeNull();
			expect(session?.stationId).toBe(station.id);
			expect(session?.status).toBe("active");
			expect(session?.items).toEqual([]);
			expect(session?.total).toBe(0);
		});

		it("returns null for non-existent station", async () => {
			expect(await controller.startSession("non-existent")).toBeNull();
		});

		it("returns null for inactive station", async () => {
			const station = await controller.registerStation({ name: "Inactive" });
			await controller.updateStation(station.id, { isActive: false });
			expect(await controller.startSession(station.id)).toBeNull();
		});

		it("links session to station", async () => {
			const station = await controller.registerStation({ name: "Link" });
			const session = await controller.startSession(station.id);
			const updatedStation = await controller.getStation(station.id);
			expect(updatedStation?.currentSessionId).toBe(
				session?.id as string as string,
			);
		});
	});

	describe("addItem", () => {
		it("adds an item to the session", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = await controller.startSession(station.id);

			const updated = await controller.addItem(
				session?.id as string as string,
				{
					name: "Burger",
					price: 10.0,
					quantity: 2,
				},
			);
			expect(updated?.items).toHaveLength(1);
			expect(updated?.items[0].name).toBe("Burger");
			expect(updated?.subtotal).toBe(20.0);
		});

		it("adds multiple items", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = await controller.startSession(station.id);

			await controller.addItem(session?.id as string as string, {
				name: "Burger",
				price: 10.0,
				quantity: 1,
			});
			const updated = await controller.addItem(
				session?.id as string as string,
				{
					name: "Fries",
					price: 5.0,
					quantity: 1,
				},
			);
			expect(updated?.items).toHaveLength(2);
			expect(updated?.subtotal).toBe(15.0);
		});

		it("returns null for non-existent session", async () => {
			expect(
				await controller.addItem("non-existent", {
					name: "X",
					price: 1,
					quantity: 1,
				}),
			).toBeNull();
		});

		it("returns null for completed session", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = await controller.startSession(station.id);
			await controller.completeSession(session?.id as string as string, "card");

			expect(
				await controller.addItem(session?.id as string as string, {
					name: "X",
					price: 1,
					quantity: 1,
				}),
			).toBeNull();
		});
	});

	describe("removeItem", () => {
		it("removes an item from the session", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = await controller.startSession(station.id);
			const withItem = await controller.addItem(
				session?.id as string as string,
				{
					name: "Burger",
					price: 10.0,
					quantity: 1,
				},
			);
			const itemId = withItem?.items[0].id as string;

			const updated = await controller.removeItem(
				session?.id as string as string,
				itemId,
			);
			expect(updated?.items).toHaveLength(0);
			expect(updated?.subtotal).toBe(0);
		});

		it("returns null for non-existent item", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = await controller.startSession(station.id);
			expect(
				await controller.removeItem(
					session?.id as string as string,
					"non-existent",
				),
			).toBeNull();
		});
	});

	describe("updateItemQuantity", () => {
		it("updates item quantity", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = await controller.startSession(station.id);
			const withItem = await controller.addItem(
				session?.id as string as string,
				{
					name: "Burger",
					price: 10.0,
					quantity: 1,
				},
			);
			const itemId = withItem?.items[0].id as string;

			const updated = await controller.updateItemQuantity(
				session?.id as string as string,
				itemId,
				3,
			);
			expect(updated?.items[0].quantity).toBe(3);
			expect(updated?.subtotal).toBe(30.0);
		});

		it("removes item when quantity is 0", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = await controller.startSession(station.id);
			const withItem = await controller.addItem(
				session?.id as string as string,
				{
					name: "Burger",
					price: 10.0,
					quantity: 1,
				},
			);
			const itemId = withItem?.items[0].id as string;

			const updated = await controller.updateItemQuantity(
				session?.id as string as string,
				itemId,
				0,
			);
			expect(updated?.items).toHaveLength(0);
		});

		it("returns null for non-existent item", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = await controller.startSession(station.id);
			expect(
				await controller.updateItemQuantity(
					session?.id as string as string,
					"non-existent",
					5,
				),
			).toBeNull();
		});
	});

	// ── Complete and abandon sessions ────────────────────────────────

	describe("completeSession", () => {
		it("completes a session with payment", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = await controller.startSession(station.id);
			await controller.addItem(session?.id as string as string, {
				name: "Burger",
				price: 10.0,
				quantity: 1,
			});

			const completed = await controller.completeSession(
				session?.id as string as string,
				"credit-card",
			);
			expect(completed?.status).toBe("completed");
			expect(completed?.paymentMethod).toBe("credit-card");
			expect(completed?.paymentStatus).toBe("paid");
			expect(completed?.completedAt).toBeInstanceOf(Date);
		});

		it("clears station current session", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = await controller.startSession(station.id);
			await controller.completeSession(session?.id as string as string, "cash");

			const updatedStation = await controller.getStation(station.id);
			expect(updatedStation?.currentSessionId).toBeUndefined();
		});

		it("cannot complete an already completed session", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = await controller.startSession(station.id);
			await controller.completeSession(session?.id as string as string, "card");

			expect(
				await controller.completeSession(
					session?.id as string as string,
					"card",
				),
			).toBeNull();
		});

		it("returns null for non-existent session", async () => {
			expect(
				await controller.completeSession("non-existent", "card"),
			).toBeNull();
		});
	});

	describe("abandonSession", () => {
		it("abandons an active session", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = await controller.startSession(station.id);

			const abandoned = await controller.abandonSession(
				session?.id as string as string,
			);
			expect(abandoned?.status).toBe("abandoned");
			expect(abandoned?.completedAt).toBeInstanceOf(Date);
		});

		it("clears station current session", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = await controller.startSession(station.id);
			await controller.abandonSession(session?.id as string as string);

			const updatedStation = await controller.getStation(station.id);
			expect(updatedStation?.currentSessionId).toBeUndefined();
		});

		it("cannot abandon an already abandoned session", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = await controller.startSession(station.id);
			await controller.abandonSession(session?.id as string as string);

			expect(
				await controller.abandonSession(session?.id as string as string),
			).toBeNull();
		});

		it("returns null for non-existent session", async () => {
			expect(await controller.abandonSession("non-existent")).toBeNull();
		});
	});

	// ── List sessions ────────────────────────────────────────────────

	describe("listSessions", () => {
		it("lists all sessions", async () => {
			const s1 = await controller.registerStation({ name: "S1" });
			const s2 = await controller.registerStation({ name: "S2" });
			await controller.startSession(s1.id);
			await controller.startSession(s2.id);

			const all = await controller.listSessions();
			expect(all).toHaveLength(2);
		});

		it("filters by station", async () => {
			const s1 = await controller.registerStation({ name: "S1" });
			const s2 = await controller.registerStation({ name: "S2" });
			await controller.startSession(s1.id);
			await controller.startSession(s2.id);

			const filtered = await controller.listSessions({
				stationId: s1.id,
			});
			expect(filtered).toHaveLength(1);
		});

		it("filters by status", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const sess1 = await controller.startSession(station.id);
			await controller.completeSession(sess1?.id as string, "card");
			await controller.startSession(station.id);

			const completed = await controller.listSessions({
				status: "completed",
			});
			expect(completed).toHaveLength(1);
		});
	});

	// ── Stats ────────────────────────────────────────────────────────

	describe("getStationStats", () => {
		it("returns stats for a station", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const sess1 = await controller.startSession(station.id);
			await controller.addItem(sess1?.id as string, {
				name: "Burger",
				price: 10,
				quantity: 1,
			});
			await controller.completeSession(sess1?.id as string, "card");

			const sess2 = await controller.startSession(station.id);
			await controller.abandonSession(sess2?.id as string);

			const stats = await controller.getStationStats(station.id);
			expect(stats.totalSessions).toBe(2);
			expect(stats.completedSessions).toBe(1);
			expect(stats.abandonedSessions).toBe(1);
			expect(stats.totalRevenue).toBeGreaterThan(0);
		});
	});

	describe("getOverallStats", () => {
		it("returns all zeroes when no data", async () => {
			const stats = await controller.getOverallStats();
			expect(stats.totalStations).toBe(0);
			expect(stats.totalSessions).toBe(0);
			expect(stats.totalRevenue).toBe(0);
		});

		it("aggregates across stations", async () => {
			const s1 = await controller.registerStation({ name: "S1" });
			const s2 = await controller.registerStation({ name: "S2" });
			await controller.heartbeat(s1.id);

			const sess1 = await controller.startSession(s1.id);
			await controller.addItem(sess1?.id as string, {
				name: "Item",
				price: 5,
				quantity: 2,
			});
			await controller.completeSession(sess1?.id as string, "card");

			const sess2 = await controller.startSession(s2.id);
			await controller.abandonSession(sess2?.id as string);

			const stats = await controller.getOverallStats();
			expect(stats.totalStations).toBe(2);
			expect(stats.onlineStations).toBe(1);
			expect(stats.totalSessions).toBe(2);
			expect(stats.completedSessions).toBe(1);
			expect(stats.abandonedSessions).toBe(1);
			expect(stats.totalRevenue).toBeGreaterThan(0);
		});
	});
});
