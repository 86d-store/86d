import { createAdminEndpoint } from "@86d-store/core/api";
import type { RedirectController } from "../../service";

export const getStats = createAdminEndpoint(
	"/admin/redirects/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.redirects as RedirectController;
		const stats = await controller.getStats();

		return { stats };
	},
);
