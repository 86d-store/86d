import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { createGetSettingsEndpoint } from "./admin/endpoints/get-settings";
import { createAdminEndpointsWithSettings } from "./admin/endpoints/routes";
import { uberDirectSchema } from "./schema";
import { createUberDirectController } from "./service-impl";
import { createStoreEndpoints, storeEndpoints } from "./store/endpoints/routes";
import { createUberDirectWebhook } from "./store/endpoints/webhook";

export type {
	CreateServiceAreaParams,
	Delivery,
	DeliveryAvailability,
	DeliveryStats,
	Quote,
	ServiceArea,
	UberDirectController,
	UpdateServiceAreaParams,
} from "./service";

export interface UberDirectOptions extends ModuleConfig {
	/** Uber Direct OAuth client ID */
	clientId?: string;
	/** Uber Direct OAuth client secret */
	clientSecret?: string;
	/** Uber Direct customer ID */
	customerId?: string;
	/** Webhook signing key for signature verification */
	webhookSigningKey?: string;
}

export default function uberDirect(options?: UberDirectOptions): Module {
	const hasCredentials = Boolean(
		options?.clientId &&
			options?.clientSecret &&
			options?.customerId &&
			options?.webhookSigningKey,
	);

	// Build endpoints — include webhook and settings when credentials are present
	const webhookEndpoint = createUberDirectWebhook(options?.webhookSigningKey);
	const settingsEndpoint = createGetSettingsEndpoint({
		clientId: options?.clientId,
		clientSecret: options?.clientSecret,
		customerId: options?.customerId,
		webhookSigningKey: options?.webhookSigningKey,
	});

	return {
		id: "uber-direct",
		version: "0.1.0",
		schema: uberDirectSchema,
		exports: {
			read: ["deliveryStatus", "deliveryTracking"],
		},
		events: {
			emits: [
				"uber-direct.delivery.created",
				"uber-direct.delivery.picked-up",
				"uber-direct.delivery.delivered",
				"uber-direct.delivery.cancelled",
				"uber-direct.quote.created",
				"uber-direct.webhook.received",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createUberDirectController(ctx.data, ctx.events, {
				clientId: options?.clientId,
				clientSecret: options?.clientSecret,
				customerId: options?.customerId,
			});
			return { controllers: { uberDirect: controller } };
		},
		endpoints: {
			store: hasCredentials
				? createStoreEndpoints(webhookEndpoint)
				: storeEndpoints,
			admin: createAdminEndpointsWithSettings(settingsEndpoint),
		},
		admin: {
			pages: [
				{
					path: "/admin/uber-direct",
					component: "UberDirectAdmin",
					label: "Uber Direct",
					icon: "Truck",
					group: "Fulfillment",
				},
			],
		},
		options,
	};
}
