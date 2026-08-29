import {
	createMockDataService,
	createMockTransactionRunner,
} from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

	it("clears an existing station location explicitly", async () => {
		const station = await controller.registerStation({
			name: "Kiosk 1",
			location: "Lobby",
		});

		await expect(
			controller.updateStation(station.id, { location: null }),
		).resolves.toMatchObject({ location: null });
		await expect(controller.getStation(station.id)).resolves.toMatchObject({
			location: null,
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

	it("searches, sorts, and paginates complete admin projections deterministically", async () => {
		const now = new Date("2026-01-01T00:00:00.000Z");
		for (const id of ["station-b", "station-a"]) {
			await data.upsert("kioskStation", id, {
				id,
				name: "Same station",
				location: "Lobby",
				isOnline: false,
				isActive: id === "station-a",
				settings: {},
				createdAt: now,
				updatedAt: now,
			});
		}
		for (const id of ["session-b", "session-a"]) {
			await data.upsert("kioskSession", id, {
				id,
				stationId: "station-a",
				status: "active",
				items: [],
				subtotal: 0,
				tax: 0,
				tip: 0,
				total: 0,
				paymentStatus: "pending",
				startedAt: now,
				createdAt: now,
			});
		}

		await expect(
			controller.listStationAdminPage({
				search: "lobby",
				sort: "name",
				direction: "desc",
				take: 1,
				skip: 1,
			}),
		).resolves.toEqual({
			stations: [expect.objectContaining({ id: "station-b" })],
			total: 2,
		});
		await expect(
			controller.listSessionAdminPage({
				search: "legacy active",
				sort: "startedAt",
				direction: "desc",
			}),
		).resolves.toEqual({
			sessions: [
				expect.objectContaining({ id: "session-a" }),
				expect.objectContaining({ id: "session-b" }),
			],
			total: 2,
		});
		await expect(
			controller.listStationAdminPage({ search: "active" }),
		).resolves.toMatchObject({ total: 0 });
	});

	it("continues lists and neutral stats beyond one storage batch", async () => {
		const now = new Date("2026-02-01T00:00:00.000Z");
		for (let index = 0; index <= 1_000; index += 1) {
			const suffix = index.toString().padStart(4, "0");
			await data.upsert("kioskStation", `batch-station-${suffix}`, {
				id: `batch-station-${suffix}`,
				name: index === 1_000 ? "Last batch station" : `Station ${suffix}`,
				isOnline: false,
				isActive: true,
				settings: {},
				createdAt: now,
				updatedAt: now,
			});
			await data.upsert("kioskSession", `batch-session-${suffix}`, {
				id: `batch-session-${suffix}`,
				stationId: "station-batch-target",
				status: "abandoned",
				items: [],
				subtotal: 0,
				tax: 0,
				tip: 0,
				total: 0,
				paymentStatus: "pending",
				startedAt: now,
				createdAt: now,
			});
		}

		await expect(
			controller.listStationAdminPage({ search: "last batch" }),
		).resolves.toEqual({
			stations: [expect.objectContaining({ id: "batch-station-1000" })],
			total: 1,
		});
		await expect(
			controller.listSessionAdminPage({ search: "batch-session-1000" }),
		).resolves.toEqual({
			sessions: [expect.objectContaining({ id: "batch-session-1000" })],
			total: 1,
		});
		await expect(
			controller.getStationStats("station-batch-target"),
		).resolves.toMatchObject({
			totalSessions: 1_001,
			abandonedSessions: 1_001,
			completedSessions: 0,
			totalRevenue: 0,
		});
		await expect(controller.getOverallStats()).resolves.toMatchObject({
			totalStations: 1_001,
			totalSessions: 1_001,
			onlineStations: 0,
			completedSessions: 0,
			totalRevenue: 0,
		});
	});

	it("fails reads closed instead of dropping malformed durable records", async () => {
		await data.upsert("kioskSession", "malformed", { id: "malformed" });
		await data.upsert("kioskStation", "malformed", { id: "malformed" });

		await expect(controller.listSessions()).rejects.toBeInstanceOf(
			KioskMutationUnavailableError,
		);
		await expect(controller.listSessionAdminPage()).rejects.toBeInstanceOf(
			KioskMutationUnavailableError,
		);
		await expect(controller.listStations()).rejects.toBeInstanceOf(
			KioskMutationUnavailableError,
		);
		await expect(controller.listStationAdminPage()).rejects.toBeInstanceOf(
			KioskMutationUnavailableError,
		);
	});

	it("fails station pages and statistics closed on a malformed second batch", async () => {
		const now = new Date("2026-03-01T00:00:00.000Z");
		await Promise.all(
			Array.from({ length: 1_000 }, (_, index) => {
				const suffix = index.toString().padStart(4, "0");
				return data.upsert("kioskStation", `valid-station-${suffix}`, {
					id: `valid-station-${suffix}`,
					name: `Station ${suffix}`,
					isOnline: false,
					isActive: true,
					settings: {},
					createdAt: now,
					updatedAt: now,
				});
			}),
		);
		await data.upsert("kioskStation", "zz-malformed-station", {
			id: "zz-malformed-station",
		});
		const findMany = vi.spyOn(data, "findMany");

		await expect(controller.listStationAdminPage()).rejects.toBeInstanceOf(
			KioskMutationUnavailableError,
		);
		await expect(controller.getOverallStats()).rejects.toBeInstanceOf(
			KioskMutationUnavailableError,
		);
		expect(findMany).toHaveBeenCalledWith(
			"kioskStation",
			expect.objectContaining({ skip: 1_000, take: 1_000 }),
		);
	});

	it("fails session pages and statistics closed on a malformed second batch", async () => {
		const now = new Date("2026-03-01T00:00:00.000Z");
		await Promise.all(
			Array.from({ length: 1_000 }, (_, index) => {
				const suffix = index.toString().padStart(4, "0");
				return data.upsert("kioskSession", `valid-session-${suffix}`, {
					id: `valid-session-${suffix}`,
					stationId: "target-station",
					status: "active",
					items: [],
					subtotal: 0,
					tax: 0,
					tip: 0,
					total: 0,
					paymentStatus: "pending",
					startedAt: now,
					createdAt: now,
				});
			}),
		);
		await data.upsert("kioskSession", "zz-malformed-session", {
			id: "zz-malformed-session",
			stationId: "target-station",
			status: "not-a-session-status",
		});
		const findMany = vi.spyOn(data, "findMany");

		await expect(controller.listSessionAdminPage()).rejects.toBeInstanceOf(
			KioskMutationUnavailableError,
		);
		await expect(
			controller.getStationStats("target-station"),
		).rejects.toBeInstanceOf(KioskMutationUnavailableError);
		expect(findMany).toHaveBeenCalledWith(
			"kioskSession",
			expect.objectContaining({ skip: 1_000, take: 1_000 }),
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
