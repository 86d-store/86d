import { describe, expect, it, vi } from "vitest";
import { createStationEndpoint } from "../admin/endpoints/create-station";
import { kioskStatsEndpoint } from "../admin/endpoints/kiosk-stats";
import { listSessionsEndpoint } from "../admin/endpoints/list-sessions";
import { listStationsEndpoint } from "../admin/endpoints/list-stations";
import { adminEndpoints } from "../admin/endpoints/routes";
import { updateStationEndpoint } from "../admin/endpoints/update-station";
import type {
	KioskController,
	KioskSession,
	KioskStation,
	OverallStats,
} from "../service";
import { KioskMutationUnavailableError } from "../service-impl";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeStation(overrides: Partial<KioskStation> = {}): KioskStation {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Kiosk 1",
		isOnline: true,
		isActive: true,
		settings: {},
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeController(
	overrides: Partial<KioskController> = {},
): KioskController {
	const defaultStats: OverallStats = {
		totalStations: 0,
		onlineStations: 0,
		totalSessions: 0,
		completedSessions: 0,
		abandonedSessions: 0,
		totalRevenue: 0,
	};
	return {
		registerStation: vi.fn().mockResolvedValue(makeStation()),
		updateStation: vi.fn().mockResolvedValue(null),
		listStations: vi.fn().mockResolvedValue([]),
		getStation: vi.fn().mockResolvedValue(null),
		listSessions: vi.fn().mockResolvedValue([]),
		getStationStats: vi.fn().mockResolvedValue({
			totalSessions: 0,
			completedSessions: 0,
			abandonedSessions: 0,
			totalRevenue: 0,
		}),
		getOverallStats: vi.fn().mockResolvedValue(defaultStats),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: KioskController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { kiosk: opts.controller ?? makeController() },
		},
	});
}

const listStationsHandler = extractHandler(listStationsEndpoint);
const createHandler = extractHandler(createStationEndpoint);
const updateHandler = extractHandler(updateStationEndpoint);
const listSessionsHandler = extractHandler(listSessionsEndpoint);
const statsHandler = extractHandler(kioskStatsEndpoint);

describe("admin GET /kiosk/stations", () => {
	it("returns empty stations list", async () => {
		const result = (await call(listStationsHandler)) as {
			stations: KioskStation[];
			total: number;
		};
		expect(result.stations).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("forwards isActive filter to controller", async () => {
		const ctrl = makeController();
		await call(listStationsHandler, {
			query: { isActive: "true" },
			controller: ctrl,
		});
		expect(ctrl.listStations).toHaveBeenCalledWith(
			expect.objectContaining({ isActive: true }),
		);
	});
});

describe("admin POST /kiosk/stations/create", () => {
	it("creates station and returns it", async () => {
		const station = makeStation({ name: "Drive-Thru Kiosk" });
		const ctrl = makeController({
			registerStation: vi.fn().mockResolvedValue(station),
		});
		const result = (await call(createHandler, {
			body: { name: "Drive-Thru Kiosk" },
			controller: ctrl,
		})) as { station: KioskStation };
		expect(result.station.name).toBe("Drive-Thru Kiosk");
		expect(result.station).not.toHaveProperty("isOnline");
		expect(result.station).not.toHaveProperty("lastHeartbeat");
		expect(result.station).not.toHaveProperty("currentSessionId");
	});

	it("calls registerStation with correct params", async () => {
		const ctrl = makeController();
		await call(createHandler, {
			body: { name: "Lobby Kiosk", location: "Main entrance" },
			controller: ctrl,
		});
		expect(ctrl.registerStation).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Lobby Kiosk",
				location: "Main entrance",
			}),
		);
	});
});

