import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { storePresentationResolveProvider } from "./capabilities";
import { settingsSchema, settingsTables } from "./schema";
import { SETTING_KEYS } from "./service";
import { createSettingsController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	SettingGroup,
	SettingKey,
	SettingsController,
	StoreSetting,
} from "./service";

export { SETTING_KEYS };

export interface SettingsOptions extends ModuleConfig {
	/** Default store name shown before settings are configured */
	defaultStoreName?: string;
}

export default function settings(options?: SettingsOptions): Module {
	return {
		id: "settings",
		version: "0.0.1",
		schema: settingsSchema,
		tables: settingsTables,
		capabilities: { provides: [storePresentationResolveProvider] },
		exports: {
			read: ["storeName", "storeDescription", "currency"],
		},
		events: {
			emits: ["settings.updated", "settings.deleted"],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createSettingsController(ctx.data);
			return { controllers: { settings: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/settings",
					component: "SettingsGeneral",
					label: "Settings",
					icon: "GearSix",
					group: "System",
				},
				{
					path: "/admin/settings/contact",
					component: "SettingsContact",
				},
				{
					path: "/admin/settings/social",
					component: "SettingsSocial",
				},
				{
					path: "/admin/settings/legal",
					component: "SettingsLegal",
				},
				{
					path: "/admin/settings/commerce",
					component: "SettingsCommerce",
				},
			],
		},
		options,
	};
}
