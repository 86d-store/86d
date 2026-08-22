import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { BlogController } from "../../service";

export const bulkDeleteEndpoint = createAdminEndpoint(
	"/admin/blog/bulk/delete",
	{
		method: "POST",
		body: z.object({
			ids: z.array(z.string()).min(1).max(100),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.blog as BlogController;
		const result = await controller.bulkDelete(ctx.body.ids);
		return result;
	},
);
