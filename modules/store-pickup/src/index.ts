import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { storePickupSchema } from "./schema";
import { createStorePickupController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export interface StorePickupOptions extends ModuleConfig {
	/** Default preparation time in minutes when not set on a location. Default: 60. */
	defaultPreparationMinutes?: number;
}

export default function storePickup(options?: StorePickupOptions): Module {
	return {
		id: "store-pickup",
		version: "0.0.1",
		schema: storePickupSchema,

		exports: {
			read: [
				"availableWindows",
				"orderPickup",
				"windowBookingCount",
				"pickupLocations",
			],
		},

		events: {
			emits: [
				"store-pickup.location.created",
				"store-pickup.location.updated",
				"store-pickup.location.deleted",
				"store-pickup.window.created",
				"store-pickup.window.updated",
				"store-pickup.window.deleted",
				"store-pickup.pickup.scheduled",
				"store-pickup.pickup.preparing",
				"store-pickup.pickup.ready",
				"store-pickup.pickup.completed",
				"store-pickup.pickup.cancelled",
				"store-pickup.blackout.created",
				"store-pickup.blackout.deleted",
			],
		},

		init: async (ctx: ModuleContext) => {
			const controller = createStorePickupController(ctx.data);
			return {
				controllers: { storePickup: controller },
			};
		},

		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},

		admin: {
			pages: [
				{
					path: "/admin/store-pickup",
					component: "LocationList",
					label: "Pickup Locations",
					icon: "MapPin",
					group: "Fulfillment",
				},
				{
					path: "/admin/store-pickup/:id",
					component: "LocationDetail",
				},
				{
					path: "/admin/store-pickup/queue",
					component: "PickupQueue",
					label: "Pickup Queue",
					icon: "PackageCheck",
					group: "Fulfillment",
				},
			],
		},

		store: {
			pages: [
				{
					path: "/store-pickup",
					component: "LocationPicker",
				},
			],
		},

		options,
	};
}

export type {
	AvailableWindowsParams,
	CreateBlackoutParams,
	CreateLocationParams,
	CreateWindowParams,
	ListLocationsParams,
	ListPickupsParams,
	ListWindowsParams,
	PickupBlackout,
	PickupLocation,
	PickupOrder,
	PickupOrderStatus,
	PickupWindow,
	SchedulePickupParams,
	StorePickupController,
	StorePickupSummary,
	UpdateLocationParams,
	UpdateWindowParams,
	WindowAvailability,
} from "./service";
