import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createKioskController } from "../service-impl";

function unwrap<T>(value: T | null | undefined): T {
	expect(value).toBeDefined();
	if (value == null) {
		throw new Error("expected value");
	}
	return value;
}

describe("kiosk controller — cross-method interactions & edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createKioskController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createKioskController(mockData);
	});

	// ── Tax & total calculation precision ────────────────────────────

	describe("tax and total calculation", () => {
		it("computes 8% tax with proper rounding", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = unwrap(await controller.startSession(station.id));

			const updated = await controller.addItem(session.id, {
				name: "Item",
				price: 10.0,
				quantity: 1,
			});

			expect(updated?.subtotal).toBe(10.0);
			expect(updated?.tax).toBe(0.8);
			expect(updated?.total).toBe(10.8);
		});

		it("rounds fractional tax correctly", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = unwrap(await controller.startSession(station.id));

			// 7.99 * 0.08 = 0.6392 → rounds to 0.64
			const updated = await controller.addItem(session.id, {
				name: "Odd Price",
				price: 7.99,
				quantity: 1,
			});

			expect(updated?.subtotal).toBe(7.99);
			expect(updated?.tax).toBe(0.64);
			expect(updated?.total).toBe(8.63);
		});

		it("accumulates totals across multiple items", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = unwrap(await controller.startSession(station.id));

			await controller.addItem(session.id, {
				name: "Burger",
				price: 12.5,
				quantity: 2,
			});
			const updated = await controller.addItem(session.id, {
				name: "Drink",
				price: 3.0,
				quantity: 1,
			});

			// subtotal = 12.5*2 + 3.0*1 = 28.0
			// tax = round(28.0 * 0.08 * 100) / 100 = 2.24
			// total = round((28.0 + 2.24) * 100) / 100 = 30.24
			expect(updated?.subtotal).toBe(28.0);
			expect(updated?.tax).toBe(2.24);
			expect(updated?.total).toBe(30.24);
		});

		it("recalculates totals after removing one of multiple items", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = unwrap(await controller.startSession(station.id));

			const withBurger = await controller.addItem(session.id, {
				name: "Burger",
				price: 10.0,
				quantity: 1,
			});
			await controller.addItem(session.id, {
				name: "Fries",
				price: 5.0,
				quantity: 2,
			});

			const afterRemove = await controller.removeItem(
				session.id,
				unwrap(unwrap(withBurger).items[0]).id,
			);

			// Only fries remain: 5.0*2 = 10.0
			expect(afterRemove?.items).toHaveLength(1);
			expect(afterRemove?.subtotal).toBe(10.0);
			expect(afterRemove?.tax).toBe(0.8);
			expect(afterRemove?.total).toBe(10.8);
		});

		it("recalculates totals after quantity update", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = unwrap(await controller.startSession(station.id));

			const withItem = await controller.addItem(session.id, {
				name: "Burger",
				price: 10.0,
				quantity: 1,
			});

			const updated = await controller.updateItemQuantity(
				session.id,
				unwrap(unwrap(withItem).items[0]).id,
				5,
			);

			// 10.0 * 5 = 50.0, tax = 4.0, total = 54.0
			expect(updated?.subtotal).toBe(50.0);
			expect(updated?.tax).toBe(4.0);
			expect(updated?.total).toBe(54.0);
		});

		it("zeroes totals when all items are removed", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = unwrap(await controller.startSession(station.id));

			const withItem = await controller.addItem(session.id, {
				name: "Burger",
				price: 10.0,
				quantity: 1,
			});

			const updated = await controller.removeItem(
				session.id,
				unwrap(unwrap(withItem).items[0]).id,
			);

			expect(updated?.subtotal).toBe(0);
			expect(updated?.tax).toBe(0);
			expect(updated?.total).toBe(0);
		});
	});

	// ── Abandoned session guards ─────────────────────────────────────

	describe("abandoned session guards", () => {
		it("cannot add item to abandoned session", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = unwrap(await controller.startSession(station.id));
			await controller.abandonSession(session.id);

			const result = await controller.addItem(session.id, {
				name: "X",
				price: 1,
				quantity: 1,
			});
			expect(result).toBeNull();
		});

		it("cannot remove item from abandoned session", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = unwrap(await controller.startSession(station.id));
			const withItem = await controller.addItem(session.id, {
				name: "Burger",
				price: 10,
				quantity: 1,
			});
			const itemId = unwrap(unwrap(withItem).items[0]).id;

			await controller.abandonSession(session.id);

			const result = await controller.removeItem(session.id, itemId);
			expect(result).toBeNull();
		});

		it("cannot update item quantity in abandoned session", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = unwrap(await controller.startSession(station.id));
			const withItem = await controller.addItem(session.id, {
				name: "Burger",
				price: 10,
				quantity: 1,
			});
			const itemId = unwrap(unwrap(withItem).items[0]).id;

			await controller.abandonSession(session.id);

			const result = await controller.updateItemQuantity(session.id, itemId, 5);
			expect(result).toBeNull();
		});

		it("cannot complete an abandoned session", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = unwrap(await controller.startSession(station.id));
			await controller.abandonSession(session.id);

			const result = await controller.completeSession(session.id, "card");
			expect(result).toBeNull();
		});
	});

	// ── Session lifecycle interactions ────────────────────────────────

	describe("session lifecycle interactions", () => {
		it("can start new session after completing previous", async () => {
			const station = await controller.registerStation({ name: "S1" });

			const first = unwrap(await controller.startSession(station.id));
			await controller.addItem(first.id, {
				name: "Burger",
				price: 10,
				quantity: 1,
			});
			await controller.completeSession(first.id, "card");

			const second = unwrap(await controller.startSession(station.id));
			expect(second.id).not.toBe(first.id);
			expect(second.items).toHaveLength(0);
			expect(second.total).toBe(0);

			const updatedStation = await controller.getStation(station.id);
			expect(updatedStation?.currentSessionId).toBe(second.id);
		});

		it("can start new session after abandoning previous", async () => {
			const station = await controller.registerStation({ name: "S1" });

			const first = unwrap(await controller.startSession(station.id));
			await controller.abandonSession(first.id);

			const second = unwrap(await controller.startSession(station.id));
			expect(second.status).toBe("active");
		});

		it("completing empty session works correctly", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = unwrap(await controller.startSession(station.id));

			const completed = await controller.completeSession(session.id, "cash");
			expect(completed?.status).toBe("completed");
			expect(completed?.total).toBe(0);
			expect(completed?.items).toHaveLength(0);
			expect(completed?.paymentStatus).toBe("paid");
		});

		it("completed session data is still retrievable", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = unwrap(await controller.startSession(station.id));
			await controller.addItem(session.id, {
				name: "Burger",
				price: 10,
				quantity: 2,
			});
			await controller.completeSession(session.id, "card");

			const retrieved = await controller.getSession(session.id);
			expect(retrieved?.status).toBe("completed");
			expect(retrieved?.items).toHaveLength(1);
			expect(retrieved?.subtotal).toBe(20);
		});

		it("abandoned session data is still retrievable", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = unwrap(await controller.startSession(station.id));
			await controller.addItem(session.id, {
				name: "Burger",
				price: 10,
				quantity: 1,
			});
			await controller.abandonSession(session.id);

			const retrieved = await controller.getSession(session.id);
			expect(retrieved?.status).toBe("abandoned");
			expect(retrieved?.items).toHaveLength(1);
		});
	});

	// ── updateItemQuantity edge cases ────────────────────────────────

	describe("updateItemQuantity edge cases", () => {
		it("negative quantity removes the item", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = unwrap(await controller.startSession(station.id));
			const withItem = await controller.addItem(session.id, {
				name: "Burger",
				price: 10,
				quantity: 1,
			});

			const updated = await controller.updateItemQuantity(
				session.id,
				unwrap(unwrap(withItem).items[0]).id,
				-1,
			);
			expect(updated?.items).toHaveLength(0);
			expect(updated?.subtotal).toBe(0);
		});

		it("updating quantity preserves other items", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = unwrap(await controller.startSession(station.id));

			await controller.addItem(session.id, {
				name: "Burger",
				price: 10,
				quantity: 1,
			});
			const withDrink = await controller.addItem(session.id, {
				name: "Drink",
				price: 3,
				quantity: 1,
			});

			const updated = await controller.updateItemQuantity(
				session.id,
				unwrap(unwrap(withDrink).items[1]).id,
				4,
			);

			expect(updated?.items).toHaveLength(2);
			expect(updated?.items[0].name).toBe("Burger");
			expect(updated?.items[0].quantity).toBe(1);
			expect(updated?.items[1].quantity).toBe(4);
			// subtotal = 10*1 + 3*4 = 22
			expect(updated?.subtotal).toBe(22);
		});
	});

	// ── Deleted station behavior ─────────────────────────────────────

	describe("deleted station behavior", () => {
		it("cannot start session on deleted station", async () => {
			const station = await controller.registerStation({ name: "S1" });
			await controller.deleteStation(station.id);

			const session = await controller.startSession(station.id);
			expect(session).toBeNull();
		});

		it("cannot heartbeat a deleted station", async () => {
			const station = await controller.registerStation({ name: "S1" });
			await controller.deleteStation(station.id);

			const result = await controller.heartbeat(station.id);
			expect(result).toBeNull();
		});

		it("cannot update a deleted station", async () => {
			const station = await controller.registerStation({ name: "S1" });
			await controller.deleteStation(station.id);

			const result = await controller.updateStation(station.id, {
				name: "New",
			});
			expect(result).toBeNull();
		});
	});

	// ── Pagination ───────────────────────────────────────────────────

	describe("pagination", () => {
		it("listStations respects take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.registerStation({ name: `S${i}` });
			}

			const page1 = await controller.listStations({ take: 2, skip: 0 });
			expect(page1).toHaveLength(2);

			const page2 = await controller.listStations({ take: 2, skip: 2 });
			expect(page2).toHaveLength(2);

			const page3 = await controller.listStations({ take: 2, skip: 4 });
			expect(page3).toHaveLength(1);
		});

		it("listStations skip beyond total returns empty", async () => {
			await controller.registerStation({ name: "S1" });

			const result = await controller.listStations({ skip: 100 });
			expect(result).toHaveLength(0);
		});

		it("listSessions respects take and skip", async () => {
			const station = await controller.registerStation({ name: "S1" });

			for (let i = 0; i < 4; i++) {
				const session = unwrap(await controller.startSession(station.id));
				await controller.completeSession(session.id, "card");
			}

			const page = await controller.listSessions({ take: 2 });
			expect(page).toHaveLength(2);

			const all = await controller.listSessions();
			expect(all).toHaveLength(4);
		});

		it("listSessions can filter by stationId and status together", async () => {
			const s1 = await controller.registerStation({ name: "S1" });
			const s2 = await controller.registerStation({ name: "S2" });

			const sess1 = unwrap(await controller.startSession(s1.id));
			await controller.completeSession(sess1.id, "card");

			const sess2 = unwrap(await controller.startSession(s1.id));
			await controller.abandonSession(sess2.id);

			const sess3 = unwrap(await controller.startSession(s2.id));
			await controller.completeSession(sess3.id, "cash");

			const s1Completed = await controller.listSessions({
				stationId: s1.id,
				status: "completed",
			});
			expect(s1Completed).toHaveLength(1);
			expect(s1Completed[0].stationId).toBe(s1.id);
			expect(s1Completed[0].status).toBe("completed");
		});
	});

	// ── Stats accuracy ───────────────────────────────────────────────

	describe("stats accuracy", () => {
		it("getStationStats returns zeroes for station with no sessions", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const stats = await controller.getStationStats(station.id);

			expect(stats.totalSessions).toBe(0);
			expect(stats.completedSessions).toBe(0);
			expect(stats.abandonedSessions).toBe(0);
			expect(stats.totalRevenue).toBe(0);
		});

		it("getStationStats accumulates revenue from multiple completed sessions", async () => {
			const station = await controller.registerStation({ name: "S1" });

			// Session 1: 1 burger at $10
			const sess1 = unwrap(await controller.startSession(station.id));
			await controller.addItem(sess1.id, {
				name: "Burger",
				price: 10,
				quantity: 1,
			});
			await controller.completeSession(sess1.id, "card");

			// Session 2: 2 drinks at $5 each
			const sess2 = unwrap(await controller.startSession(station.id));
			await controller.addItem(sess2.id, {
				name: "Drink",
				price: 5,
				quantity: 2,
			});
			await controller.completeSession(sess2.id, "cash");

			const stats = await controller.getStationStats(station.id);
			expect(stats.completedSessions).toBe(2);
			// Revenue = (10 + 0.8) + (10 + 0.8) = 10.8 + 10.8 = 21.6
			expect(stats.totalRevenue).toBe(21.6);
		});

		it("getStationStats excludes active session revenue", async () => {
			const station = await controller.registerStation({ name: "S1" });

			const active = unwrap(await controller.startSession(station.id));
			await controller.addItem(active.id, {
				name: "Burger",
				price: 10,
				quantity: 1,
			});

			const stats = await controller.getStationStats(station.id);
			expect(stats.completedSessions).toBe(0);
			expect(stats.totalRevenue).toBe(0);
		});

		it("getOverallStats counts abandoned sessions correctly", async () => {
			const s1 = await controller.registerStation({ name: "S1" });
			const s2 = await controller.registerStation({ name: "S2" });

			const sess1 = unwrap(await controller.startSession(s1.id));
			await controller.abandonSession(sess1.id);

			const sess2 = unwrap(await controller.startSession(s2.id));
			await controller.abandonSession(sess2.id);

			const sess3 = unwrap(await controller.startSession(s1.id));
			await controller.addItem(sess3.id, {
				name: "Item",
				price: 5,
				quantity: 1,
			});
			await controller.completeSession(sess3.id, "card");

			const stats = await controller.getOverallStats();
			expect(stats.totalStations).toBe(2);
			expect(stats.totalSessions).toBe(3);
			expect(stats.completedSessions).toBe(1);
			expect(stats.abandonedSessions).toBe(2);
			expect(stats.totalRevenue).toBe(5.4); // 5 + 0.4 tax
		});

		it("getOverallStats tracks online stations after heartbeats", async () => {
			const s1 = await controller.registerStation({ name: "S1" });
			const s2 = await controller.registerStation({ name: "S2" });
			await controller.registerStation({ name: "S3" });

			await controller.heartbeat(s1.id);
			await controller.heartbeat(s2.id);

			const stats = await controller.getOverallStats();
			expect(stats.totalStations).toBe(3);
			expect(stats.onlineStations).toBe(2);
		});
	});

	// ── Station update interactions ──────────────────────────────────

	describe("station update interactions", () => {
		it("deactivating station does not affect existing active session", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = unwrap(await controller.startSession(station.id));
			await controller.addItem(session.id, {
				name: "Burger",
				price: 10,
				quantity: 1,
			});

			await controller.updateStation(station.id, { isActive: false });

			// Session should still be completable
			const completed = await controller.completeSession(session.id, "card");
			expect(completed?.status).toBe("completed");
		});

		it("updating station settings preserves currentSessionId", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = unwrap(await controller.startSession(station.id));

			await controller.updateStation(station.id, {
				settings: { theme: "dark" },
			});

			const updatedStation = await controller.getStation(station.id);
			expect(updatedStation?.currentSessionId).toBe(session.id);
			expect(updatedStation?.settings).toEqual({ theme: "dark" });
		});

		it("multiple heartbeats keep station online", async () => {
			const station = await controller.registerStation({ name: "S1" });
			expect(station.isOnline).toBe(false);

			const h1 = unwrap(await controller.heartbeat(station.id));
			expect(h1.isOnline).toBe(true);
			const firstHeartbeat = unwrap(h1.lastHeartbeat);

			const h2 = unwrap(await controller.heartbeat(station.id));
			expect(h2.isOnline).toBe(true);
			expect(unwrap(h2.lastHeartbeat).getTime()).toBeGreaterThanOrEqual(
				firstHeartbeat.getTime(),
			);
		});
	});
});
