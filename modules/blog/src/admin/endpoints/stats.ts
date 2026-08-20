import { createAdminEndpoint } from "@86d-app/core/api";
import type { BlogController } from "../../service";

export const statsEndpoint = createAdminEndpoint(
	"/admin/blog/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.blog as BlogController;
		const stats = await controller.getStats();
		return { stats };
	},
);
