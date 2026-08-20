import type { ModuleController } from "@86d-app/core/types/module";

/** Operating hours for a single day */
export type DayHours = {
	open: string;
	close: string;
	closed?: boolean | undefined;
};

/** Weekly hours schedule keyed by day name */
export type WeeklyHours = {
	monday?: DayHours | undefined;
	tuesday?: DayHours | undefined;
	wednesday?: DayHours | undefined;
	thursday?: DayHours | undefined;
	friday?: DayHours | undefined;
	saturday?: DayHours | undefined;
	sunday?: DayHours | undefined;
};

/** A physical store location */
export type Location = {
	id: string;
	name: string;
	slug: string;
	description?: string | undefined;
	address: string;
	city: string;
	state?: string | undefined;
	postalCode?: string | undefined;
	country: string;
	latitude: number;
	longitude: number;
	phone?: string | undefined;
	email?: string | undefined;
	website?: string | undefined;
	imageUrl?: string | undefined;
	hours?: WeeklyHours | undefined;
	amenities?: string[] | undefined;
	region?: string | undefined;
	isActive: boolean;
	isFeatured: boolean;
	pickupEnabled: boolean;
	metadata?: Record<string, unknown> | undefined;
	createdAt: Date;
	updatedAt: Date;
};

/** Location with distance from a reference point */
export type LocationWithDistance = Location & {
	distance: number;
	unit: "km" | "mi";
};

export type StoreLocatorController = ModuleController & {
	/** Create a new location */
	createLocation(params: {
		name: string;
		slug: string;
		description?: string | undefined;
		address: string;
		city: string;
		state?: string | undefined;
		postalCode?: string | undefined;
		country: string;
		latitude: number;
		longitude: number;
		phone?: string | undefined;
		email?: string | undefined;
		website?: string | undefined;
		imageUrl?: string | undefined;
		hours?: WeeklyHours | undefined;
		amenities?: string[] | undefined;
		region?: string | undefined;
		pickupEnabled?: boolean | undefined;
		isFeatured?: boolean | undefined;
	}): Promise<Location>;

	/** Get a location by ID */
	getLocation(id: string): Promise<Location | null>;

	/** Get a location by slug */
	getLocationBySlug(slug: string): Promise<Location | null>;

	/** List all locations with optional filters */
	listLocations(opts?: {
		activeOnly?: boolean | undefined;
		country?: string | undefined;
		region?: string | undefined;
		city?: string | undefined;
		pickupOnly?: boolean | undefined;
		featuredOnly?: boolean | undefined;
		limit?: number | undefined;
		offset?: number | undefined;
	}): Promise<Location[]>;

	/** Update a location */
	updateLocation(
		id: string,
		data: {
			name?: string | undefined;
			slug?: string | undefined;
			description?: string | undefined;
			address?: string | undefined;
			city?: string | undefined;
			state?: string | undefined;
			postalCode?: string | undefined;
			country?: string | undefined;
			latitude?: number | undefined;
			longitude?: number | undefined;
			phone?: string | undefined;
			email?: string | undefined;
			website?: string | undefined;
			imageUrl?: string | undefined;
			hours?: WeeklyHours | undefined;
			amenities?: string[] | undefined;
			region?: string | undefined;
			isActive?: boolean | undefined;
			isFeatured?: boolean | undefined;
			pickupEnabled?: boolean | undefined;
		},
	): Promise<Location>;

	/** Delete a location */
	deleteLocation(id: string): Promise<void>;

	/** Find locations near a coordinate, sorted by distance */
	searchNearby(params: {
		latitude: number;
		longitude: number;
		radiusKm?: number | undefined;
		unit?: "km" | "mi" | undefined;
		limit?: number | undefined;
		activeOnly?: boolean | undefined;
		pickupOnly?: boolean | undefined;
	}): Promise<LocationWithDistance[]>;

	/** Get distinct regions for filtering */
	listRegions(): Promise<string[]>;

	/** Get distinct countries for filtering */
	listCountries(): Promise<string[]>;

	/** Get distinct cities for a country */
	listCities(country: string): Promise<string[]>;

	/** Check if a location is currently open */
	isOpen(id: string): Promise<{
		open: boolean;
		currentDay: string;
		hours: DayHours | null;
	}>;

	/** Get location stats */
	getStats(): Promise<{
		totalLocations: number;
		activeLocations: number;
		pickupLocations: number;
		featuredLocations: number;
		countries: number;
		regions: number;
	}>;
};
