import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { createGetSettingsEndpoint } from "./admin/endpoints/get-settings";
import {
	adminEndpoints,
	createAdminEndpointsWithSettings,
} from "./admin/endpoints/routes";
import { ToastPosProvider } from "./provider";
import { toastStorage } from "./schema";
import { createToastController } from "./service-impl";
import { createStoreEndpointsWithWebhook } from "./store/endpoints/routes";
import { createToastWebhook } from "./store/endpoints/webhook";

export type {
	MenuMapping,
	SyncDirection,
	SyncEntityType,
	SyncRecord,
	SyncStats,
	ToastController,
} from "./service";

export interface ToastOptions extends ModuleConfig {
	/** Toast API access token */
	apiKey?: string;
	/** Toast restaurant external GUID */
	restaurantGuid?: string;
	/** Use sandbox mode (default: "true") */
	sandbox?: string;
	/** Toast webhook client secret for signature verification */
	webhookSecret?: string;
}

export default function toast(options?: ToastOptions): Module {
	let provider: ToastPosProvider | undefined;
	const isSandbox = options?.sandbox !== "false";

	if (options?.apiKey && options?.restaurantGuid) {
		provider = new ToastPosProvider(options.apiKey, options.restaurantGuid, {
			sandbox: isSandbox,
		});
	}

	const hasCredentials = Boolean(options?.apiKey && options?.restaurantGuid);

	const settingsEndpoint = createGetSettingsEndpoint({
		apiKey: options?.apiKey,
		restaurantGuid: options?.restaurantGuid,
		sandbox: isSandbox,
	});

	const webhookEndpoint = createToastWebhook({
		webhookSecret: options?.webhookSecret,
	});

	return {
		id: "toast",
		version: "0.0.1",
		storage: toastStorage,
		exports: {
			read: ["syncRecordStatus", "menuMappingId"],
		},
		events: {
			emits: [
				"toast.order.synced",
				"toast.menu.synced",
				"toast.inventory.updated",
				"toast.webhook.received",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createToastController(ctx.data, ctx.events, provider);
			return { controllers: { toast: controller } };
		},
		endpoints: {
			store: createStoreEndpointsWithWebhook(webhookEndpoint),
			admin: hasCredentials
				? createAdminEndpointsWithSettings(settingsEndpoint)
				: {
						...adminEndpoints,
						"/admin/toast/settings": settingsEndpoint,
					},
		},
		admin: {
			pages: [
				{
					path: "/admin/toast",
					component: "ToastAdmin",
					label: "Toast POS",
					icon: "Utensils",
					group: "Sales",
				},
			],
		},
		options,
	};
}