describe("admin PUT /kiosk/stations/:id", () => {
	it("returns a stable not-found response", async () => {
		const result = await call(updateHandler, {
			params: { id: "missing" },
			body: { name: "New Name" },
		});
		expect(result).toEqual({ error: "Station not found", status: 404 });
	});

	it("updates station and returns it", async () => {
		const station = makeStation({ name: "Renamed Kiosk" });
		const ctrl = makeController({
			updateStation: vi.fn().mockResolvedValue(station),
		});
		const result = (await call(updateHandler, {
			params: { id: station.id },
			body: { name: "Renamed Kiosk" },
			controller: ctrl,
		})) as { station: KioskStation };
		expect(result.station.name).toBe("Renamed Kiosk");
		expect(result.station).not.toHaveProperty("isOnline");
		expect(result.station).not.toHaveProperty("lastHeartbeat");
		expect(result.station).not.toHaveProperty("currentSessionId");
	});

	it("maps unavailable locking to a stable response", async () => {
		const ctrl = makeController({
			updateStation: vi
				.fn()
				.mockRejectedValue(new KioskMutationUnavailableError()),
		});
		expect(
			await call(updateHandler, {
				params: { id: "s-1" },
				body: { name: "New Name" },
				controller: ctrl,
			}),
		).toEqual({ error: "Station update is unavailable", status: 503 });
	});
});

describe("admin station containment", () => {
	it("does not expose station deletion without a destructive workflow", () => {
		expect(adminEndpoints).not.toHaveProperty(
			"/admin/kiosk/stations/:id/delete",
		);
	});
});

describe("admin GET /kiosk/sessions", () => {
	it("returns empty sessions list", async () => {
		const result = (await call(listSessionsHandler)) as {
			sessions: KioskSession[];
			total: number;
		};
		expect(result.sessions).toHaveLength(0);
	});

	it("forwards stationId filter to controller", async () => {
		const ctrl = makeController();
		await call(listSessionsHandler, {
			query: { stationId: "s-1" },
			controller: ctrl,
		});
		expect(ctrl.listSessions).toHaveBeenCalledWith(
			expect.objectContaining({ stationId: "s-1" }),
		);
	});

	it("projects legacy rows without money or payment claims", async () => {
		const now = new Date();
		const ctrl = makeController({
			listSessions: vi.fn().mockResolvedValue([
				{
					id: "legacy-session",
					stationId: "station-1",
					status: "completed",
					items: [{ id: "item-1", name: "Item", price: 500, quantity: 1 }],
					subtotal: 500,
					tax: 40,
					tip: 100,
					total: 640,
					paymentMethod: "card",
					paymentStatus: "paid",
					startedAt: now,
					completedAt: now,
					createdAt: now,
				},
			]),
		});

		const result = await call(listSessionsHandler, { controller: ctrl });
		expect(result).toEqual({
			sessions: [
				{
					id: "legacy-session",
					stationId: "station-1",
					status: "legacy-completed",
					startedAt: now,
					completedAt: now,
				},
			],
			total: 1,
		});
		const projection = (result as { sessions: Array<Record<string, unknown>> })
			.sessions[0];
		expect(projection).not.toHaveProperty("items");
		expect(projection).not.toHaveProperty("subtotal");
		expect(projection).not.toHaveProperty("paymentStatus");
		expect(projection).not.toHaveProperty("paymentMethod");
	});
});

describe("admin GET /kiosk/stats", () => {
	it("returns zero-state overall stats", async () => {
		const result = (await call(statsHandler)) as { stats: OverallStats };
		expect(result.stats.totalStations).toBe(0);
		expect(result.stats.totalRevenue).toBe(0);
	});

	it("returns real stats from controller", async () => {
		const ctrl = makeController({
			getOverallStats: vi.fn().mockResolvedValue({
				totalStations: 3,
				onlineStations: 2,
				totalSessions: 150,
				completedSessions: 140,
				abandonedSessions: 10,
				totalRevenue: 0,
			}),
		});
		const result = (await call(statsHandler, { controller: ctrl })) as {
			stats: OverallStats;
		};
		expect(result.stats.totalStations).toBe(3);
		expect(result.stats.completedSessions).toBe(0);
		expect(result.stats.totalRevenue).toBe(0);
	});
});
