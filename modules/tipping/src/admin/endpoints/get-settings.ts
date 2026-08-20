import { createAdminEndpoint } from "@86d-app/core/api";
import type { TippingController } from "../../service";

export const getSettings = createAdminEndpoint(
	"/admin/tipping/settings",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.tipping as TippingController;
		const settings = await controller.getSettings();
		return { settings };
	},
);
