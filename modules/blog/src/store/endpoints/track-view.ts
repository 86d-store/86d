import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { BlogController } from "../../service";

export const trackViewEndpoint = createStoreEndpoint(
	"/blog/:slug/view",
	{
		method: "POST",
		params: z.object({ slug: z.string().min(1).max(200) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.blog as BlogController;
		const post = await controller.getPostBySlug(ctx.params.slug);
		if (!post || post.status !== "published") {
			return { success: false };
		}
		await controller.incrementViews(post.id);
		return { success: true };
	},
);
