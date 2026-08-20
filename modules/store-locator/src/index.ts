import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { storeLocatorStorage } from "./schema";
import { createStoreLocatorControllers } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	DayHours,
	Location,
	LocationWithDistance,
	StoreLocatorController,
	WeeklyHours,
} from "./service";

export interface StoreLocatorOptions extends ModuleConfig {
	/**
	 * Default search radius in kilometers
	 * @default 50
	 */
	defaultRadiusKm?: number;

	/**
	 * Maximum number of results for nearby search
	 * @default 20
	 */
	maxNearbyResults?: number;

	/**
	 * Default distance unit
	 * @default "km"
	 */
	defaultUnit?: "km" | "mi";
}

/**
 * Store locator module factory function
 * Creates a physical store location management module with
 * proximity search, hours management, and click-and-collect support
 */
export default function storeLocator(options?: StoreLocatorOptions): Module {
	return {
		id: "store-locator",
		version: "1.0.0",
		storage: storeLocatorStorage,
		exports: {
			read: [
				"locations",
				"nearbyLocations",
				"regions",
				"countries",
				"locationHours",
			],
		},
		events: {
			emits: [
				"store-locator.location.created",
				"store-locator.location.updated",
				"store-locator.location.deleted",
			],
		},

		init: async (ctx: ModuleContext) => {
			const controller = createStoreLocatorControllers(ctx.data);

			return {
				controllers: { storeLocator: controller },
			};
		},

		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/store-locator",
					component: "LocationList",
					label: "Locations",
					icon: "MapPin",
					group: "Content",
				},
				{
					path: "/admin/store-locator/new",
					component: "LocationForm",
				},
				{
					path: "/admin/store-locator/:id",
					component: "LocationDetail",
				},
				{
					path: "/admin/store-locator/:id/edit",
					component: "LocationForm",
				},
			],
		},
		store: {
			pages: [
				{
					path: "/stores",
					component: "LocationList",
				},
				{
					path: "/stores/:slug",
					component: "LocationDetail",
				},
			],
		},
		options,
	};
}
