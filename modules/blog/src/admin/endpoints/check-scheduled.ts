import { createAdminEndpoint } from "@86d-app/core/api";
import type { BlogController } from "../../service";

export const checkScheduledEndpoint = createAdminEndpoint(
	"/admin/blog/check-scheduled",
	{
		method: "POST",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.blog as BlogController;
		const published = await controller.checkScheduledPosts();
		return { published, count: published.length };
	},
);
