import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { BlogController } from "../../service";

export const bulkUpdateEndpoint = createAdminEndpoint(
	"/admin/blog/bulk/status",
	{
		method: "POST",
		body: z.object({
			ids: z.array(z.string()).min(1).max(100),
			status: z.enum(["draft", "published", "archived"]),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.blog as BlogController;
		const result = await controller.bulkUpdateStatus(
			ctx.body.ids,
			ctx.body.status,
		);
		return result;
	},
);
