import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createStoreLocatorControllers } from "../service-impl";

/**
 * Security regression tests for store-locator endpoints.
 *
 * Security focuses on:
 * - Inactive locations are filtered when activeOnly is set
 * - searchNearby uses Haversine distance and respects activeOnly
 * - listRegions/listCountries only include active locations
 * - deleteLocation is idempotent (no error for non-existent)
 * - updateLocation throws for non-existent IDs
 * - isOpen throws for non-existent IDs
 */

describe("store-locator endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createStoreLocatorControllers>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createStoreLocatorControllers(mockData);
	});

	const BASE_LOCATION = {
		name: "Main Store",
		slug: "main-store",
		address: "123 Main St",
		city: "Springfield",
		country: "US",
		latitude: 40.7128,
		longitude: -74.006,
	} as const;

	describe("activeOnly filtering", () => {
		it("listLocations with activeOnly excludes inactive locations", async () => {
			await controller.createLocation({
				...BASE_LOCATION,
				name: "Active Store",
				slug: "active-store",
			});

			const inactive = await controller.createLocation({
				...BASE_LOCATION,
				name: "Inactive Store",
				slug: "inactive-store",
			});
			await controller.updateLocation(inactive.id, { isActive: false });

			const all = await controller.listLocations();
			expect(all).toHaveLength(2);

			const activeOnly = await controller.listLocations({ activeOnly: true });
			expect(activeOnly).toHaveLength(1);
			expect(activeOnly[0].name).toBe("Active Store");
		});

		it("listLocations without activeOnly returns all locations", async () => {
			const loc = await controller.createLocation({
				...BASE_LOCATION,
				slug: "loc-1",
			});
			await controller.updateLocation(loc.id, { isActive: false });

			const all = await controller.listLocations();
			expect(all).toHaveLength(1);
			expect(all[0].isActive).toBe(false);
		});
	});

	describe("searchNearby security", () => {
		it("searchNearby excludes inactive locations by default", async () => {
			await controller.createLocation({
				...BASE_LOCATION,
				name: "Active Nearby",
				slug: "active-nearby",
				latitude: 40.7128,
				longitude: -74.006,
			});

			const inactiveLoc = await controller.createLocation({
				...BASE_LOCATION,
				name: "Inactive Nearby",
				slug: "inactive-nearby",
				latitude: 40.713,
				longitude: -74.007,
			});
			await controller.updateLocation(inactiveLoc.id, { isActive: false });

			const results = await controller.searchNearby({
				latitude: 40.7128,
				longitude: -74.006,
				radiusKm: 100,
			});

			expect(results.some((r) => r.name === "Inactive Nearby")).toBe(false);
			expect(results.some((r) => r.name === "Active Nearby")).toBe(true);
		});

		it("searchNearby with activeOnly=false includes inactive locations", async () => {
			const inactiveLoc = await controller.createLocation({
				...BASE_LOCATION,
				name: "Inactive Store",
				slug: "inactive-store-2",
				latitude: 40.7128,
				longitude: -74.006,
			});
			await controller.updateLocation(inactiveLoc.id, { isActive: false });

			const results = await controller.searchNearby({
				latitude: 40.7128,
				longitude: -74.006,
				radiusKm: 100,
				activeOnly: false,
			});

			expect(results.some((r) => r.name === "Inactive Store")).toBe(true);
		});

		it("searchNearby filters by distance using Haversine formula", async () => {
			// New York City approx coords
			await controller.createLocation({
				...BASE_LOCATION,
				name: "NYC Store",
				slug: "nyc-store",
				latitude: 40.7128,
				longitude: -74.006,
			});

			// Los Angeles approx coords (~4000 km away)
			await controller.createLocation({
				...BASE_LOCATION,
				name: "LA Store",
				slug: "la-store",
				latitude: 34.0522,
				longitude: -118.2437,
			});

			// Search from NYC with 100km radius — should only find NYC store
			const results = await controller.searchNearby({
				latitude: 40.7128,
				longitude: -74.006,
				radiusKm: 100,
				activeOnly: false,
			});

			expect(results).toHaveLength(1);
			expect(results[0].name).toBe("NYC Store");
		});

		it("searchNearby results include distance and unit fields", async () => {
			await controller.createLocation({
				...BASE_LOCATION,
				slug: "distance-store",
			});

			const results = await controller.searchNearby({
				latitude: 40.7128,
				longitude: -74.006,
				radiusKm: 100,
				unit: "mi",
				activeOnly: false,
			});

			expect(results).toHaveLength(1);
			expect(typeof results[0].distance).toBe("number");
			expect(results[0].unit).toBe("mi");
		});

		it("searchNearby sorts results by distance ascending", async () => {
			// Close store (same coords)
			await controller.createLocation({
				...BASE_LOCATION,
				name: "Close Store",
				slug: "close-store",
				latitude: 40.7128,
				longitude: -74.006,
			});

			// Farther store (~10km away)
			await controller.createLocation({
				...BASE_LOCATION,
				name: "Far Store",
				slug: "far-store",
				latitude: 40.8,
				longitude: -74.006,
			});

			const results = await controller.searchNearby({
				latitude: 40.7128,
				longitude: -74.006,
				radiusKm: 200,
				activeOnly: false,
			});

			expect(results[0].name).toBe("Close Store");
			expect(results[1].name).toBe("Far Store");
			expect(results[0].distance).toBeLessThan(results[1].distance);
		});
	});

	describe("listRegions and listCountries active-only scoping", () => {
		it("listRegions only returns regions from active locations", async () => {
			await controller.createLocation({
				...BASE_LOCATION,
				name: "Active Regional",
				slug: "active-regional",
				region: "Northeast",
			});

			const inactiveLoc = await controller.createLocation({
				...BASE_LOCATION,
				name: "Inactive Regional",
				slug: "inactive-regional",
				region: "Southwest",
			});
			await controller.updateLocation(inactiveLoc.id, { isActive: false });

			const regions = await controller.listRegions();
			expect(regions).toContain("Northeast");
			expect(regions).not.toContain("Southwest");
		});

		it("listRegions returns sorted unique values", async () => {
			await controller.createLocation({
				...BASE_LOCATION,
				slug: "region-z",
				region: "Zonal",
			});
			await controller.createLocation({
				...BASE_LOCATION,
				slug: "region-a",
				name: "Store 2",
				region: "Alpha",
			});
			await controller.createLocation({
				...BASE_LOCATION,
				slug: "region-a2",
				name: "Store 3",
				region: "Alpha",
			});

			const regions = await controller.listRegions();
			expect(regions).toEqual(["Alpha", "Zonal"]);
		});

		it("listCountries only returns countries from active locations", async () => {
			await controller.createLocation({
				...BASE_LOCATION,
				slug: "us-store",
				country: "US",
			});

			const inactiveLoc = await controller.createLocation({
				...BASE_LOCATION,
				slug: "ca-store",
				name: "CA Store",
				country: "CA",
			});
			await controller.updateLocation(inactiveLoc.id, { isActive: false });

			const countries = await controller.listCountries();
			expect(countries).toContain("US");
			expect(countries).not.toContain("CA");
		});

		it("listCountries returns sorted unique values", async () => {
			await controller.createLocation({
				...BASE_LOCATION,
				slug: "uk-store",
				country: "UK",
			});
			await controller.createLocation({
				...BASE_LOCATION,
				slug: "au-store",
				name: "AU Store",
				country: "AU",
			});

			const countries = await controller.listCountries();
			expect(countries).toEqual(["AU", "UK"]);
		});
	});

	describe("deleteLocation safety", () => {
		it("deleteLocation for non-existent ID does not throw", async () => {
			await expect(
				controller.deleteLocation("nonexistent-id"),
			).resolves.toBeUndefined();
		});

		it("deleteLocation removes the location", async () => {
			const loc = await controller.createLocation({
				...BASE_LOCATION,
				slug: "to-delete",
			});

			await controller.deleteLocation(loc.id);

			const retrieved = await controller.getLocation(loc.id);
			expect(retrieved).toBeNull();
		});
	});

	describe("updateLocation safety", () => {
		it("updateLocation throws for non-existent ID", async () => {
			await expect(
				controller.updateLocation("nonexistent-id", { name: "New Name" }),
			).rejects.toThrow("not found");
		});

		it("updateLocation preserves unmodified fields", async () => {
			const loc = await controller.createLocation({
				...BASE_LOCATION,
				slug: "preserve-test",
				region: "West",
			});

			const updated = await controller.updateLocation(loc.id, {
				name: "Updated Name",
			});

			expect(updated.name).toBe("Updated Name");
			expect(updated.region).toBe("West");
			expect(updated.country).toBe("US");
		});

		it("updateLocation can deactivate a location", async () => {
			const loc = await controller.createLocation({
				...BASE_LOCATION,
				slug: "deactivate-test",
			});
			expect(loc.isActive).toBe(true);

			const updated = await controller.updateLocation(loc.id, {
				isActive: false,
			});
			expect(updated.isActive).toBe(false);
		});
	});

	describe("getStats accuracy", () => {
		it("getStats counts active and inactive locations separately", async () => {
			await controller.createLocation({
				...BASE_LOCATION,
				slug: "stats-active",
			});
			const inactive = await controller.createLocation({
				...BASE_LOCATION,
				slug: "stats-inactive",
				name: "Inactive",
			});
			await controller.updateLocation(inactive.id, { isActive: false });

			const stats = await controller.getStats();
			expect(stats.totalLocations).toBe(2);
			expect(stats.activeLocations).toBe(1);
		});

		it("getStats counts pickup-enabled locations", async () => {
			await controller.createLocation({
				...BASE_LOCATION,
				slug: "pickup-loc",
				pickupEnabled: true,
			});
			await controller.createLocation({
				...BASE_LOCATION,
				slug: "no-pickup-loc",
				name: "No Pickup",
			});

			const stats = await controller.getStats();
			expect(stats.pickupLocations).toBe(1);
		});
	});

	describe("isOpen safety", () => {
		it("isOpen throws for non-existent location", async () => {
			await expect(controller.isOpen("nonexistent-id")).rejects.toThrow(
				"not found",
			);
		});

		it("isOpen returns closed for location with no hours", async () => {
			const loc = await controller.createLocation({
				...BASE_LOCATION,
				slug: "no-hours",
			});

			const result = await controller.isOpen(loc.id);
			expect(result.open).toBe(false);
		});
	});

	describe("getLocationBySlug", () => {
		it("returns null for unknown slug", async () => {
			const result = await controller.getLocationBySlug("nonexistent-slug");
			expect(result).toBeNull();
		});

		it("returns the correct location by slug", async () => {
			await controller.createLocation({
				...BASE_LOCATION,
				slug: "find-by-slug",
				name: "Slug Store",
			});

			const result = await controller.getLocationBySlug("find-by-slug");
			expect(result).not.toBeNull();
			expect(result?.name).toBe("Slug Store");
		});
	});
});
