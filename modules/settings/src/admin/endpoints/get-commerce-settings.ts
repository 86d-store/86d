import { createAdminEndpoint } from "@86d-store/core/api";
import {
	DEFAULT_COMING_SOON_MESSAGE,
	DEFAULT_PAUSED_MESSAGE,
	DEFAULT_STORE_STATUS,
	SETTING_KEYS,
	type SettingsController,
	STORE_STATUS_VALUES,
	type StoreStatus,
} from "../../service";

export type CommerceSettings = {
	storeStatus: StoreStatus;
	comingSoonMessage: string;
	pausedMessage: string;
};

function parseStoreStatus(value: string | null): StoreStatus {
	if (value !== null && STORE_STATUS_VALUES.includes(value as StoreStatus)) {
		return value as StoreStatus;
	}
	return DEFAULT_STORE_STATUS;
}

export const getCommerceSettingsEndpoint = createAdminEndpoint(
	"/admin/settings/commerce",
	{ method: "GET" },
	async (ctx) => {
		const controller = ctx.context.controllers.settings as SettingsController;

		const [storeStatus, comingSoonMessage, pausedMessage] = await Promise.all([
			controller.getValue(SETTING_KEYS.storeStatus),
			controller.getValue(SETTING_KEYS.comingSoonMessage),
			controller.getValue(SETTING_KEYS.pausedMessage),
		]);

		const settings: CommerceSettings = {
			storeStatus: parseStoreStatus(storeStatus),
			comingSoonMessage: comingSoonMessage ?? DEFAULT_COMING_SOON_MESSAGE,
			pausedMessage: pausedMessage ?? DEFAULT_PAUSED_MESSAGE,
		};

		return { settings };
	},
);
