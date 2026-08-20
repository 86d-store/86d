import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { BlogController } from "../../service";

export const deletePostEndpoint = createAdminEndpoint(
	"/admin/blog/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.blog as BlogController;
		const deleted = await controller.deletePost(ctx.params.id);
		return { deleted };
	},
);
