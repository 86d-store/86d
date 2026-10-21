import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-store/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import {
	isWithinBusinessHours as _isWithinBusinessHours,
	validateBusinessHours as _validateBusinessHours,
} from "./business-hours";
import { storePresentationResolveProvider } from "./capabilities";
import { settingsStorage } from "./schema";
import { createSettingsController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export const isWithinBusinessHours = _isWithinBusinessHours;
export const validateBusinessHours = _validateBusinessHours;

export type {
	BusinessHours,
	DaySchedule,
	PickupCancelLockState,
	PickupNoShowOutcome,
	PickupRefundMethod,
	SettingGroup,
	SettingKey,
	SettingsController,
	StoreSetting,
	StoreStatus,
	TimeWindow,
	WeeklySchedule,
} from "./service";

export interface SettingsOptions extends ModuleConfig {
	/** Default store name shown before settings are configured */
	defaultStoreName?: string;
}

export default function settings(options?: SettingsOptions): Module {
	return {
		id: "settings",
		version: "0.0.1",
		storage: settingsStorage,
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
