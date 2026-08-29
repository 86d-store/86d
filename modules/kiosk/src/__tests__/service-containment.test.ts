import {
	createMockDataService,
	createMockTransactionRunner,
} from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import {
	createKioskController,
	KioskMutationUnavailableError,
} from "../service-impl";

describe("kiosk service containment", () => {
	let data: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createKioskController>;

	beforeEach(() => {
		data = createMockDataService();
		controller = createKioskController(
			data,
			createMockTransactionRunner({ data }),
		);
	});

	it("registers, updates, gets, and filters stations", async () => {
		const first = await controller.registerStation({
			name: "Front Counter",
			location: "Lobby",
		});
		await controller.registerStation({ name: "Side Counter" });

		expect(first).toMatchObject({
			name: "Front Counter",
			location: "Lobby",
			isActive: true,
			isOnline: false,
		});
		expect(
			await controller.updateStation(first.id, {
				name: "Main Counter",
				isActive: false,
			}),
		).toMatchObject({
			name: "Main Counter",
			location: "Lobby",
			isActive: false,
		});
		expect(await controller.getStation(first.id)).toMatchObject({
			name: "Main Counter",
		});
		expect(await controller.listStations({ isActive: true })).toHaveLength(1);
		expect(await controller.listStations({ take: 1, skip: 1 })).toHaveLength(1);
	});

	it("fails station mutation closed without owner-local locking", async () => {
		const unsafe = createKioskController(data);
		const station = await unsafe.registerStation({ name: "Kiosk 1" });

		await expect(
			unsafe.updateStation(station.id, { name: "Changed" }),
		).rejects.toBeInstanceOf(KioskMutationUnavailableError);
		expect(await unsafe.getStation(station.id)).toMatchObject({
			name: "Kiosk 1",
		});
	});

	it("withdraws unauthenticated lifecycle, health, money, and destructive mutations", () => {
		expect(controller).not.toHaveProperty("startSession");
		expect(controller).not.toHaveProperty("getSession");
		expect(controller).not.toHaveProperty("abandonSession");
		expect(controller).not.toHaveProperty("heartbeat");
		expect(controller).not.toHaveProperty("deleteStation");
		expect(controller).not.toHaveProperty("addItem");
		expect(controller).not.toHaveProperty("removeItem");
		expect(controller).not.toHaveProperty("updateItemQuantity");
	});

	it("reads legacy sessions without narrowing fractional stored prices", async () => {
		const now = new Date();
		await data.upsert("kioskSession", "legacy-session", {
			id: "legacy-session",
			stationId: "legacy-station",
			status: "completed",
			items: [{ id: "legacy-item", name: "Legacy", price: 7.99, quantity: 1 }],
			subtotal: 0,
			tax: 0,
			tip: 0,
			total: 9_999,
			paymentMethod: "card",
			paymentStatus: "paid",
			startedAt: now,
			completedAt: now,
			createdAt: now,
		});

		const sessions = await controller.listSessions();
		expect(sessions).toHaveLength(1);
		expect(sessions[0]?.items[0]?.price).toBe(7.99);
	});

	it("fails reads closed instead of dropping malformed durable records", async () => {
		await data.upsert("kioskSession", "malformed", { id: "malformed" });
		await data.upsert("kioskStation", "malformed", { id: "malformed" });

		await expect(controller.listSessions()).rejects.toBeInstanceOf(
			KioskMutationUnavailableError,
		);
		await expect(controller.listStations()).rejects.toBeInstanceOf(
			KioskMutationUnavailableError,
		);
	});

	it("never projects legacy completion, payment, revenue, or health as stats", async () => {
		const station = await controller.registerStation({ name: "Kiosk 1" });
		const now = new Date();
		await data.upsert("kioskStation", station.id, {
			...station,
			isOnline: true,
			lastHeartbeat: now,
		});
		await data.upsert("kioskSession", "legacy-completed", {
			id: "legacy-completed",
			stationId: station.id,
			status: "completed",
			items: [],
			subtotal: 0,
			tax: 0,
			tip: 0,
			total: 9_999,
			paymentMethod: "card",
			paymentStatus: "paid",
			startedAt: now,
			completedAt: now,
			createdAt: now,
		});

		expect(await controller.getStationStats(station.id)).toMatchObject({
			totalSessions: 1,
			completedSessions: 0,
			totalRevenue: 0,
		});
		expect(await controller.getOverallStats()).toMatchObject({
			totalStations: 1,
			onlineStations: 0,
			totalSessions: 1,
			completedSessions: 0,
			totalRevenue: 0,
		});
	});

	it("counts only neutral abandoned and timed-out lifecycle facts", async () => {
		const now = new Date();
		for (const [id, status] of [
			["abandoned", "abandoned"],
			["timed-out", "timed-out"],
		] as const) {
			await data.upsert("kioskSession", id, {
				id,
				stationId: "station-1",
				status,
				items: [],
				subtotal: 0,
				tax: 0,
				tip: 0,
				total: 0,
				paymentStatus: "pending",
				startedAt: now,
				completedAt: now,
				createdAt: now,
			});
		}

		expect(await controller.getStationStats("station-1")).toMatchObject({
			totalSessions: 2,
			abandonedSessions: 2,
			completedSessions: 0,
			totalRevenue: 0,
		});
	});
});
