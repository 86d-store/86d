import { describe, expect, it, vi } from "vitest";
import { createStationEndpoint } from "../admin/endpoints/create-station";
import { deleteStationEndpoint } from "../admin/endpoints/delete-station";
import { kioskStatsEndpoint } from "../admin/endpoints/kiosk-stats";
import { listSessionsEndpoint } from "../admin/endpoints/list-sessions";
import { listStationsEndpoint } from "../admin/endpoints/list-stations";
import { updateStationEndpoint } from "../admin/endpoints/update-station";
import type {
	KioskController,
	KioskSession,
	KioskStation,
	OverallStats,
} from "../service";

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
		deleteStation: vi.fn().mockResolvedValue(false),
		listStations: vi.fn().mockResolvedValue([]),
		getStation: vi.fn().mockResolvedValue(null),
		heartbeat: vi.fn().mockResolvedValue(null),
		startSession: vi.fn().mockResolvedValue(null),
		addItem: vi.fn().mockResolvedValue(null),
		removeItem: vi.fn().mockResolvedValue(null),
		updateItemQuantity: vi.fn().mockResolvedValue(null),
		getSession: vi.fn().mockResolvedValue(null),
		completeSession: vi.fn().mockResolvedValue(null),
		abandonSession: vi.fn().mockResolvedValue(null),
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
const deleteHandler = extractHandler(deleteStationEndpoint);
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
	it("returns null when station not found", async () => {
		const result = (await call(updateHandler, {
			params: { id: "missing" },
			body: { name: "New Name" },
		})) as { station: KioskStation | null };
		expect(result.station).toBeNull();
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
	});
});

describe("admin DELETE /kiosk/stations/:id/delete", () => {
	it("returns deleted=false when station not found", async () => {
		const result = (await call(deleteHandler, {
			params: { id: "missing" },
		})) as { deleted: boolean };
		expect(result.deleted).toBe(false);
	});

	it("returns deleted=true when station removed", async () => {
		const ctrl = makeController({
			deleteStation: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteHandler, {
			params: { id: "s1" },
			controller: ctrl,
		})) as { deleted: boolean };
		expect(result.deleted).toBe(true);
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
				totalRevenue: 45000,
			}),
		});
		const result = (await call(statsHandler, { controller: ctrl })) as {
			stats: OverallStats;
		};
		expect(result.stats.totalStations).toBe(3);
		expect(result.stats.totalRevenue).toBe(45000);
	});
});
