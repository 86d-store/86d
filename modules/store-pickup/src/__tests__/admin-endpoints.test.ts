import { describe, expect, it, vi } from "vitest";
import { cancelPickup } from "../admin/endpoints/cancel-pickup";
import { createBlackout } from "../admin/endpoints/create-blackout";
import { createLocation } from "../admin/endpoints/create-location";
import { createWindow } from "../admin/endpoints/create-window";
import { deleteBlackout } from "../admin/endpoints/delete-blackout";
import { deleteLocation } from "../admin/endpoints/delete-location";
import { deleteWindow } from "../admin/endpoints/delete-window";
import { getLocation } from "../admin/endpoints/get-location";
import { getPickup } from "../admin/endpoints/get-pickup";
import { listBlackoutsAdmin } from "../admin/endpoints/list-blackouts";
import { listLocations } from "../admin/endpoints/list-locations";
import { listPickups } from "../admin/endpoints/list-pickups";
import { listWindows } from "../admin/endpoints/list-windows";
import { summary } from "../admin/endpoints/summary";
import { updateLocation } from "../admin/endpoints/update-location";
import { updatePickupStatus } from "../admin/endpoints/update-pickup-status";
import { updateWindow } from "../admin/endpoints/update-window";
import type {
	PickupBlackout,
	PickupLocation,
	PickupOrder,
	PickupWindow,
	StorePickupController,
	StorePickupSummary,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeLocation(overrides: Partial<PickupLocation> = {}): PickupLocation {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Main Store",
		address: "123 Main St",
		city: "Austin",
		state: "TX",
		postalCode: "78701",
		country: "US",
		preparationMinutes: 15,
		active: true,
		sortOrder: 0,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeWindow(overrides: Partial<PickupWindow> = {}): PickupWindow {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		locationId: "loc_1",
		dayOfWeek: 1,
		startTime: "09:00",
		endTime: "17:00",
		capacity: 10,
		active: true,
		sortOrder: 0,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makePickup(overrides: Partial<PickupOrder> = {}): PickupOrder {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		locationId: "loc_1",
		windowId: "win_1",
		orderId: "order_1",
		scheduledDate: "2025-06-15",
		locationName: "Main Store",
		locationAddress: "123 Main St",
		startTime: "09:00",
		endTime: "17:00",
		status: "scheduled",
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeBlackout(overrides: Partial<PickupBlackout> = {}): PickupBlackout {
	return {
		id: crypto.randomUUID(),
		locationId: "loc_1",
		date: "2025-12-25",
		createdAt: new Date(),
		...overrides,
	};
}

function makeController(
	overrides: Partial<StorePickupController> = {},
): StorePickupController {
	return {
		createLocation: vi.fn().mockResolvedValue(makeLocation()),
		updateLocation: vi.fn().mockResolvedValue(null),
		getLocation: vi.fn().mockResolvedValue(null),
		listLocations: vi.fn().mockResolvedValue([]),
		deleteLocation: vi.fn().mockResolvedValue(false),
		createWindow: vi.fn().mockResolvedValue(makeWindow()),
		updateWindow: vi.fn().mockResolvedValue(null),
		getWindow: vi.fn().mockResolvedValue(null),
		listWindows: vi.fn().mockResolvedValue([]),
		deleteWindow: vi.fn().mockResolvedValue(false),
		schedulePickup: vi.fn().mockResolvedValue(makePickup()),
		getPickup: vi.fn().mockResolvedValue(null),
		getOrderPickup: vi.fn().mockResolvedValue(null),
		listPickups: vi.fn().mockResolvedValue([]),
		updatePickupStatus: vi.fn().mockResolvedValue(null),
		cancelPickup: vi.fn().mockResolvedValue(null),
		getAvailableWindows: vi.fn().mockResolvedValue([]),
		getWindowBookingCount: vi.fn().mockResolvedValue(0),
		createBlackout: vi.fn().mockResolvedValue(makeBlackout()),
		deleteBlackout: vi.fn().mockResolvedValue(false),
		listBlackouts: vi.fn().mockResolvedValue([]),
		isBlackoutDate: vi.fn().mockResolvedValue(false),
		getSummary: vi.fn().mockResolvedValue({
			totalLocations: 0,
			activeLocations: 0,
			totalWindows: 0,
			activeWindows: 0,
			totalPickups: 0,
			scheduledPickups: 0,
			preparingPickups: 0,
			readyPickups: 0,
			completedPickups: 0,
			cancelledPickups: 0,
			blackoutDates: 0,
		} satisfies StorePickupSummary),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | boolean | number | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: StorePickupController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { storePickup: opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const listLocationsHandler = extractHandler(listLocations);
const createLocationHandler = extractHandler(createLocation);
const getLocationHandler = extractHandler(getLocation);
const updateLocationHandler = extractHandler(updateLocation);
const deleteLocationHandler = extractHandler(deleteLocation);
const listWindowsHandler = extractHandler(listWindows);
const createWindowHandler = extractHandler(createWindow);
const updateWindowHandler = extractHandler(updateWindow);
const deleteWindowHandler = extractHandler(deleteWindow);
const listPickupsHandler = extractHandler(listPickups);
const getPickupHandler = extractHandler(getPickup);
const updateStatusHandler = extractHandler(updatePickupStatus);
const cancelPickupHandler = extractHandler(cancelPickup);
const listBlackoutsHandler = extractHandler(listBlackoutsAdmin);
const createBlackoutHandler = extractHandler(createBlackout);
const deleteBlackoutHandler = extractHandler(deleteBlackout);
const summaryHandler = extractHandler(summary);

// ── Locations ─────────────────────────────────────────────────────────────────

describe("admin GET /store-pickup/locations", () => {
	it("returns empty list when no locations", async () => {
		const result = (await call(listLocationsHandler)) as {
			locations: PickupLocation[];
		};
		expect(result.locations).toHaveLength(0);
	});

	it("returns locations from controller", async () => {
		const locations = [makeLocation(), makeLocation()];
		const ctrl = makeController({
			listLocations: vi.fn().mockResolvedValue(locations),
		});
		const result = (await call(listLocationsHandler, {
			controller: ctrl,
		})) as { locations: PickupLocation[] };
		expect(result.locations).toHaveLength(2);
	});

	it("forwards active filter to controller", async () => {
		const ctrl = makeController();
		await call(listLocationsHandler, {
			query: { active: "true" },
			controller: ctrl,
		});
		expect(ctrl.listLocations).toHaveBeenCalledWith(
			expect.objectContaining({ active: true }),
		);
	});
});

describe("admin POST /store-pickup/locations/create", () => {
	it("creates a location and returns it", async () => {
		const loc = makeLocation({ name: "North Branch" });
		const ctrl = makeController({
			createLocation: vi.fn().mockResolvedValue(loc),
		});
		const result = (await call(createLocationHandler, {
			body: {
				name: "North Branch",
				address: "456 Oak Ave",
				city: "Dallas",
				state: "TX",
				postalCode: "75201",
				country: "US",
			},
			controller: ctrl,
		})) as { location: PickupLocation };
		expect(result.location.name).toBe("North Branch");
	});
});

describe("admin GET /store-pickup/locations/:id", () => {
	it("returns 404 when location not found", async () => {
		const result = (await call(getLocationHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns location when found", async () => {
		const loc = makeLocation({ id: "loc_1" });
		const ctrl = makeController({
			getLocation: vi.fn().mockResolvedValue(loc),
		});
		const result = (await call(getLocationHandler, {
			params: { id: "loc_1" },
			controller: ctrl,
		})) as { location: PickupLocation };
		expect(result.location.id).toBe("loc_1");
	});
});

describe("admin POST /store-pickup/locations/:id/update", () => {
	it("returns 404 when location not found", async () => {
		const result = (await call(updateLocationHandler, {
			params: { id: "missing" },
			body: { active: false },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns updated location on success", async () => {
		const loc = makeLocation({ active: false });
		const ctrl = makeController({
			updateLocation: vi.fn().mockResolvedValue(loc),
		});
		const result = (await call(updateLocationHandler, {
			params: { id: loc.id },
			body: { active: false },
			controller: ctrl,
		})) as { location: PickupLocation };
		expect(result.location.active).toBe(false);
	});
});

describe("admin POST /store-pickup/locations/:id/delete", () => {
	it("returns 404 when location not found", async () => {
		const result = (await call(deleteLocationHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("deletes location and returns success", async () => {
		const ctrl = makeController({
			deleteLocation: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteLocationHandler, {
			params: { id: "loc_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});

// ── Windows ───────────────────────────────────────────────────────────────────

describe("admin GET /store-pickup/windows", () => {
	it("returns windows for a location", async () => {
		const windows = [makeWindow(), makeWindow()];
		const ctrl = makeController({
			listWindows: vi.fn().mockResolvedValue(windows),
		});
		const result = (await call(listWindowsHandler, {
			query: { locationId: "loc_1" },
			controller: ctrl,
		})) as { windows: PickupWindow[] };
		expect(result.windows).toHaveLength(2);
		expect(ctrl.listWindows).toHaveBeenCalledWith(
			expect.objectContaining({ locationId: "loc_1" }),
		);
	});
});

describe("admin POST /store-pickup/windows/create", () => {
	it("creates a window and returns it", async () => {
		const win = makeWindow({ dayOfWeek: 3, capacity: 5 });
		const ctrl = makeController({
			createWindow: vi.fn().mockResolvedValue(win),
		});
		const result = (await call(createWindowHandler, {
			body: {
				locationId: "loc_1",
				dayOfWeek: 3,
				startTime: "10:00",
				endTime: "18:00",
				capacity: 5,
			},
			controller: ctrl,
		})) as { window: PickupWindow };
		expect(result.window.capacity).toBe(5);
	});
});

describe("admin POST /store-pickup/windows/:id/update", () => {
	it("returns 404 when window not found", async () => {
		const result = (await call(updateWindowHandler, {
			params: { id: "missing" },
			body: { capacity: 20 },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("updates window and returns it", async () => {
		const win = makeWindow({ capacity: 20 });
		const ctrl = makeController({
			updateWindow: vi.fn().mockResolvedValue(win),
		});
		const result = (await call(updateWindowHandler, {
			params: { id: win.id },
			body: { capacity: 20 },
			controller: ctrl,
		})) as { window: PickupWindow };
		expect(result.window.capacity).toBe(20);
	});
});

describe("admin POST /store-pickup/windows/:id/delete", () => {
	it("returns 404 when window not found", async () => {
		const result = (await call(deleteWindowHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("deletes window and returns success", async () => {
		const ctrl = makeController({
			deleteWindow: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteWindowHandler, {
			params: { id: "win_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});

// ── Pickups ───────────────────────────────────────────────────────────────────

describe("admin GET /store-pickup/pickups", () => {
	it("returns empty list when no pickups", async () => {
		const result = (await call(listPickupsHandler)) as {
			pickups: PickupOrder[];
		};
		expect(result.pickups).toHaveLength(0);
	});

	it("forwards status filter to controller", async () => {
		const ctrl = makeController();
		await call(listPickupsHandler, {
			query: { status: "ready" },
			controller: ctrl,
		});
		expect(ctrl.listPickups).toHaveBeenCalledWith(
			expect.objectContaining({ status: "ready" }),
		);
	});

	it("forwards locationId filter to controller", async () => {
		const ctrl = makeController();
		await call(listPickupsHandler, {
			query: { locationId: "loc_1" },
			controller: ctrl,
		});
		expect(ctrl.listPickups).toHaveBeenCalledWith(
			expect.objectContaining({ locationId: "loc_1" }),
		);
	});
});

describe("admin GET /store-pickup/pickups/:id", () => {
	it("returns 404 when pickup not found", async () => {
		const result = (await call(getPickupHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns pickup when found", async () => {
		const pickup = makePickup({ id: "pick_1" });
		const ctrl = makeController({
			getPickup: vi.fn().mockResolvedValue(pickup),
		});
		const result = (await call(getPickupHandler, {
			params: { id: "pick_1" },
			controller: ctrl,
		})) as { pickup: PickupOrder };
		expect(result.pickup.id).toBe("pick_1");
	});
});

describe("admin POST /store-pickup/pickups/:id/status", () => {
	it("returns 404 when pickup not found", async () => {
		const result = (await call(updateStatusHandler, {
			params: { id: "missing" },
			body: { status: "preparing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("updates status and returns updated pickup", async () => {
		const pickup = makePickup({ status: "ready" });
		const ctrl = makeController({
			updatePickupStatus: vi.fn().mockResolvedValue(pickup),
		});
		const result = (await call(updateStatusHandler, {
			params: { id: pickup.id },
			body: { status: "ready" },
			controller: ctrl,
		})) as { pickup: PickupOrder };
		expect(result.pickup.status).toBe("ready");
		expect(ctrl.updatePickupStatus).toHaveBeenCalledWith(pickup.id, "ready");
	});
});

describe("admin POST /store-pickup/pickups/:id/cancel", () => {
	it("returns 404 when pickup not found", async () => {
		const result = (await call(cancelPickupHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("cancels pickup and returns it", async () => {
		const pickup = makePickup({ status: "cancelled" });
		const ctrl = makeController({
			cancelPickup: vi.fn().mockResolvedValue(pickup),
		});
		const result = (await call(cancelPickupHandler, {
			params: { id: pickup.id },
			controller: ctrl,
		})) as { pickup: PickupOrder };
		expect(result.pickup.status).toBe("cancelled");
	});
});

// ── Blackouts ─────────────────────────────────────────────────────────────────

describe("admin GET /store-pickup/blackouts", () => {
	it("returns blackouts for a location", async () => {
		const blackouts = [makeBlackout({ date: "2025-12-25" })];
		const ctrl = makeController({
			listBlackouts: vi.fn().mockResolvedValue(blackouts),
		});
		const result = (await call(listBlackoutsHandler, {
			query: { locationId: "loc_1" },
			controller: ctrl,
		})) as { blackouts: PickupBlackout[] };
		expect(result.blackouts).toHaveLength(1);
		expect(ctrl.listBlackouts).toHaveBeenCalledWith("loc_1");
	});
});

describe("admin POST /store-pickup/blackouts/create", () => {
	it("creates a blackout and returns it", async () => {
		const blackout = makeBlackout({ date: "2025-07-04" });
		const ctrl = makeController({
			createBlackout: vi.fn().mockResolvedValue(blackout),
		});
		const result = (await call(createBlackoutHandler, {
			body: { locationId: "loc_1", date: "2025-07-04", reason: "Holiday" },
			controller: ctrl,
		})) as { blackout: PickupBlackout };
		expect(result.blackout.date).toBe("2025-07-04");
	});
});

describe("admin POST /store-pickup/blackouts/:id/delete", () => {
	it("returns 404 when blackout not found", async () => {
		const result = (await call(deleteBlackoutHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("deletes blackout and returns success", async () => {
		const ctrl = makeController({
			deleteBlackout: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteBlackoutHandler, {
			params: { id: "bl_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});

// ── Summary ───────────────────────────────────────────────────────────────────

describe("admin GET /store-pickup/summary", () => {
	it("returns zero-state summary when nothing exists", async () => {
		const result = (await call(summaryHandler)) as {
			summary: StorePickupSummary;
		};
		expect(result.summary.totalLocations).toBe(0);
		expect(result.summary.totalPickups).toBe(0);
	});

	it("returns real summary from controller", async () => {
		const ctrl = makeController({
			getSummary: vi.fn().mockResolvedValue({
				totalLocations: 3,
				activeLocations: 2,
				totalWindows: 15,
				activeWindows: 12,
				totalPickups: 87,
				scheduledPickups: 10,
				preparingPickups: 4,
				readyPickups: 2,
				completedPickups: 65,
				cancelledPickups: 6,
				blackoutDates: 5,
			}),
		});
		const result = (await call(summaryHandler, { controller: ctrl })) as {
			summary: StorePickupSummary;
		};
		expect(result.summary.totalLocations).toBe(3);
		expect(result.summary.totalPickups).toBe(87);
	});
});
