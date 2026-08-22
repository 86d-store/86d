import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { withEntities } from "@86d-app/core/types/module";
import { createGetSettingsEndpoint } from "./admin/endpoints/get-settings";
import {
	adminEndpoints,
	createAdminEndpointsWithSettings,
} from "./admin/endpoints/routes";
import { UberEatsProvider } from "./provider";
import { uberEatsStorage } from "./schema";
import type { UberEatsEntities } from "./service";
import { createUberEatsController } from "./service-impl";
import { createStoreEndpointsWithWebhook } from "./store/endpoints/routes";
import { createUberEatsWebhook } from "./store/endpoints/webhook";

export type {
	MenuSync,
	MenuSyncStatus,
	OrderStats,
	UberEatsController,
	UberOrder,
	UberOrderStatus,
} from "./service";

export interface UberEatsOptions extends ModuleConfig {
	/** Uber Eats OAuth client ID */
	clientId?: string;
	/** Uber Eats OAuth client secret */
	clientSecret?: string;
	/** Uber Eats restaurant/store ID */
	restaurantId?: string;
}

export default function uberEats(options?: UberEatsOptions): Module {
	let provider: UberEatsProvider | undefined;

	if (options?.clientId && options?.clientSecret && options?.restaurantId) {
		provider = new UberEatsProvider(
			options.clientId,
			options.clientSecret,
			options.restaurantId,
		);
	}

	const hasCredentials = Boolean(
		options?.clientId && options?.clientSecret && options?.restaurantId,
	);

	const settingsEndpoint = createGetSettingsEndpoint({
		clientId: options?.clientId,
		clientSecret: options?.clientSecret,
		restaurantId: options?.restaurantId,
	});

	const webhookEndpoint = createUberEatsWebhook({
		clientSecret: options?.clientSecret,
	});

	return {
		id: "uber-eats",
		version: "0.0.1",
		storage: uberEatsStorage,
		exports: {
			read: ["uberOrderStatus", "uberOrderTotal"],
		},
		events: {
			emits: [
				"ubereats.order.received",
				"ubereats.order.accepted",
				"ubereats.order.ready",
				"ubereats.order.cancelled",
				"ubereats.menu.synced",
				"ubereats.webhook.received",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createUberEatsController(
				withEntities<UberEatsEntities>(ctx.data),
				ctx.events,
				provider,
			);
			return { controllers: { "uber-eats": controller } };
		},
		endpoints: {
			store: createStoreEndpointsWithWebhook(webhookEndpoint),
			admin: hasCredentials
				? createAdminEndpointsWithSettings(settingsEndpoint)
				: {
						...adminEndpoints,
						"/admin/uber-eats/settings": settingsEndpoint,
					},
		},
		admin: {
			pages: [
				{
					path: "/admin/uber-eats",
					component: "UberEatsAdmin",
					label: "Uber Eats",
					icon: "Bike",
					group: "Sales",
				},
			],
		},
		options,
	};
}
