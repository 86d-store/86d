import { createStoreEndpoint } from "@86d-app/core/api";
import type { SettingsController } from "../../service";

export const getPublicSettingsEndpoint = createStoreEndpoint(
	"/settings",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.settings as SettingsController;
		const settings = await controller.getPublic();
		return { settings };
	},
);
