import { describe, expect, it, vi } from "vitest";
import { createLocation } from "../admin/endpoints/create-location";
import { deleteLocation } from "../admin/endpoints/delete-location";
import { getLocation } from "../admin/endpoints/get-location";
import { listLocations } from "../admin/endpoints/list-locations";
import { getStats } from "../admin/endpoints/stats";
import { updateLocation } from "../admin/endpoints/update-location";
import type { Location, StoreLocatorController } from "../service";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeLocation(overrides: Partial<Location> = {}): Location {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Main Store",
		slug: "main-store",
		address: "100 Commerce St",
		city: "Portland",
		country: "US",
		latitude: 45.5051,
		longitude: -122.675,
		isActive: true,
		isFeatured: false,
		pickupEnabled: true,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeController(
	overrides: Partial<StoreLocatorController> = {},
): StoreLocatorController {
	return {
		createLocation: vi.fn().mockResolvedValue(makeLocation()),
		getLocation: vi.fn().mockResolvedValue(null),
		getLocationBySlug: vi.fn().mockResolvedValue(null),
		listLocations: vi.fn().mockResolvedValue([]),
		updateLocation: vi.fn().mockResolvedValue(makeLocation()),
		deleteLocation: vi.fn().mockResolvedValue(undefined),
		searchNearby: vi.fn().mockResolvedValue([]),
		listRegions: vi.fn().mockResolvedValue([]),
		listCountries: vi.fn().mockResolvedValue([]),
		listCities: vi.fn().mockResolvedValue([]),
		isOpen: vi
			.fn()
			.mockResolvedValue({ open: false, currentDay: "monday", hours: null }),
		getStats: vi.fn().mockResolvedValue({
			totalLocations: 0,
			activeLocations: 0,
			pickupLocations: 0,
			featuredLocations: 0,
			countries: 0,
			regions: 0,
		}),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: StoreLocatorController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { storeLocator: opts.controller ?? makeController() },
		},
	});
}

const listHandler = extractHandler(listLocations);
const createHandler = extractHandler(createLocation);
const getHandler = extractHandler(getLocation);
const updateHandler = extractHandler(updateLocation);
const deleteHandler = extractHandler(deleteLocation);
const statsHandler = extractHandler(getStats);

describe("admin GET /store-locator/locations", () => {
	it("returns empty locations list", async () => {
		const result = (await call(listHandler)) as {
			locations: Location[];
			total: number;
		};
		expect(result.locations).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("forwards country filter to controller", async () => {
		const ctrl = makeController();
		await call(listHandler, { query: { country: "CA" }, controller: ctrl });
		expect(ctrl.listLocations).toHaveBeenCalledWith(
			expect.objectContaining({ country: "CA" }),
		);
	});
});

describe("admin POST /store-locator/locations/create", () => {
	it("creates location and returns it", async () => {
		const loc = makeLocation({ name: "West Side Store" });
		const ctrl = makeController({
			createLocation: vi.fn().mockResolvedValue(loc),
		});
		const result = (await call(createHandler, {
			body: {
				name: "West Side Store",
				slug: "west-side",
				address: "200 West Ave",
				city: "Portland",
				country: "US",
				latitude: 45.5,
				longitude: -122.7,
			},
			controller: ctrl,
		})) as { location: Location };
		expect(result.location.name).toBe("West Side Store");
	});

	it("calls controller with correct body params", async () => {
		const ctrl = makeController();
		await call(createHandler, {
			body: {
				name: "Test Store",
				slug: "test-store",
				address: "1 Test Rd",
				city: "Salem",
				country: "US",
				latitude: 44.9,
				longitude: -123.0,
				pickupEnabled: true,
			},
			controller: ctrl,
		});
		expect(ctrl.createLocation).toHaveBeenCalledWith(
			expect.objectContaining({ city: "Salem", pickupEnabled: true }),
		);
	});
});

describe("admin GET /store-locator/locations/:id", () => {
	it("returns 404 when location not found", async () => {
		const result = (await call(getHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns location when found", async () => {
		const loc = makeLocation({ id: "loc-1" });
		const ctrl = makeController({
			getLocation: vi.fn().mockResolvedValue(loc),
		});
		const result = (await call(getHandler, {
			params: { id: "loc-1" },
			controller: ctrl,
		})) as { location: Location };
		expect(result.location.id).toBe("loc-1");
	});
});

describe("admin POST /store-locator/locations/:id/update", () => {
	it("updates location and returns it", async () => {
		const loc = makeLocation({ name: "Renamed Store" });
		const ctrl = makeController({
			updateLocation: vi.fn().mockResolvedValue(loc),
		});
		const result = (await call(updateHandler, {
			params: { id: loc.id },
			body: { name: "Renamed Store" },
			controller: ctrl,
		})) as { location: Location };
		expect(result.location.name).toBe("Renamed Store");
	});

	it("calls updateLocation with id and body", async () => {
		const ctrl = makeController();
		await call(updateHandler, {
			params: { id: "loc-99" },
			body: { isActive: false },
			controller: ctrl,
		});
		expect(ctrl.updateLocation).toHaveBeenCalledWith(
			"loc-99",
			expect.objectContaining({ isActive: false }),
		);
	});
});

describe("admin DELETE /store-locator/locations/:id/delete", () => {
	it("returns success after deletion", async () => {
		const result = (await call(deleteHandler, {
			params: { id: "loc-1" },
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});

	it("calls deleteLocation with correct id", async () => {
		const ctrl = makeController();
		await call(deleteHandler, { params: { id: "loc-42" }, controller: ctrl });
		expect(ctrl.deleteLocation).toHaveBeenCalledWith("loc-42");
	});
});

describe("admin GET /store-locator/stats", () => {
	it("returns zero-state stats", async () => {
		const result = (await call(statsHandler)) as {
			totalLocations: number;
			activeLocations: number;
		};
		expect(result.totalLocations).toBe(0);
	});

	it("returns real stats", async () => {
		const ctrl = makeController({
			getStats: vi.fn().mockResolvedValue({
				totalLocations: 5,
				activeLocations: 4,
				pickupLocations: 3,
				featuredLocations: 1,
				countries: 2,
				regions: 3,
			}),
		});
		const result = (await call(statsHandler, { controller: ctrl })) as {
			totalLocations: number;
		};
		expect(result.totalLocations).toBe(5);
	});
});
