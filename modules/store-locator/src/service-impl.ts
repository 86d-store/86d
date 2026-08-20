import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	Location,
	LocationWithDistance,
	StoreLocatorController,
	WeeklyHours,
} from "./service";

const EARTH_RADIUS_KM = 6371;
const KM_TO_MI = 0.621371;

/** Convert degrees to radians */
function toRadians(degrees: number): number {
	return (degrees * Math.PI) / 180;
}

/**
 * Calculate the distance between two geographic coordinates using the Haversine formula.
 * Returns distance in kilometers.
 */
function haversineDistance(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number,
): number {
	const dLat = toRadians(lat2 - lat1);
	const dLon = toRadians(lon2 - lon1);

	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRadians(lat1)) *
			Math.cos(toRadians(lat2)) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2);

	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return EARTH_RADIUS_KM * c;
}

const DAY_NAMES = [
	"sunday",
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
] as const;

function getCurrentDayName(): keyof WeeklyHours {
	return DAY_NAMES[new Date().getDay()];
}

export function createStoreLocatorControllers(
	data: ModuleDataService,
): StoreLocatorController {
	return {
		async createLocation(params) {
			const id = crypto.randomUUID();
			const now = new Date();

			const location: Location = {
				id,
				name: params.name,
				slug: params.slug,
				description: params.description ?? undefined,
				address: params.address,
				city: params.city,
				state: params.state ?? undefined,
				postalCode: params.postalCode ?? undefined,
				country: params.country,
				latitude: params.latitude,
				longitude: params.longitude,
				phone: params.phone ?? undefined,
				email: params.email ?? undefined,
				website: params.website ?? undefined,
				imageUrl: params.imageUrl ?? undefined,
				hours: params.hours ?? {},
				amenities: params.amenities ?? [],
				region: params.region ?? undefined,
				isActive: true,
				isFeatured: params.isFeatured ?? false,
				pickupEnabled: params.pickupEnabled ?? false,
				metadata: {},
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert("location", id, location as Record<string, unknown>);

			return location;
		},

		async getLocation(id: string) {
			return (await data.get("location", id)) as Location | null;
		},

		async getLocationBySlug(slug: string) {
			const locations = (await data.findMany("location", {
				where: { slug },
			})) as Location[];

			return locations[0] ?? null;
		},

		async listLocations(opts = {}) {
			const {
				activeOnly = false,
				country,
				region,
				city,
				pickupOnly = false,
				featuredOnly = false,
				limit,
				offset,
			} = opts;

			const where: Record<string, unknown> = {};
			if (activeOnly) where.isActive = true;
			if (country) where.country = country;
			if (region) where.region = region;
			if (city) where.city = city;
			if (pickupOnly) where.pickupEnabled = true;
			if (featuredOnly) where.isFeatured = true;

			const findOpts: Record<string, unknown> = { where };
			if (limit !== undefined) findOpts.take = limit;
			if (offset !== undefined) findOpts.skip = offset;

			const locations = (await data.findMany(
				"location",
				findOpts,
			)) as Location[];

			return locations.sort((a, b) => a.name.localeCompare(b.name));
		},

		async updateLocation(id, updateData) {
			const existing = (await data.get("location", id)) as Location | null;
			if (!existing) {
				throw new Error(`Location ${id} not found`);
			}

			const updated: Location = {
				...existing,
				...(updateData.name !== undefined && { name: updateData.name }),
				...(updateData.slug !== undefined && { slug: updateData.slug }),
				...(updateData.description !== undefined && {
					description: updateData.description,
				}),
				...(updateData.address !== undefined && {
					address: updateData.address,
				}),
				...(updateData.city !== undefined && { city: updateData.city }),
				...(updateData.state !== undefined && { state: updateData.state }),
				...(updateData.postalCode !== undefined && {
					postalCode: updateData.postalCode,
				}),
				...(updateData.country !== undefined && {
					country: updateData.country,
				}),
				...(updateData.latitude !== undefined && {
					latitude: updateData.latitude,
				}),
				...(updateData.longitude !== undefined && {
					longitude: updateData.longitude,
				}),
				...(updateData.phone !== undefined && { phone: updateData.phone }),
				...(updateData.email !== undefined && { email: updateData.email }),
				...(updateData.website !== undefined && {
					website: updateData.website,
				}),
				...(updateData.imageUrl !== undefined && {
					imageUrl: updateData.imageUrl,
				}),
				...(updateData.hours !== undefined && { hours: updateData.hours }),
				...(updateData.amenities !== undefined && {
					amenities: updateData.amenities,
				}),
				...(updateData.region !== undefined && {
					region: updateData.region,
				}),
				...(updateData.isActive !== undefined && {
					isActive: updateData.isActive,
				}),
				...(updateData.isFeatured !== undefined && {
					isFeatured: updateData.isFeatured,
				}),
				...(updateData.pickupEnabled !== undefined && {
					pickupEnabled: updateData.pickupEnabled,
				}),
				updatedAt: new Date(),
			};

			await data.upsert("location", id, updated as Record<string, unknown>);

			return updated;
		},

		async deleteLocation(id: string) {
			await data.delete("location", id);
		},

		async searchNearby(params) {
			const {
				latitude,
				longitude,
				radiusKm = 50,
				unit = "km",
				limit = 20,
				activeOnly = true,
				pickupOnly = false,
			} = params;

			const where: Record<string, unknown> = {};
			if (activeOnly) where.isActive = true;
			if (pickupOnly) where.pickupEnabled = true;

			const allLocations = (await data.findMany("location", {
				where,
			})) as Location[];

			const withDistance: LocationWithDistance[] = allLocations
				.map((loc) => {
					const distKm = haversineDistance(
						latitude,
						longitude,
						loc.latitude,
						loc.longitude,
					);
					const distance = unit === "mi" ? distKm * KM_TO_MI : distKm;
					return { ...loc, distance: Math.round(distance * 100) / 100, unit };
				})
				.filter((loc) => {
					const maxDist = unit === "mi" ? radiusKm * KM_TO_MI : radiusKm;
					return loc.distance <= maxDist;
				})
				.sort((a, b) => a.distance - b.distance)
				.slice(0, limit);

			return withDistance;
		},

		async listRegions() {
			const locations = (await data.findMany("location", {
				where: { isActive: true },
			})) as Location[];

			const regions = new Set<string>();
			for (const loc of locations) {
				if (loc.region) regions.add(loc.region);
			}

			return [...regions].sort();
		},

		async listCountries() {
			const locations = (await data.findMany("location", {
				where: { isActive: true },
			})) as Location[];

			const countries = new Set<string>();
			for (const loc of locations) {
				countries.add(loc.country);
			}

			return [...countries].sort();
		},

		async listCities(country: string) {
			const locations = (await data.findMany("location", {
				where: { country, isActive: true },
			})) as Location[];

			const cities = new Set<string>();
			for (const loc of locations) {
				cities.add(loc.city);
			}

			return [...cities].sort();
		},

		async isOpen(id: string) {
			const location = (await data.get("location", id)) as Location | null;
			if (!location) {
				throw new Error(`Location ${id} not found`);
			}

			const currentDay = getCurrentDayName();
			const hours = location.hours as WeeklyHours | undefined;
			const dayHours = hours?.[currentDay] ?? null;

			if (!dayHours || dayHours.closed) {
				return { open: false, currentDay, hours: dayHours };
			}

			const now = new Date();
			const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

			const open = currentTime >= dayHours.open && currentTime < dayHours.close;

			return { open, currentDay, hours: dayHours };
		},

		async getStats() {
			const all = (await data.findMany("location", {})) as Location[];

			const active = all.filter((l) => l.isActive);
			const countries = new Set(all.map((l) => l.country));
			const regions = new Set(all.filter((l) => l.region).map((l) => l.region));

			return {
				totalLocations: all.length,
				activeLocations: active.length,
				pickupLocations: all.filter((l) => l.pickupEnabled).length,
				featuredLocations: all.filter((l) => l.isFeatured).length,
				countries: countries.size,
				regions: regions.size,
			};
		},
	};
}
