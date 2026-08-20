import { createStoreEndpoint } from "@86d-app/core/api";
import type { TippingController } from "../../service";

export const getPublicSettings = createStoreEndpoint(
	"/tipping/settings",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tipping as TippingController;
		const settings = await controller.getSettings();
		return {
			presetPercents: settings.presetPercents,
			allowCustom: settings.allowCustom,
			maxPercent: settings.maxPercent,
			maxAmount: settings.maxAmount,
		};
	},
);
