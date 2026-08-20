import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createStoreLocatorControllers } from "../service-impl";

describe("createStoreLocatorControllers", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createStoreLocatorControllers>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createStoreLocatorControllers(mockData);
	});

	// --- Helper ---

	function createTestLocation(overrides = {}) {
		return {
			name: "Downtown Store",
			slug: "downtown-store",
			address: "123 Main St",
			city: "Portland",
			state: "OR",
			postalCode: "97201",
			country: "US",
			latitude: 45.5231,
			longitude: -122.6765,
			...overrides,
		};
	}

	// --- createLocation ---

	describe("createLocation", () => {
		it("creates a location with required fields", async () => {
			const loc = await controller.createLocation(createTestLocation());

			expect(loc.name).toBe("Downtown Store");
			expect(loc.slug).toBe("downtown-store");
			expect(loc.address).toBe("123 Main St");
			expect(loc.city).toBe("Portland");
			expect(loc.state).toBe("OR");
			expect(loc.country).toBe("US");
			expect(loc.latitude).toBe(45.5231);
			expect(loc.longitude).toBe(-122.6765);
			expect(loc.isActive).toBe(true);
			expect(loc.isFeatured).toBe(false);
			expect(loc.pickupEnabled).toBe(false);
			expect(loc.id).toBeTruthy();
			expect(loc.createdAt).toBeInstanceOf(Date);
			expect(loc.updatedAt).toBeInstanceOf(Date);
		});

		it("creates a location with optional fields", async () => {
			const loc = await controller.createLocation(
				createTestLocation({
					description: "Our flagship store",
					phone: "503-555-1234",
					email: "downtown@store.com",
					website: "https://store.com/downtown",
					imageUrl: "https://store.com/img/downtown.jpg",
					region: "Pacific Northwest",
					amenities: ["parking", "wifi", "wheelchair-accessible"],
					hours: {
						monday: { open: "09:00", close: "21:00" },
						tuesday: { open: "09:00", close: "21:00" },
						sunday: { open: "10:00", close: "18:00", closed: false },
					},
					pickupEnabled: true,
					isFeatured: true,
				}),
			);

			expect(loc.description).toBe("Our flagship store");
			expect(loc.phone).toBe("503-555-1234");
			expect(loc.email).toBe("downtown@store.com");
			expect(loc.website).toBe("https://store.com/downtown");
			expect(loc.region).toBe("Pacific Northwest");
			expect(loc.amenities).toEqual([
				"parking",
				"wifi",
				"wheelchair-accessible",
			]);
			expect(loc.hours?.monday?.open).toBe("09:00");
			expect(loc.pickupEnabled).toBe(true);
			expect(loc.isFeatured).toBe(true);
		});

		it("assigns unique IDs to each location", async () => {
			const a = await controller.createLocation(
				createTestLocation({ slug: "a" }),
			);
			const b = await controller.createLocation(
				createTestLocation({ slug: "b" }),
			);

			expect(a.id).not.toBe(b.id);
		});

		it("defaults amenities to empty array", async () => {
			const loc = await controller.createLocation(createTestLocation());
			expect(loc.amenities).toEqual([]);
		});

		it("defaults hours to empty object", async () => {
			const loc = await controller.createLocation(createTestLocation());
			expect(loc.hours).toEqual({});
		});

		it("defaults metadata to empty object", async () => {
			const loc = await controller.createLocation(createTestLocation());
			expect(loc.metadata).toEqual({});
		});
	});

	// --- getLocation ---

	describe("getLocation", () => {
		it("returns a location by ID", async () => {
			const created = await controller.createLocation(createTestLocation());
			const found = await controller.getLocation(created.id);

			expect(found).not.toBeNull();
			expect(found?.name).toBe("Downtown Store");
		});

		it("returns null for non-existent ID", async () => {
			const found = await controller.getLocation("non-existent");
			expect(found).toBeNull();
		});
	});

	// --- getLocationBySlug ---

	describe("getLocationBySlug", () => {
		it("returns a location by slug", async () => {
			await controller.createLocation(createTestLocation());
			const found = await controller.getLocationBySlug("downtown-store");

			expect(found).not.toBeNull();
			expect(found?.name).toBe("Downtown Store");
		});

		it("returns null for non-existent slug", async () => {
			const found = await controller.getLocationBySlug("non-existent");
			expect(found).toBeNull();
		});
	});

	// --- listLocations ---

	describe("listLocations", () => {
		it("returns all locations sorted by name", async () => {
			await controller.createLocation(
				createTestLocation({ name: "Zebra Store", slug: "zebra" }),
			);
			await controller.createLocation(
				createTestLocation({ name: "Alpha Store", slug: "alpha" }),
			);
			await controller.createLocation(
				createTestLocation({ name: "Mid Store", slug: "mid" }),
			);

			const locations = await controller.listLocations();

			expect(locations).toHaveLength(3);
			expect(locations[0].name).toBe("Alpha Store");
			expect(locations[1].name).toBe("Mid Store");
			expect(locations[2].name).toBe("Zebra Store");
		});

		it("filters by activeOnly", async () => {
			await controller.createLocation(
				createTestLocation({ name: "Active", slug: "active" }),
			);
			const inactive = await controller.createLocation(
				createTestLocation({ name: "Inactive", slug: "inactive" }),
			);
			await controller.updateLocation(inactive.id, { isActive: false });

			const active = await controller.listLocations({ activeOnly: true });
			expect(active).toHaveLength(1);
			expect(active[0].name).toBe("Active");
		});

		it("filters by country", async () => {
			await controller.createLocation(
				createTestLocation({ country: "US", slug: "us" }),
			);
			await controller.createLocation(
				createTestLocation({ country: "CA", slug: "ca" }),
			);

			const usLocations = await controller.listLocations({ country: "US" });
			expect(usLocations).toHaveLength(1);
			expect(usLocations[0].country).toBe("US");
		});

		it("filters by region", async () => {
			await controller.createLocation(
				createTestLocation({ region: "West", slug: "west" }),
			);
			await controller.createLocation(
				createTestLocation({ region: "East", slug: "east" }),
			);

			const west = await controller.listLocations({ region: "West" });
			expect(west).toHaveLength(1);
			expect(west[0].region).toBe("West");
		});

		it("filters by city", async () => {
			await controller.createLocation(
				createTestLocation({ city: "Portland", slug: "pdx" }),
			);
			await controller.createLocation(
				createTestLocation({ city: "Seattle", slug: "sea" }),
			);

			const portland = await controller.listLocations({ city: "Portland" });
			expect(portland).toHaveLength(1);
			expect(portland[0].city).toBe("Portland");
		});

		it("filters by pickupOnly", async () => {
			await controller.createLocation(
				createTestLocation({
					pickupEnabled: true,
					slug: "pickup",
				}),
			);
			await controller.createLocation(
				createTestLocation({ slug: "no-pickup" }),
			);

			const pickupLocations = await controller.listLocations({
				pickupOnly: true,
			});
			expect(pickupLocations).toHaveLength(1);
			expect(pickupLocations[0].pickupEnabled).toBe(true);
		});

		it("filters by featuredOnly", async () => {
			await controller.createLocation(
				createTestLocation({
					isFeatured: true,
					slug: "featured",
				}),
			);
			await controller.createLocation(
				createTestLocation({ slug: "not-featured" }),
			);

			const featured = await controller.listLocations({
				featuredOnly: true,
			});
			expect(featured).toHaveLength(1);
			expect(featured[0].isFeatured).toBe(true);
		});

		it("supports limit and offset", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createLocation(
					createTestLocation({ name: `Store ${i}`, slug: `store-${i}` }),
				);
			}

			const page = await controller.listLocations({ limit: 2, offset: 1 });
			expect(page.length).toBeLessThanOrEqual(2);
		});

		it("returns empty array when no locations exist", async () => {
			const locations = await controller.listLocations();
			expect(locations).toEqual([]);
		});

		it("combines multiple filters", async () => {
			await controller.createLocation(
				createTestLocation({
					country: "US",
					pickupEnabled: true,
					slug: "match",
				}),
			);
			await controller.createLocation(
				createTestLocation({
					country: "US",
					slug: "no-match",
				}),
			);
			await controller.createLocation(
				createTestLocation({
					country: "CA",
					pickupEnabled: true,
					slug: "ca-pickup",
				}),
			);

			const results = await controller.listLocations({
				country: "US",
				pickupOnly: true,
			});
			expect(results).toHaveLength(1);
			expect(results[0].slug).toBe("match");
		});
	});

	// --- updateLocation ---

	describe("updateLocation", () => {
		it("updates name", async () => {
			const loc = await controller.createLocation(createTestLocation());
			const updated = await controller.updateLocation(loc.id, {
				name: "New Name",
			});

			expect(updated.name).toBe("New Name");
			expect(updated.slug).toBe("downtown-store"); // unchanged
		});

		it("updates address fields", async () => {
			const loc = await controller.createLocation(createTestLocation());
			const updated = await controller.updateLocation(loc.id, {
				address: "456 Oak Ave",
				city: "Seattle",
				state: "WA",
				postalCode: "98101",
				country: "US",
			});

			expect(updated.address).toBe("456 Oak Ave");
			expect(updated.city).toBe("Seattle");
			expect(updated.state).toBe("WA");
			expect(updated.postalCode).toBe("98101");
		});

		it("updates coordinates", async () => {
			const loc = await controller.createLocation(createTestLocation());
			const updated = await controller.updateLocation(loc.id, {
				latitude: 47.6062,
				longitude: -122.3321,
			});

			expect(updated.latitude).toBe(47.6062);
			expect(updated.longitude).toBe(-122.3321);
		});

		it("updates contact info", async () => {
			const loc = await controller.createLocation(createTestLocation());
			const updated = await controller.updateLocation(loc.id, {
				phone: "555-0000",
				email: "new@store.com",
				website: "https://new.store.com",
			});

			expect(updated.phone).toBe("555-0000");
			expect(updated.email).toBe("new@store.com");
			expect(updated.website).toBe("https://new.store.com");
		});

		it("updates hours", async () => {
			const loc = await controller.createLocation(createTestLocation());
			const updated = await controller.updateLocation(loc.id, {
				hours: {
					monday: { open: "08:00", close: "20:00" },
					sunday: { open: "10:00", close: "16:00", closed: true },
				},
			});

			expect(updated.hours?.monday?.open).toBe("08:00");
			expect(updated.hours?.sunday?.closed).toBe(true);
		});

		it("updates amenities", async () => {
			const loc = await controller.createLocation(createTestLocation());
			const updated = await controller.updateLocation(loc.id, {
				amenities: ["parking", "elevator"],
			});

			expect(updated.amenities).toEqual(["parking", "elevator"]);
		});

		it("updates status flags", async () => {
			const loc = await controller.createLocation(createTestLocation());
			const updated = await controller.updateLocation(loc.id, {
				isActive: false,
				isFeatured: true,
				pickupEnabled: true,
			});

			expect(updated.isActive).toBe(false);
			expect(updated.isFeatured).toBe(true);
			expect(updated.pickupEnabled).toBe(true);
		});

		it("updates the updatedAt timestamp", async () => {
			const loc = await controller.createLocation(createTestLocation());
			const originalUpdatedAt = loc.updatedAt;

			// Small delay to ensure timestamp differs
			await new Promise((resolve) => setTimeout(resolve, 10));
			const updated = await controller.updateLocation(loc.id, {
				name: "Updated",
			});

			expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
				originalUpdatedAt.getTime(),
			);
		});

		it("throws for non-existent location", async () => {
			await expect(
				controller.updateLocation("non-existent", { name: "X" }),
			).rejects.toThrow("Location non-existent not found");
		});

		it("preserves fields not included in update", async () => {
			const loc = await controller.createLocation(
				createTestLocation({
					phone: "555-1234",
					email: "test@test.com",
				}),
			);

			const updated = await controller.updateLocation(loc.id, {
				name: "Updated Name",
			});

			expect(updated.phone).toBe("555-1234");
			expect(updated.email).toBe("test@test.com");
			expect(updated.address).toBe("123 Main St");
		});
	});

	// --- deleteLocation ---

	describe("deleteLocation", () => {
		it("deletes a location", async () => {
			const loc = await controller.createLocation(createTestLocation());
			await controller.deleteLocation(loc.id);

			const found = await controller.getLocation(loc.id);
			expect(found).toBeNull();
		});

		it("does not affect other locations", async () => {
			const a = await controller.createLocation(
				createTestLocation({ slug: "a" }),
			);
			const b = await controller.createLocation(
				createTestLocation({ slug: "b" }),
			);

			await controller.deleteLocation(a.id);

			const bFound = await controller.getLocation(b.id);
			expect(bFound).not.toBeNull();
		});
	});

	// --- searchNearby ---

	describe("searchNearby", () => {
		it("returns locations sorted by distance", async () => {
			// Portland, OR
			await controller.createLocation(
				createTestLocation({
					name: "Portland",
					slug: "portland",
					latitude: 45.5231,
					longitude: -122.6765,
				}),
			);
			// Seattle, WA (~280km from Portland)
			await controller.createLocation(
				createTestLocation({
					name: "Seattle",
					slug: "seattle",
					latitude: 47.6062,
					longitude: -122.3321,
				}),
			);
			// San Francisco (~870km from Portland)
			await controller.createLocation(
				createTestLocation({
					name: "San Francisco",
					slug: "sf",
					latitude: 37.7749,
					longitude: -122.4194,
				}),
			);

			const results = await controller.searchNearby({
				latitude: 45.5231, // searching from Portland
				longitude: -122.6765,
				radiusKm: 1000,
			});

			expect(results).toHaveLength(3);
			expect(results[0].name).toBe("Portland");
			expect(results[0].distance).toBe(0);
			expect(results[1].name).toBe("Seattle");
			expect(results[2].name).toBe("San Francisco");
		});

		it("respects radius filter", async () => {
			await controller.createLocation(
				createTestLocation({
					name: "Portland",
					slug: "portland",
					latitude: 45.5231,
					longitude: -122.6765,
				}),
			);
			await controller.createLocation(
				createTestLocation({
					name: "New York",
					slug: "ny",
					latitude: 40.7128,
					longitude: -74.006,
				}),
			);

			const nearby = await controller.searchNearby({
				latitude: 45.5231,
				longitude: -122.6765,
				radiusKm: 100,
			});

			expect(nearby).toHaveLength(1);
			expect(nearby[0].name).toBe("Portland");
		});

		it("supports mile units", async () => {
			await controller.createLocation(
				createTestLocation({
					name: "Portland",
					slug: "portland",
					latitude: 45.5231,
					longitude: -122.6765,
				}),
			);

			const results = await controller.searchNearby({
				latitude: 45.5231,
				longitude: -122.6765,
				unit: "mi",
				radiusKm: 10,
			});

			expect(results).toHaveLength(1);
			expect(results[0].unit).toBe("mi");
		});

		it("limits results", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createLocation(
					createTestLocation({
						name: `Store ${i}`,
						slug: `store-${i}`,
						latitude: 45.5231 + i * 0.01,
						longitude: -122.6765,
					}),
				);
			}

			const results = await controller.searchNearby({
				latitude: 45.5231,
				longitude: -122.6765,
				radiusKm: 100,
				limit: 3,
			});

			expect(results).toHaveLength(3);
		});

		it("excludes inactive locations by default", async () => {
			const active = await controller.createLocation(
				createTestLocation({ name: "Active", slug: "active" }),
			);
			const inactive = await controller.createLocation(
				createTestLocation({ name: "Inactive", slug: "inactive" }),
			);
			await controller.updateLocation(inactive.id, { isActive: false });

			const results = await controller.searchNearby({
				latitude: 45.5231,
				longitude: -122.6765,
				radiusKm: 100,
			});

			expect(results).toHaveLength(1);
			expect(results[0].id).toBe(active.id);
		});

		it("includes inactive when activeOnly is false", async () => {
			await controller.createLocation(
				createTestLocation({ name: "Active", slug: "active" }),
			);
			const inactive = await controller.createLocation(
				createTestLocation({ name: "Inactive", slug: "inactive" }),
			);
			await controller.updateLocation(inactive.id, { isActive: false });

			const results = await controller.searchNearby({
				latitude: 45.5231,
				longitude: -122.6765,
				radiusKm: 100,
				activeOnly: false,
			});

			expect(results).toHaveLength(2);
		});

		it("filters by pickupOnly", async () => {
			await controller.createLocation(
				createTestLocation({
					name: "Pickup",
					slug: "pickup",
					pickupEnabled: true,
				}),
			);
			await controller.createLocation(
				createTestLocation({
					name: "No Pickup",
					slug: "no-pickup",
				}),
			);

			const results = await controller.searchNearby({
				latitude: 45.5231,
				longitude: -122.6765,
				radiusKm: 100,
				pickupOnly: true,
			});

			expect(results).toHaveLength(1);
			expect(results[0].name).toBe("Pickup");
		});

		it("returns empty array when no locations in radius", async () => {
			await controller.createLocation(
				createTestLocation({
					name: "Far Away",
					slug: "far",
					latitude: -33.8688, // Sydney, Australia
					longitude: 151.2093,
				}),
			);

			const results = await controller.searchNearby({
				latitude: 45.5231,
				longitude: -122.6765,
				radiusKm: 100,
			});

			expect(results).toEqual([]);
		});

		it("calculates reasonable distances", async () => {
			// Portland to Seattle is ~233km
			await controller.createLocation(
				createTestLocation({
					name: "Seattle",
					slug: "seattle",
					latitude: 47.6062,
					longitude: -122.3321,
				}),
			);

			const results = await controller.searchNearby({
				latitude: 45.5231,
				longitude: -122.6765,
				radiusKm: 500,
			});

			expect(results).toHaveLength(1);
			expect(results[0].distance).toBeGreaterThan(200);
			expect(results[0].distance).toBeLessThan(300);
		});
	});

	// --- listRegions ---

	describe("listRegions", () => {
		it("returns unique regions sorted alphabetically", async () => {
			await controller.createLocation(
				createTestLocation({ region: "West", slug: "w1" }),
			);
			await controller.createLocation(
				createTestLocation({ region: "East", slug: "e1" }),
			);
			await controller.createLocation(
				createTestLocation({ region: "West", slug: "w2" }),
			);

			const regions = await controller.listRegions();
			expect(regions).toEqual(["East", "West"]);
		});

		it("excludes locations without regions", async () => {
			await controller.createLocation(createTestLocation({ slug: "no-r" }));
			await controller.createLocation(
				createTestLocation({ region: "North", slug: "n1" }),
			);

			const regions = await controller.listRegions();
			expect(regions).toEqual(["North"]);
		});

		it("excludes inactive locations", async () => {
			const loc = await controller.createLocation(
				createTestLocation({ region: "Closed", slug: "closed" }),
			);
			await controller.updateLocation(loc.id, { isActive: false });
			await controller.createLocation(
				createTestLocation({ region: "Open", slug: "open" }),
			);

			const regions = await controller.listRegions();
			expect(regions).toEqual(["Open"]);
		});

		it("returns empty array when no locations", async () => {
			const regions = await controller.listRegions();
			expect(regions).toEqual([]);
		});
	});

	// --- listCountries ---

	describe("listCountries", () => {
		it("returns unique countries sorted alphabetically", async () => {
			await controller.createLocation(
				createTestLocation({ country: "US", slug: "us" }),
			);
			await controller.createLocation(
				createTestLocation({ country: "CA", slug: "ca" }),
			);
			await controller.createLocation(
				createTestLocation({ country: "US", slug: "us2" }),
			);

			const countries = await controller.listCountries();
			expect(countries).toEqual(["CA", "US"]);
		});

		it("excludes inactive locations", async () => {
			const loc = await controller.createLocation(
				createTestLocation({ country: "DE", slug: "de" }),
			);
			await controller.updateLocation(loc.id, { isActive: false });

			const countries = await controller.listCountries();
			expect(countries).toEqual([]);
		});
	});

	// --- listCities ---

	describe("listCities", () => {
		it("returns unique cities for a country", async () => {
			await controller.createLocation(
				createTestLocation({
					city: "Portland",
					country: "US",
					slug: "pdx",
				}),
			);
			await controller.createLocation(
				createTestLocation({
					city: "Seattle",
					country: "US",
					slug: "sea",
				}),
			);
			await controller.createLocation(
				createTestLocation({
					city: "Vancouver",
					country: "CA",
					slug: "yvr",
				}),
			);

			const usCities = await controller.listCities("US");
			expect(usCities).toEqual(["Portland", "Seattle"]);
		});

		it("returns empty array for unknown country", async () => {
			const cities = await controller.listCities("XX");
			expect(cities).toEqual([]);
		});

		it("returns sorted results", async () => {
			await controller.createLocation(
				createTestLocation({
					city: "Zephyr",
					country: "US",
					slug: "z",
				}),
			);
			await controller.createLocation(
				createTestLocation({
					city: "Austin",
					country: "US",
					slug: "a",
				}),
			);

			const cities = await controller.listCities("US");
			expect(cities).toEqual(["Austin", "Zephyr"]);
		});
	});

	// --- isOpen ---

	describe("isOpen", () => {
		it("throws for non-existent location", async () => {
			await expect(controller.isOpen("non-existent")).rejects.toThrow(
				"Location non-existent not found",
			);
		});

		it("returns closed when no hours are set", async () => {
			const loc = await controller.createLocation(createTestLocation());
			const result = await controller.isOpen(loc.id);

			expect(result.open).toBe(false);
			expect(result.hours).toBeNull();
			expect(result.currentDay).toBeTruthy();
		});

		it("returns closed when day is marked closed", async () => {
			const dayNames = [
				"sunday",
				"monday",
				"tuesday",
				"wednesday",
				"thursday",
				"friday",
				"saturday",
			] as const;
			const today = dayNames[new Date().getDay()];

			const loc = await controller.createLocation(
				createTestLocation({
					hours: {
						[today]: { open: "00:00", close: "23:59", closed: true },
					},
				}),
			);

			const result = await controller.isOpen(loc.id);
			expect(result.open).toBe(false);
		});

		it("returns current day name", async () => {
			const loc = await controller.createLocation(createTestLocation());
			const result = await controller.isOpen(loc.id);

			const dayNames = [
				"sunday",
				"monday",
				"tuesday",
				"wednesday",
				"thursday",
				"friday",
				"saturday",
			];
			expect(dayNames).toContain(result.currentDay);
		});
	});

	// --- getStats ---

	describe("getStats", () => {
		it("returns zeroes when no locations", async () => {
			const stats = await controller.getStats();

			expect(stats.totalLocations).toBe(0);
			expect(stats.activeLocations).toBe(0);
			expect(stats.pickupLocations).toBe(0);
			expect(stats.featuredLocations).toBe(0);
			expect(stats.countries).toBe(0);
			expect(stats.regions).toBe(0);
		});

		it("counts locations correctly", async () => {
			await controller.createLocation(
				createTestLocation({
					slug: "a",
					country: "US",
					region: "West",
					pickupEnabled: true,
					isFeatured: true,
				}),
			);
			await controller.createLocation(
				createTestLocation({
					slug: "b",
					country: "US",
					region: "East",
				}),
			);
			await controller.createLocation(
				createTestLocation({
					slug: "c",
					country: "CA",
					region: "West",
					pickupEnabled: true,
				}),
			);

			const stats = await controller.getStats();

			expect(stats.totalLocations).toBe(3);
			expect(stats.activeLocations).toBe(3);
			expect(stats.pickupLocations).toBe(2);
			expect(stats.featuredLocations).toBe(1);
			expect(stats.countries).toBe(2);
			expect(stats.regions).toBe(2);
		});

		it("distinguishes active from inactive", async () => {
			await controller.createLocation(createTestLocation({ slug: "active" }));
			const inactive = await controller.createLocation(
				createTestLocation({ slug: "inactive" }),
			);
			await controller.updateLocation(inactive.id, { isActive: false });

			const stats = await controller.getStats();
			expect(stats.totalLocations).toBe(2);
			expect(stats.activeLocations).toBe(1);
		});

		it("counts unique countries and regions", async () => {
			await controller.createLocation(
				createTestLocation({
					slug: "a",
					country: "US",
					region: "West",
				}),
			);
			await controller.createLocation(
				createTestLocation({
					slug: "b",
					country: "US",
					region: "West",
				}),
			);

			const stats = await controller.getStats();
			expect(stats.countries).toBe(1);
			expect(stats.regions).toBe(1);
		});
	});
});
