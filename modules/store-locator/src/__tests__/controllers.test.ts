import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createStoreLocatorControllers } from "../service-impl";

// ── Helpers ────────────────────────────────────────────────────────────────

type Controller = ReturnType<typeof createStoreLocatorControllers>;
type MockData = ReturnType<typeof createMockDataService>;

/** Helper to create a basic location with minimal required fields */
function locationParams(overrides: Record<string, unknown> = {}) {
	return {
		name: "Test Store",
		slug: "test-store",
		address: "123 Main St",
		city: "New York",
		country: "US",
		latitude: 40.7128,
		longitude: -74.006,
		...overrides,
	};
}

/** Well-known coordinates for testing distances */
const NYC = { latitude: 40.7128, longitude: -74.006 };
const BROOKLYN = { latitude: 40.6782, longitude: -73.9442 };
const LA = { latitude: 34.0522, longitude: -118.2437 };
const CHICAGO = { latitude: 41.8781, longitude: -87.6298 };
const LONDON = { latitude: 51.5074, longitude: -0.1278 };

const DAY_NAMES = [
	"sunday",
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
] as const;

describe("store-locator controllers", () => {
	let mockData: MockData;
	let ctrl: Controller;

	beforeEach(() => {
		mockData = createMockDataService();
		ctrl = createStoreLocatorControllers(mockData);
	});

	// ── createLocation ────────────────────────────────────────────────────

	describe("createLocation", () => {
		it("creates a location with all required fields", async () => {
			const loc = await ctrl.createLocation(locationParams());

			expect(loc.id).toBeDefined();
			expect(loc.name).toBe("Test Store");
			expect(loc.slug).toBe("test-store");
			expect(loc.address).toBe("123 Main St");
			expect(loc.city).toBe("New York");
			expect(loc.country).toBe("US");
			expect(loc.latitude).toBe(40.7128);
			expect(loc.longitude).toBe(-74.006);
		});

		it("sets default values for optional boolean fields", async () => {
			const loc = await ctrl.createLocation(locationParams());

			expect(loc.isActive).toBe(true);
			expect(loc.isFeatured).toBe(false);
			expect(loc.pickupEnabled).toBe(false);
		});

		it("sets empty defaults for hours, amenities, and metadata", async () => {
			const loc = await ctrl.createLocation(locationParams());

			expect(loc.hours).toEqual({});
			expect(loc.amenities).toEqual([]);
			expect(loc.metadata).toEqual({});
		});

		it("sets createdAt and updatedAt timestamps", async () => {
			const before = new Date();
			const loc = await ctrl.createLocation(locationParams());
			const after = new Date();

			expect(loc.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
			expect(loc.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
			expect(loc.updatedAt.getTime()).toBe(loc.createdAt.getTime());
		});

		it("creates a location with all optional fields", async () => {
			const hours = {
				monday: { open: "09:00", close: "17:00" },
				saturday: { open: "10:00", close: "14:00", closed: false },
				sunday: { open: "00:00", close: "00:00", closed: true },
			};

			const loc = await ctrl.createLocation(
				locationParams({
					description: "A great store",
					state: "NY",
					postalCode: "10001",
					phone: "+1-212-555-0100",
					email: "store@example.com",
					website: "https://store.example.com",
					imageUrl: "https://img.example.com/store.jpg",
					hours,
					amenities: ["wifi", "parking", "wheelchair"],
					region: "Northeast",
					isFeatured: true,
					pickupEnabled: true,
				}),
			);

			expect(loc.description).toBe("A great store");
			expect(loc.state).toBe("NY");
			expect(loc.postalCode).toBe("10001");
			expect(loc.phone).toBe("+1-212-555-0100");
			expect(loc.email).toBe("store@example.com");
			expect(loc.website).toBe("https://store.example.com");
			expect(loc.imageUrl).toBe("https://img.example.com/store.jpg");
			expect(loc.hours).toEqual(hours);
			expect(loc.amenities).toEqual(["wifi", "parking", "wheelchair"]);
			expect(loc.region).toBe("Northeast");
			expect(loc.isFeatured).toBe(true);
			expect(loc.pickupEnabled).toBe(true);
		});

		it("generates unique IDs for each location", async () => {
			const loc1 = await ctrl.createLocation(
				locationParams({ name: "Store A", slug: "store-a" }),
			);
			const loc2 = await ctrl.createLocation(
				locationParams({ name: "Store B", slug: "store-b" }),
			);

			expect(loc1.id).not.toBe(loc2.id);
		});

		it("persists the location in the data store", async () => {
			const loc = await ctrl.createLocation(locationParams());
			expect(mockData.size("location")).toBe(1);

			const stored = await mockData.get("location", loc.id);
			expect(stored).not.toBeNull();
			expect(stored?.name).toBe("Test Store");
		});
	});

	// ── getLocation ───────────────────────────────────────────────────────

	describe("getLocation", () => {
		it("retrieves an existing location by ID", async () => {
			const created = await ctrl.createLocation(locationParams());
			const fetched = await ctrl.getLocation(created.id);

			expect(fetched).not.toBeNull();
			expect(fetched?.id).toBe(created.id);
			expect(fetched?.name).toBe("Test Store");
		});

		it("returns null for a non-existent ID", async () => {
			const result = await ctrl.getLocation("non-existent-id");
			expect(result).toBeNull();
		});
	});

	// ── getLocationBySlug ─────────────────────────────────────────────────

	describe("getLocationBySlug", () => {
		it("retrieves a location by slug", async () => {
			await ctrl.createLocation(
				locationParams({ name: "Downtown", slug: "downtown" }),
			);

			const fetched = await ctrl.getLocationBySlug("downtown");
			expect(fetched).not.toBeNull();
			expect(fetched?.slug).toBe("downtown");
			expect(fetched?.name).toBe("Downtown");
		});

		it("returns null for a non-existent slug", async () => {
			const result = await ctrl.getLocationBySlug("does-not-exist");
			expect(result).toBeNull();
		});
	});

	// ── listLocations ─────────────────────────────────────────────────────

	describe("listLocations", () => {
		it("returns all locations sorted by name", async () => {
			await ctrl.createLocation(
				locationParams({ name: "Zebra Store", slug: "zebra" }),
			);
			await ctrl.createLocation(
				locationParams({ name: "Alpha Store", slug: "alpha" }),
			);
			await ctrl.createLocation(
				locationParams({ name: "Middle Store", slug: "middle" }),
			);

			const list = await ctrl.listLocations();
			expect(list).toHaveLength(3);
			expect(list[0]?.name).toBe("Alpha Store");
			expect(list[1]?.name).toBe("Middle Store");
			expect(list[2]?.name).toBe("Zebra Store");
		});

		it("returns empty array when no locations exist", async () => {
			const list = await ctrl.listLocations();
			expect(list).toEqual([]);
		});

		it("filters by activeOnly", async () => {
			await ctrl.createLocation(
				locationParams({ name: "Active", slug: "active" }),
			);
			const inactive = await ctrl.createLocation(
				locationParams({ name: "Inactive", slug: "inactive" }),
			);
			await ctrl.updateLocation(inactive.id, { isActive: false });

			const active = await ctrl.listLocations({ activeOnly: true });
			expect(active).toHaveLength(1);
			expect(active[0]?.name).toBe("Active");
		});

		it("filters by country", async () => {
			await ctrl.createLocation(
				locationParams({
					name: "US Store",
					slug: "us",
					country: "US",
				}),
			);
			await ctrl.createLocation(
				locationParams({
					name: "UK Store",
					slug: "uk",
					country: "UK",
				}),
			);
			await ctrl.createLocation(
				locationParams({
					name: "US Store 2",
					slug: "us2",
					country: "US",
				}),
			);

			const usStores = await ctrl.listLocations({ country: "US" });
			expect(usStores).toHaveLength(2);
			expect(usStores.every((l) => l.country === "US")).toBe(true);
		});

		it("filters by region", async () => {
			await ctrl.createLocation(
				locationParams({
					name: "NE Store",
					slug: "ne",
					region: "Northeast",
				}),
			);
			await ctrl.createLocation(
				locationParams({
					name: "SW Store",
					slug: "sw",
					region: "Southwest",
				}),
			);

			const neStores = await ctrl.listLocations({ region: "Northeast" });
			expect(neStores).toHaveLength(1);
			expect(neStores[0]?.region).toBe("Northeast");
		});

		it("filters by city", async () => {
			await ctrl.createLocation(
				locationParams({
					name: "NYC Store",
					slug: "nyc",
					city: "New York",
				}),
			);
			await ctrl.createLocation(
				locationParams({
					name: "LA Store",
					slug: "la",
					city: "Los Angeles",
				}),
			);

			const nycStores = await ctrl.listLocations({ city: "New York" });
			expect(nycStores).toHaveLength(1);
			expect(nycStores[0]?.city).toBe("New York");
		});

		it("filters by pickupOnly", async () => {
			await ctrl.createLocation(
				locationParams({
					name: "Pickup Store",
					slug: "pickup",
					pickupEnabled: true,
				}),
			);
			await ctrl.createLocation(
				locationParams({
					name: "No Pickup",
					slug: "no-pickup",
				}),
			);

			const pickupStores = await ctrl.listLocations({ pickupOnly: true });
			expect(pickupStores).toHaveLength(1);
			expect(pickupStores[0]?.pickupEnabled).toBe(true);
		});

		it("filters by featuredOnly", async () => {
			await ctrl.createLocation(
				locationParams({
					name: "Featured",
					slug: "featured",
					isFeatured: true,
				}),
			);
			await ctrl.createLocation(
				locationParams({ name: "Normal", slug: "normal" }),
			);

			const featured = await ctrl.listLocations({ featuredOnly: true });
			expect(featured).toHaveLength(1);
			expect(featured[0]?.isFeatured).toBe(true);
		});

		it("combines multiple filters", async () => {
			await ctrl.createLocation(
				locationParams({
					name: "Match",
					slug: "match",
					country: "US",
					pickupEnabled: true,
				}),
			);
			await ctrl.createLocation(
				locationParams({
					name: "No Pickup",
					slug: "no-pickup",
					country: "US",
				}),
			);
			await ctrl.createLocation(
				locationParams({
					name: "UK Pickup",
					slug: "uk-pickup",
					country: "UK",
					pickupEnabled: true,
				}),
			);

			const result = await ctrl.listLocations({
				country: "US",
				pickupOnly: true,
			});
			expect(result).toHaveLength(1);
			expect(result[0]?.name).toBe("Match");
		});

		it("supports limit and offset pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await ctrl.createLocation(
					locationParams({
						name: `Store ${String(i).padStart(2, "0")}`,
						slug: `store-${i}`,
					}),
				);
			}

			const page1 = await ctrl.listLocations({ limit: 2 });
			expect(page1).toHaveLength(2);

			const page2 = await ctrl.listLocations({ limit: 2, offset: 2 });
			expect(page2).toHaveLength(2);

			const page3 = await ctrl.listLocations({ limit: 2, offset: 4 });
			expect(page3).toHaveLength(1);
		});
	});

	// ── updateLocation ────────────────────────────────────────────────────

	describe("updateLocation", () => {
		it("updates a single field", async () => {
			const loc = await ctrl.createLocation(locationParams());
			const updated = await ctrl.updateLocation(loc.id, {
				name: "Updated Name",
			});

			expect(updated.name).toBe("Updated Name");
			expect(updated.slug).toBe("test-store"); // unchanged
		});

		it("updates multiple fields at once", async () => {
			const loc = await ctrl.createLocation(locationParams());
			const updated = await ctrl.updateLocation(loc.id, {
				name: "New Name",
				city: "Boston",
				state: "MA",
				isActive: false,
				isFeatured: true,
				pickupEnabled: true,
			});

			expect(updated.name).toBe("New Name");
			expect(updated.city).toBe("Boston");
			expect(updated.state).toBe("MA");
			expect(updated.isActive).toBe(false);
			expect(updated.isFeatured).toBe(true);
			expect(updated.pickupEnabled).toBe(true);
		});

		it("updates the updatedAt timestamp", async () => {
			const loc = await ctrl.createLocation(locationParams());
			const originalUpdatedAt = loc.updatedAt;

			// Small delay to ensure timestamp difference
			await new Promise((resolve) => {
				setTimeout(resolve, 5);
			});

			const updated = await ctrl.updateLocation(loc.id, {
				name: "Updated",
			});
			expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
				originalUpdatedAt.getTime(),
			);
		});

		it("preserves unchanged fields", async () => {
			const loc = await ctrl.createLocation(
				locationParams({
					description: "Original description",
					phone: "+1-555-1234",
					amenities: ["wifi"],
				}),
			);

			const updated = await ctrl.updateLocation(loc.id, {
				name: "New Name",
			});

			expect(updated.description).toBe("Original description");
			expect(updated.phone).toBe("+1-555-1234");
			expect(updated.amenities).toEqual(["wifi"]);
		});

		it("throws an error when location is not found", async () => {
			await expect(
				ctrl.updateLocation("non-existent-id", { name: "Updated" }),
			).rejects.toThrow("Location non-existent-id not found");
		});

		it("updates hours", async () => {
			const loc = await ctrl.createLocation(locationParams());
			const newHours = {
				monday: { open: "08:00", close: "20:00" },
				tuesday: { open: "08:00", close: "20:00" },
			};

			const updated = await ctrl.updateLocation(loc.id, {
				hours: newHours,
			});
			expect(updated.hours).toEqual(newHours);
		});

		it("updates amenities", async () => {
			const loc = await ctrl.createLocation(
				locationParams({ amenities: ["wifi"] }),
			);
			const updated = await ctrl.updateLocation(loc.id, {
				amenities: ["wifi", "parking", "atm"],
			});

			expect(updated.amenities).toEqual(["wifi", "parking", "atm"]);
		});

		it("updates coordinates", async () => {
			const loc = await ctrl.createLocation(locationParams());
			const updated = await ctrl.updateLocation(loc.id, {
				latitude: 34.0522,
				longitude: -118.2437,
			});

			expect(updated.latitude).toBe(34.0522);
			expect(updated.longitude).toBe(-118.2437);
		});

		it("persists the update in the data store", async () => {
			const loc = await ctrl.createLocation(locationParams());
			await ctrl.updateLocation(loc.id, { name: "Persisted Name" });

			const stored = await ctrl.getLocation(loc.id);
			expect(stored?.name).toBe("Persisted Name");
		});
	});

	// ── deleteLocation ────────────────────────────────────────────────────

	describe("deleteLocation", () => {
		it("deletes an existing location", async () => {
			const loc = await ctrl.createLocation(locationParams());
			expect(mockData.size("location")).toBe(1);

			await ctrl.deleteLocation(loc.id);
			expect(mockData.size("location")).toBe(0);
		});

		it("location is no longer retrievable after deletion", async () => {
			const loc = await ctrl.createLocation(locationParams());
			await ctrl.deleteLocation(loc.id);

			const result = await ctrl.getLocation(loc.id);
			expect(result).toBeNull();
		});

		it("does not affect other locations", async () => {
			const loc1 = await ctrl.createLocation(
				locationParams({ name: "Keep", slug: "keep" }),
			);
			const loc2 = await ctrl.createLocation(
				locationParams({ name: "Delete", slug: "delete" }),
			);

			await ctrl.deleteLocation(loc2.id);

			expect(mockData.size("location")).toBe(1);
			const kept = await ctrl.getLocation(loc1.id);
			expect(kept?.name).toBe("Keep");
		});
	});

	// ── searchNearby ──────────────────────────────────────────────────────

	describe("searchNearby", () => {
		async function seedNearbyLocations() {
			await ctrl.createLocation(
				locationParams({
					name: "Manhattan Store",
					slug: "manhattan",
					city: "New York",
					country: "US",
					...NYC,
				}),
			);
			await ctrl.createLocation(
				locationParams({
					name: "Brooklyn Store",
					slug: "brooklyn",
					city: "Brooklyn",
					country: "US",
					...BROOKLYN,
				}),
			);
			await ctrl.createLocation(
				locationParams({
					name: "LA Store",
					slug: "la",
					city: "Los Angeles",
					country: "US",
					...LA,
				}),
			);
			await ctrl.createLocation(
				locationParams({
					name: "Chicago Store",
					slug: "chicago",
					city: "Chicago",
					country: "US",
					...CHICAGO,
				}),
			);
			await ctrl.createLocation(
				locationParams({
					name: "London Store",
					slug: "london",
					city: "London",
					country: "UK",
					...LONDON,
				}),
			);
		}

		it("returns locations within default 50km radius sorted by distance", async () => {
			await seedNearbyLocations();

			const results = await ctrl.searchNearby({
				latitude: NYC.latitude,
				longitude: NYC.longitude,
			});

			// Manhattan should be at distance ~0, Brooklyn ~8km
			// LA, Chicago, London are all > 50km away
			expect(results.length).toBeGreaterThanOrEqual(1);
			expect(results.length).toBeLessThanOrEqual(2);

			// First result should be the closest (Manhattan)
			expect(results[0]?.name).toBe("Manhattan Store");
			expect(results[0]?.distance).toBe(0);
			expect(results[0]?.unit).toBe("km");
		});

		it("includes Brooklyn in 50km radius of Manhattan", async () => {
			await seedNearbyLocations();

			const results = await ctrl.searchNearby({
				latitude: NYC.latitude,
				longitude: NYC.longitude,
				radiusKm: 50,
			});

			const names = results.map((r) => r.name);
			expect(names).toContain("Manhattan Store");
			expect(names).toContain("Brooklyn Store");
			expect(names).not.toContain("LA Store");
		});

		it("returns results sorted by distance (ascending)", async () => {
			await seedNearbyLocations();

			const results = await ctrl.searchNearby({
				latitude: NYC.latitude,
				longitude: NYC.longitude,
				radiusKm: 10000, // large radius to include all
			});

			for (let i = 1; i < results.length; i++) {
				const prev = results[i - 1]?.distance ?? 0;
				const curr = results[i]?.distance ?? 0;
				expect(curr).toBeGreaterThanOrEqual(prev);
			}
		});

		it("calculates distances in kilometers by default", async () => {
			await seedNearbyLocations();

			const results = await ctrl.searchNearby({
				latitude: NYC.latitude,
				longitude: NYC.longitude,
				radiusKm: 10000,
			});

			for (const r of results) {
				expect(r.unit).toBe("km");
			}

			// Brooklyn is roughly 8-10 km from Manhattan
			const brooklyn = results.find((r) => r.name === "Brooklyn Store");
			expect(brooklyn).toBeDefined();
			expect(brooklyn?.distance).toBeGreaterThan(5);
			expect(brooklyn?.distance).toBeLessThan(15);
		});

		it("converts distances to miles when unit is 'mi'", async () => {
			await seedNearbyLocations();

			const kmResults = await ctrl.searchNearby({
				latitude: NYC.latitude,
				longitude: NYC.longitude,
				radiusKm: 10000,
				unit: "km",
			});

			const miResults = await ctrl.searchNearby({
				latitude: NYC.latitude,
				longitude: NYC.longitude,
				radiusKm: 10000,
				unit: "mi",
			});

			for (const r of miResults) {
				expect(r.unit).toBe("mi");
			}

			// Find Brooklyn in both results
			const brooklynKm = kmResults.find((r) => r.name === "Brooklyn Store");
			const brooklynMi = miResults.find((r) => r.name === "Brooklyn Store");

			expect(brooklynKm).toBeDefined();
			expect(brooklynMi).toBeDefined();

			// Miles should be less than km (1 km = 0.621371 mi)
			if (brooklynKm && brooklynMi) {
				expect(brooklynMi.distance).toBeLessThan(brooklynKm.distance);
				// Check the conversion factor is approximately correct
				const ratio = brooklynMi.distance / brooklynKm.distance;
				expect(ratio).toBeCloseTo(0.621371, 2);
			}
		});

		it("filters radius in miles when unit is 'mi'", async () => {
			await seedNearbyLocations();

			// Set a radius that in km would include Brooklyn but in mi (converted) would too
			// Brooklyn is ~8km from Manhattan. 8km * 0.621371 = ~5mi
			// Use a radius of 4 (as radiusKm) which becomes 4 * 0.621371 = ~2.5 mi
			const results = await ctrl.searchNearby({
				latitude: NYC.latitude,
				longitude: NYC.longitude,
				radiusKm: 4,
				unit: "mi",
			});

			// Only Manhattan store should be in range (distance 0)
			// Brooklyn at ~5mi would be outside 2.5mi radius
			expect(results.some((r) => r.name === "Manhattan Store")).toBe(true);
			expect(results.some((r) => r.name === "Brooklyn Store")).toBe(false);
		});

		it("respects the limit parameter", async () => {
			await seedNearbyLocations();

			const results = await ctrl.searchNearby({
				latitude: NYC.latitude,
				longitude: NYC.longitude,
				radiusKm: 10000,
				limit: 2,
			});

			expect(results).toHaveLength(2);
		});

		it("default limit is 20", async () => {
			// Create 25 locations all at the same point
			for (let i = 0; i < 25; i++) {
				await ctrl.createLocation(
					locationParams({
						name: `Store ${i}`,
						slug: `store-${i}`,
					}),
				);
			}

			const results = await ctrl.searchNearby({
				latitude: NYC.latitude,
				longitude: NYC.longitude,
				radiusKm: 50,
			});

			expect(results).toHaveLength(20);
		});

		it("filters by activeOnly (default true)", async () => {
			await ctrl.createLocation(
				locationParams({ name: "Active", slug: "active" }),
			);
			const inactive = await ctrl.createLocation(
				locationParams({ name: "Inactive", slug: "inactive" }),
			);
			await ctrl.updateLocation(inactive.id, { isActive: false });

			const results = await ctrl.searchNearby({
				latitude: NYC.latitude,
				longitude: NYC.longitude,
				radiusKm: 50,
			});

			expect(results).toHaveLength(1);
			expect(results[0]?.name).toBe("Active");

			// With activeOnly: false, both should appear
			const allResults = await ctrl.searchNearby({
				latitude: NYC.latitude,
				longitude: NYC.longitude,
				radiusKm: 50,
				activeOnly: false,
			});

			expect(allResults).toHaveLength(2);
		});

		it("filters by pickupOnly", async () => {
			await ctrl.createLocation(
				locationParams({
					name: "Pickup",
					slug: "pickup",
					pickupEnabled: true,
				}),
			);
			await ctrl.createLocation(
				locationParams({ name: "No Pickup", slug: "no-pickup" }),
			);

			const results = await ctrl.searchNearby({
				latitude: NYC.latitude,
				longitude: NYC.longitude,
				radiusKm: 50,
				pickupOnly: true,
			});

			expect(results).toHaveLength(1);
			expect(results[0]?.name).toBe("Pickup");
		});

		it("rounds distance to 2 decimal places", async () => {
			await ctrl.createLocation(
				locationParams({
					name: "Nearby",
					slug: "nearby",
					...BROOKLYN,
				}),
			);

			const results = await ctrl.searchNearby({
				latitude: NYC.latitude,
				longitude: NYC.longitude,
				radiusKm: 50,
			});

			const nearby = results.find((r) => r.name === "Nearby");
			expect(nearby).toBeDefined();
			if (nearby) {
				const decimalPart = String(nearby.distance).split(".")[1] ?? "";
				expect(decimalPart.length).toBeLessThanOrEqual(2);
			}
		});

		it("returns empty array when no locations are within radius", async () => {
			await ctrl.createLocation(
				locationParams({
					name: "Far Away",
					slug: "far",
					...LA,
				}),
			);

			const results = await ctrl.searchNearby({
				latitude: NYC.latitude,
				longitude: NYC.longitude,
				radiusKm: 10,
			});

			expect(results).toEqual([]);
		});

		it("Haversine formula produces reasonable distances for known city pairs", async () => {
			await ctrl.createLocation(
				locationParams({
					name: "LA Store",
					slug: "la",
					...LA,
				}),
			);

			const results = await ctrl.searchNearby({
				latitude: NYC.latitude,
				longitude: NYC.longitude,
				radiusKm: 5000,
				activeOnly: false,
			});

			const laResult = results.find((r) => r.name === "LA Store");
			expect(laResult).toBeDefined();

			// NYC to LA is approximately 3,944 km
			if (laResult) {
				expect(laResult.distance).toBeGreaterThan(3800);
				expect(laResult.distance).toBeLessThan(4100);
			}
		});
	});

	// ── listRegions ───────────────────────────────────────────────────────

	describe("listRegions", () => {
		it("returns unique regions from active locations sorted alphabetically", async () => {
			await ctrl.createLocation(
				locationParams({
					name: "NE1",
					slug: "ne1",
					region: "Northeast",
				}),
			);
			await ctrl.createLocation(
				locationParams({
					name: "NE2",
					slug: "ne2",
					region: "Northeast",
				}),
			);
			await ctrl.createLocation(
				locationParams({
					name: "SW1",
					slug: "sw1",
					region: "Southwest",
				}),
			);
			await ctrl.createLocation(
				locationParams({
					name: "MW1",
					slug: "mw1",
					region: "Midwest",
				}),
			);

			const regions = await ctrl.listRegions();
			expect(regions).toEqual(["Midwest", "Northeast", "Southwest"]);
		});

		it("excludes regions from inactive locations", async () => {
			await ctrl.createLocation(
				locationParams({
					name: "Active",
					slug: "active",
					region: "Active Region",
				}),
			);
			const inactive = await ctrl.createLocation(
				locationParams({
					name: "Inactive",
					slug: "inactive",
					region: "Inactive Region",
				}),
			);
			await ctrl.updateLocation(inactive.id, { isActive: false });

			const regions = await ctrl.listRegions();
			expect(regions).toEqual(["Active Region"]);
		});

		it("excludes locations without a region", async () => {
			await ctrl.createLocation(
				locationParams({
					name: "With Region",
					slug: "with",
					region: "East",
				}),
			);
			await ctrl.createLocation(
				locationParams({ name: "No Region", slug: "no" }),
			);

			const regions = await ctrl.listRegions();
			expect(regions).toEqual(["East"]);
		});

		it("returns empty array when no active locations have regions", async () => {
			await ctrl.createLocation(
				locationParams({ name: "No Region", slug: "no" }),
			);

			const regions = await ctrl.listRegions();
			expect(regions).toEqual([]);
		});
	});

	// ── listCountries ─────────────────────────────────────────────────────

	describe("listCountries", () => {
		it("returns unique countries from active locations sorted", async () => {
			await ctrl.createLocation(
				locationParams({
					name: "US1",
					slug: "us1",
					country: "US",
				}),
			);
			await ctrl.createLocation(
				locationParams({
					name: "UK1",
					slug: "uk1",
					country: "UK",
				}),
			);
			await ctrl.createLocation(
				locationParams({
					name: "CA1",
					slug: "ca1",
					country: "CA",
				}),
			);
			await ctrl.createLocation(
				locationParams({
					name: "US2",
					slug: "us2",
					country: "US",
				}),
			);

			const countries = await ctrl.listCountries();
			expect(countries).toEqual(["CA", "UK", "US"]);
		});

		it("excludes inactive locations", async () => {
			await ctrl.createLocation(
				locationParams({
					name: "Active",
					slug: "active",
					country: "US",
				}),
			);
			const inactive = await ctrl.createLocation(
				locationParams({
					name: "Inactive",
					slug: "inactive",
					country: "FR",
				}),
			);
			await ctrl.updateLocation(inactive.id, { isActive: false });

			const countries = await ctrl.listCountries();
			expect(countries).toEqual(["US"]);
		});

		it("returns empty array when no active locations exist", async () => {
			const countries = await ctrl.listCountries();
			expect(countries).toEqual([]);
		});
	});

	// ── listCities ────────────────────────────────────────────────────────

	describe("listCities", () => {
		it("returns unique cities for a country sorted", async () => {
			await ctrl.createLocation(
				locationParams({
					name: "NYC1",
					slug: "nyc1",
					city: "New York",
					country: "US",
				}),
			);
			await ctrl.createLocation(
				locationParams({
					name: "NYC2",
					slug: "nyc2",
					city: "New York",
					country: "US",
				}),
			);
			await ctrl.createLocation(
				locationParams({
					name: "LA1",
					slug: "la1",
					city: "Los Angeles",
					country: "US",
				}),
			);
			await ctrl.createLocation(
				locationParams({
					name: "CHI1",
					slug: "chi1",
					city: "Chicago",
					country: "US",
				}),
			);

			const cities = await ctrl.listCities("US");
			expect(cities).toEqual(["Chicago", "Los Angeles", "New York"]);
		});

		it("only returns cities from the specified country", async () => {
			await ctrl.createLocation(
				locationParams({
					name: "NYC",
					slug: "nyc",
					city: "New York",
					country: "US",
				}),
			);
			await ctrl.createLocation(
				locationParams({
					name: "London",
					slug: "london",
					city: "London",
					country: "UK",
				}),
			);

			const usCities = await ctrl.listCities("US");
			expect(usCities).toEqual(["New York"]);

			const ukCities = await ctrl.listCities("UK");
			expect(ukCities).toEqual(["London"]);
		});

		it("excludes inactive locations", async () => {
			await ctrl.createLocation(
				locationParams({
					name: "Active NYC",
					slug: "active-nyc",
					city: "New York",
					country: "US",
				}),
			);
			const inactive = await ctrl.createLocation(
				locationParams({
					name: "Inactive Boston",
					slug: "inactive-boston",
					city: "Boston",
					country: "US",
				}),
			);
			await ctrl.updateLocation(inactive.id, { isActive: false });

			const cities = await ctrl.listCities("US");
			expect(cities).toEqual(["New York"]);
		});

		it("returns empty array for a country with no locations", async () => {
			const cities = await ctrl.listCities("JP");
			expect(cities).toEqual([]);
		});
	});

	// ── isOpen ─────────────────────────────────────────────────────────────

	describe("isOpen", () => {
		it("throws an error when location is not found", async () => {
			await expect(ctrl.isOpen("non-existent-id")).rejects.toThrow(
				"Location non-existent-id not found",
			);
		});

		it("returns the correct currentDay name matching DAY_NAMES", async () => {
			const loc = await ctrl.createLocation(locationParams());
			const result = await ctrl.isOpen(loc.id);

			const expectedDay = DAY_NAMES[new Date().getDay()];
			expect(result.currentDay).toBe(expectedDay);
		});

		it("returns open: false when no hours are set", async () => {
			const loc = await ctrl.createLocation(locationParams());
			const result = await ctrl.isOpen(loc.id);

			expect(result.open).toBe(false);
			expect(result.hours).toBeNull();
		});

		it("returns open: false when the current day is marked closed", async () => {
			const currentDay = DAY_NAMES[new Date().getDay()];
			const hours = {
				[currentDay]: { open: "09:00", close: "17:00", closed: true },
			};

			const loc = await ctrl.createLocation(locationParams({ hours }));
			const result = await ctrl.isOpen(loc.id);

			expect(result.open).toBe(false);
			expect(result.hours).toEqual({
				open: "09:00",
				close: "17:00",
				closed: true,
			});
		});

		it("returns a valid response structure with hours when hours are set", async () => {
			const currentDay = DAY_NAMES[new Date().getDay()];
			const hours = {
				[currentDay]: { open: "00:00", close: "23:59" },
			};

			const loc = await ctrl.createLocation(locationParams({ hours }));
			const result = await ctrl.isOpen(loc.id);

			// With 00:00-23:59, it should be open at any time of day
			expect(result.open).toBe(true);
			expect(result.currentDay).toBe(currentDay);
			expect(result.hours).toEqual({ open: "00:00", close: "23:59" });
		});

		it("returns result with proper structure", async () => {
			const loc = await ctrl.createLocation(locationParams());
			const result = await ctrl.isOpen(loc.id);

			expect(result).toHaveProperty("open");
			expect(result).toHaveProperty("currentDay");
			expect(result).toHaveProperty("hours");
			expect(typeof result.open).toBe("boolean");
			expect(typeof result.currentDay).toBe("string");
		});

		it("returns open: false when current day has no hours entry", async () => {
			// Set hours only for a day that is not today
			const todayIndex = new Date().getDay();
			const otherDayIndex = (todayIndex + 1) % 7;
			const otherDay = DAY_NAMES[otherDayIndex];

			const hours = {
				[otherDay]: { open: "09:00", close: "17:00" },
			};

			const loc = await ctrl.createLocation(locationParams({ hours }));
			const result = await ctrl.isOpen(loc.id);

			expect(result.open).toBe(false);
			expect(result.hours).toBeNull();
		});
	});

	// ── getStats ──────────────────────────────────────────────────────────

	describe("getStats", () => {
		it("returns zeros when no locations exist", async () => {
			const stats = await ctrl.getStats();

			expect(stats).toEqual({
				totalLocations: 0,
				activeLocations: 0,
				pickupLocations: 0,
				featuredLocations: 0,
				countries: 0,
				regions: 0,
			});
		});

		it("counts total and active locations correctly", async () => {
			await ctrl.createLocation(
				locationParams({ name: "Active 1", slug: "a1" }),
			);
			await ctrl.createLocation(
				locationParams({ name: "Active 2", slug: "a2" }),
			);
			const inactive = await ctrl.createLocation(
				locationParams({ name: "Inactive", slug: "i1" }),
			);
			await ctrl.updateLocation(inactive.id, { isActive: false });

			const stats = await ctrl.getStats();
			expect(stats.totalLocations).toBe(3);
			expect(stats.activeLocations).toBe(2);
		});

		it("counts pickup and featured locations correctly", async () => {
			await ctrl.createLocation(
				locationParams({
					name: "Pickup Featured",
					slug: "pf",
					pickupEnabled: true,
					isFeatured: true,
				}),
			);
			await ctrl.createLocation(
				locationParams({
					name: "Pickup Only",
					slug: "po",
					pickupEnabled: true,
				}),
			);
			await ctrl.createLocation(
				locationParams({
					name: "Featured Only",
					slug: "fo",
					isFeatured: true,
				}),
			);
			await ctrl.createLocation(locationParams({ name: "Plain", slug: "p" }));

			const stats = await ctrl.getStats();
			expect(stats.pickupLocations).toBe(2);
			expect(stats.featuredLocations).toBe(2);
		});

		it("counts unique countries and regions", async () => {
			await ctrl.createLocation(
				locationParams({
					name: "US NE",
					slug: "us-ne",
					country: "US",
					region: "Northeast",
				}),
			);
			await ctrl.createLocation(
				locationParams({
					name: "US SW",
					slug: "us-sw",
					country: "US",
					region: "Southwest",
				}),
			);
			await ctrl.createLocation(
				locationParams({
					name: "UK SE",
					slug: "uk-se",
					country: "UK",
					region: "Southeast",
				}),
			);
			await ctrl.createLocation(
				locationParams({
					name: "No Region",
					slug: "nr",
					country: "CA",
				}),
			);

			const stats = await ctrl.getStats();
			expect(stats.countries).toBe(3); // US, UK, CA
			expect(stats.regions).toBe(3); // Northeast, Southwest, Southeast
		});

		it("stats include inactive locations in total counts", async () => {
			const loc = await ctrl.createLocation(
				locationParams({
					name: "Soon Inactive",
					slug: "si",
					country: "US",
					region: "West",
					pickupEnabled: true,
					isFeatured: true,
				}),
			);
			await ctrl.updateLocation(loc.id, { isActive: false });

			const stats = await ctrl.getStats();
			expect(stats.totalLocations).toBe(1);
			expect(stats.activeLocations).toBe(0);
			expect(stats.pickupLocations).toBe(1);
			expect(stats.featuredLocations).toBe(1);
			expect(stats.countries).toBe(1);
			expect(stats.regions).toBe(1);
		});
	});

	// ── Full lifecycle ────────────────────────────────────────────────────

	describe("full lifecycle", () => {
		it("create, update, search, check hours, and delete", async () => {
			// Create a location
			const loc = await ctrl.createLocation(
				locationParams({
					name: "Main Store",
					slug: "main-store",
					city: "New York",
					country: "US",
					region: "Northeast",
					...NYC,
					pickupEnabled: true,
					isFeatured: true,
					amenities: ["wifi", "parking"],
					hours: {
						monday: { open: "09:00", close: "21:00" },
						tuesday: { open: "09:00", close: "21:00" },
						wednesday: { open: "09:00", close: "21:00" },
						thursday: { open: "09:00", close: "21:00" },
						friday: { open: "09:00", close: "22:00" },
						saturday: { open: "10:00", close: "20:00" },
						sunday: { open: "00:00", close: "00:00", closed: true },
					},
				}),
			);

			// Verify retrieval
			const byId = await ctrl.getLocation(loc.id);
			expect(byId?.name).toBe("Main Store");

			const bySlug = await ctrl.getLocationBySlug("main-store");
			expect(bySlug?.id).toBe(loc.id);

			// Update the location
			const updated = await ctrl.updateLocation(loc.id, {
				name: "Main Store - Updated",
				amenities: ["wifi", "parking", "ev-charging"],
			});
			expect(updated.name).toBe("Main Store - Updated");
			expect(updated.amenities).toContain("ev-charging");

			// Nearby search
			const nearby = await ctrl.searchNearby({
				latitude: BROOKLYN.latitude,
				longitude: BROOKLYN.longitude,
				radiusKm: 20,
			});
			expect(nearby.length).toBeGreaterThanOrEqual(1);
			expect(nearby[0]?.name).toBe("Main Store - Updated");

			// Check stats
			const stats = await ctrl.getStats();
			expect(stats.totalLocations).toBe(1);
			expect(stats.activeLocations).toBe(1);
			expect(stats.pickupLocations).toBe(1);
			expect(stats.featuredLocations).toBe(1);

			// Check isOpen returns valid structure
			const openStatus = await ctrl.isOpen(loc.id);
			expect(openStatus).toHaveProperty("open");
			expect(openStatus).toHaveProperty("currentDay");

			// Check region and country lists
			const regions = await ctrl.listRegions();
			expect(regions).toContain("Northeast");

			const countries = await ctrl.listCountries();
			expect(countries).toContain("US");

			const cities = await ctrl.listCities("US");
			expect(cities).toContain("New York");

			// Delete
			await ctrl.deleteLocation(loc.id);
			expect(await ctrl.getLocation(loc.id)).toBeNull();

			const afterDelete = await ctrl.getStats();
			expect(afterDelete.totalLocations).toBe(0);
		});

		it("multiple locations across countries with filtering", async () => {
			await ctrl.createLocation(
				locationParams({
					name: "NYC Flagship",
					slug: "nyc-flagship",
					city: "New York",
					country: "US",
					region: "Northeast",
					...NYC,
					isFeatured: true,
					pickupEnabled: true,
				}),
			);
			await ctrl.createLocation(
				locationParams({
					name: "Brooklyn Outlet",
					slug: "brooklyn-outlet",
					city: "Brooklyn",
					country: "US",
					region: "Northeast",
					...BROOKLYN,
					pickupEnabled: true,
				}),
			);
			await ctrl.createLocation(
				locationParams({
					name: "LA Boutique",
					slug: "la-boutique",
					city: "Los Angeles",
					country: "US",
					region: "West",
					...LA,
					isFeatured: true,
				}),
			);
			await ctrl.createLocation(
				locationParams({
					name: "London Pop-up",
					slug: "london-popup",
					city: "London",
					country: "UK",
					region: "South",
					...LONDON,
				}),
			);

			// Filter by country
			const usStores = await ctrl.listLocations({ country: "US" });
			expect(usStores).toHaveLength(3);

			// Filter featured
			const featured = await ctrl.listLocations({ featuredOnly: true });
			expect(featured).toHaveLength(2);

			// Filter pickup
			const pickup = await ctrl.listLocations({ pickupOnly: true });
			expect(pickup).toHaveLength(2);

			// Region list
			const regions = await ctrl.listRegions();
			expect(regions).toEqual(["Northeast", "South", "West"]);

			// Country list
			const countries = await ctrl.listCountries();
			expect(countries).toEqual(["UK", "US"]);

			// Cities in US
			const usCities = await ctrl.listCities("US");
			expect(usCities).toEqual(["Brooklyn", "Los Angeles", "New York"]);

			// Nearby NYC search
			const nearNyc = await ctrl.searchNearby({
				latitude: NYC.latitude,
				longitude: NYC.longitude,
				radiusKm: 50,
			});
			expect(nearNyc).toHaveLength(2); // NYC + Brooklyn
			expect(nearNyc[0]?.name).toBe("NYC Flagship");
			expect(nearNyc[1]?.name).toBe("Brooklyn Outlet");

			// Stats
			const stats = await ctrl.getStats();
			expect(stats.totalLocations).toBe(4);
			expect(stats.activeLocations).toBe(4);
			expect(stats.countries).toBe(2);
			expect(stats.regions).toBe(3);
			expect(stats.pickupLocations).toBe(2);
			expect(stats.featuredLocations).toBe(2);
		});
	});
});
