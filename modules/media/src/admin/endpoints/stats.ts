import { createAdminEndpoint } from "@86d-app/core/api";
import type { MediaController } from "../../service";

export const statsEndpoint = createAdminEndpoint(
	"/admin/media/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.media as MediaController;
		const stats = await controller.getStats();
		return { stats };
	},
);
