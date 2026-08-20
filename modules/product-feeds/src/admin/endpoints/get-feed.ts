import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ProductFeedsController } from "../../service";

export const getFeed = createAdminEndpoint(
	"/admin/product-feeds/:id",
	{
		method: "GET",
		params: z.object({ id: z.string().max(200) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.productFeeds as ProductFeedsController;
		const feed = await controller.getFeed(ctx.params.id);
		if (!feed) {
			return { error: "Feed not found" };
		}
		return { feed };
	},
);
