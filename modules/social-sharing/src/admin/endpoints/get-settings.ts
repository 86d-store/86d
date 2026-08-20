import { createAdminEndpoint } from "@86d-app/core/api";
import type { SocialSharingController } from "../../service";

export const getSettingsEndpoint = createAdminEndpoint(
	"/admin/social-sharing/settings",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"social-sharing"
		] as SocialSharingController;
		const settings = await controller.getSettings();
		return { settings };
	},
);
