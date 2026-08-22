import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { BlogController } from "../../service";

export const unpublishPostEndpoint = createAdminEndpoint(
	"/admin/blog/:id/unpublish",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.blog as BlogController;
		const post = await controller.unpublishPost(ctx.params.id);
		if (!post) return { error: "Post not found", status: 404 };
		return { post };
	},
);
