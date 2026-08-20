import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { createGetSettingsEndpoint } from "./admin/endpoints/get-settings";
import { createAdminEndpointsWithSettings } from "./admin/endpoints/routes";
import { doordashStorage } from "./schema";
import { createDoordashController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	Delivery,
	DeliveryAvailability,
	DeliveryQuote,
	DeliveryStatus,
	DeliveryZone,
	DoordashController,
} from "./service";

export interface DoordashOptions extends ModuleConfig {
	/** DoorDash developer_id from the developer portal */
	developerId?: string | undefined;
	/** DoorDash key_id from the developer portal */
	keyId?: string | undefined;
	/** DoorDash signing_secret (base64-encoded) from the developer portal */
	signingSecret?: string | undefined;
	/** Use sandbox mode (default: true) */
	sandbox?: boolean | undefined;
}

export default function doordash(options?: DoordashOptions): Module {
	const settingsEndpoint = createGetSettingsEndpoint({
		developerId: options?.developerId,
		keyId: options?.keyId,
		signingSecret: options?.signingSecret,
		sandbox: options?.sandbox,
	});

	return {
		id: "doordash",
		version: "0.1.0",
		storage: doordashStorage,
		exports: {
			read: ["deliveryStatus", "deliveryTrackingUrl"],
		},
		events: {
			emits: [
				"doordash.delivery.created",
				"doordash.delivery.picked-up",
				"doordash.delivery.delivered",
				"doordash.delivery.cancelled",
				"doordash.webhook.received",
			],
		},
		init: async (ctx: ModuleContext) => {
			// DoorDash Drive lifecycle webhooks currently require configured Basic
			// Auth or OAuth. Until that ingress can be verified, do not construct
			// the outbound provider client: local delivery management remains
			// available without creating unmanaged external deliveries.
			const controller = createDoordashController(ctx.data, ctx.events);
			return { controllers: { doordash: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: createAdminEndpointsWithSettings(settingsEndpoint),
		},
		admin: {
			pages: [
				{
					path: "/admin/doordash",
					component: "DoorDashAdmin",
					label: "DoorDash",
					icon: "Truck",
					group: "Fulfillment",
				},
			],
		},
		options,
	};
}
