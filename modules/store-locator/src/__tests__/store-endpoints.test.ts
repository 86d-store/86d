import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createStoreLocatorControllers } from "../service-impl";

/**
 * Store endpoint integration tests for the store-locator module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. list-locations: returns active store locations
 * 2. get-location: returns a single location by slug
 * 3. search-nearby: finds locations by geographic proximity
 * 4. list-regions: returns available regions
 * 5. list-countries: returns available countries
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateListLocations(
	data: DataService,
	query: { country?: string; city?: string; featured?: boolean } = {},
) {
	const controller = createStoreLocatorControllers(data);
	const locations = await controller.listLocations({
		activeOnly: true,
		...query,
	});
	return { locations };
}

async function simulateGetLocation(data: DataService, slug: string) {
	const controller = createStoreLocatorControllers(data);
	const location = await controller.getLocationBySlug(slug);
	if (!location?.isActive) {
		return { error: "Location not found", status: 404 };
	}
	return { location };
}

async function simulateSearchNearby(
	data: DataService,
	body: {
		latitude: number;
		longitude: number;
		radius?: number;
		unit?: "km" | "mi";
	},
) {
	const controller = createStoreLocatorControllers(data);
	const locations = await controller.searchNearby(body);
	return { locations };
}

async function simulateListRegions(data: DataService) {
	const controller = createStoreLocatorControllers(data);
	const regions = await controller.listRegions();
	return { regions };
}

async function simulateListCountries(data: DataService) {
	const controller = createStoreLocatorControllers(data);
	const countries = await controller.listCountries();
	return { countries };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: list locations — active only", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns only active locations", async () => {
		const ctrl = createStoreLocatorControllers(data);
		await ctrl.createLocation({
			name: "Downtown Store",
			slug: "downtown",
			address: "123 Main St",
			city: "Austin",
			state: "TX",
			country: "US",
			latitude: 30.2672,
			longitude: -97.7431,
		});
		const closed = await ctrl.createLocation({
			name: "Closed Store",
			slug: "closed",
			address: "456 Old Rd",
			city: "Austin",
			state: "TX",
			country: "US",
			latitude: 30.25,
			longitude: -97.75,
		});
		await ctrl.updateLocation(closed.id, { isActive: false });

		const result = await simulateListLocations(data);

		expect(result.locations).toHaveLength(1);
		expect(result.locations[0].name).toBe("Downtown Store");
	});

	it("filters by country", async () => {
		const ctrl = createStoreLocatorControllers(data);
		await ctrl.createLocation({
			name: "US Store",
			slug: "us-store",
			address: "100 Main",
			city: "Austin",
			state: "TX",
			country: "US",
			latitude: 30.27,
			longitude: -97.74,
		});
		await ctrl.createLocation({
			name: "UK Store",
			slug: "uk-store",
			address: "10 High St",
			city: "London",
			state: "England",
			country: "GB",
			latitude: 51.5,
			longitude: -0.12,
		});

		const result = await simulateListLocations(data, { country: "US" });

		expect(result.locations).toHaveLength(1);
		expect(result.locations[0].name).toBe("US Store");
	});

	it("returns empty when no active locations", async () => {
		const result = await simulateListLocations(data);

		expect(result.locations).toHaveLength(0);
	});
});

describe("store endpoint: get location by slug", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns an active location", async () => {
		const ctrl = createStoreLocatorControllers(data);
		await ctrl.createLocation({
			name: "Flagship",
			slug: "flagship",
			address: "1 Commerce Blvd",
			city: "NYC",
			state: "NY",
			country: "US",
			latitude: 40.71,
			longitude: -74.0,
		});

		const result = await simulateGetLocation(data, "flagship");

		expect("location" in result).toBe(true);
		if ("location" in result) {
			expect(result.location.name).toBe("Flagship");
		}
	});

	it("returns 404 for inactive location", async () => {
		const ctrl = createStoreLocatorControllers(data);
		const closed = await ctrl.createLocation({
			name: "Closed",
			slug: "closed-store",
			address: "999 Gone Ave",
			city: "Nowhere",
			state: "TX",
			country: "US",
			latitude: 30.0,
			longitude: -97.0,
		});
		await ctrl.updateLocation(closed.id, { isActive: false });

		const result = await simulateGetLocation(data, "closed-store");

		expect(result).toEqual({ error: "Location not found", status: 404 });
	});

	it("returns 404 for nonexistent slug", async () => {
		const result = await simulateGetLocation(data, "ghost-store");

		expect(result).toEqual({ error: "Location not found", status: 404 });
	});
});

describe("store endpoint: search nearby", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("finds locations within radius", async () => {
		const ctrl = createStoreLocatorControllers(data);
		await ctrl.createLocation({
			name: "Near Store",
			slug: "near",
			address: "1 Close St",
			city: "Austin",
			state: "TX",
			country: "US",
			latitude: 30.267,
			longitude: -97.743,
		});

		const result = await simulateSearchNearby(data, {
			latitude: 30.27,
			longitude: -97.74,
			radius: 10,
			unit: "km",
		});

		expect(result.locations.length).toBeGreaterThanOrEqual(1);
	});
});

describe("store endpoint: list regions and countries", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns available countries", async () => {
		const ctrl = createStoreLocatorControllers(data);
		await ctrl.createLocation({
			name: "Store A",
			slug: "store-a",
			address: "1 St",
			city: "Austin",
			state: "TX",
			country: "US",
			latitude: 30.27,
			longitude: -97.74,
		});

		const result = await simulateListCountries(data);

		expect(result.countries).toContain("US");
	});

	it("returns available regions", async () => {
		const ctrl = createStoreLocatorControllers(data);
		await ctrl.createLocation({
			name: "Store B",
			slug: "store-b",
			address: "2 St",
			city: "Dallas",
			state: "TX",
			country: "US",
			region: "South",
			latitude: 32.78,
			longitude: -96.8,
		});

		const result = await simulateListRegions(data);

		expect(result.regions).toContain("South");
	});
});
