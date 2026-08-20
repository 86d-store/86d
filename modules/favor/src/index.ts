import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { createAdminEndpoints } from "./admin/endpoints/routes";
import { favorSchema } from "./schema";
import { createFavorController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	FavorController,
	FavorDelivery,
	FavorDeliveryStats,
	ServiceArea,
} from "./service";

export interface FavorOptions extends ModuleConfig {
	/** Favor API key */
	apiKey?: string;
	/** Favor merchant ID */
	merchantId?: string;
	/** Whether to use sandbox mode (default: "true") */
	sandbox?: string;
}

export default function favor(options?: FavorOptions): Module {
	return {
		id: "favor",
		version: "0.1.0",
		schema: favorSchema,
		exports: {
			read: ["deliveryStatus", "serviceAvailability"],
		},
		events: {
			emits: [
				"favor.delivery.created",
				"favor.delivery.assigned",
				"favor.delivery.completed",
				"favor.delivery.cancelled",
				"favor.webhook.received",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createFavorController(ctx.data);
			return { controllers: { favor: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: createAdminEndpoints({
				apiKey: options?.apiKey,
				merchantId: options?.merchantId,
				sandbox: options?.sandbox !== "false",
			}),
		},
		admin: {
			pages: [
				{
					path: "/admin/favor",
					component: "FavorAdmin",
					label: "Favor",
					icon: "Bike",
					group: "Fulfillment",
				},
			],
		},
		options,
	};
}
