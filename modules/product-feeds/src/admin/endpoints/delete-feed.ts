import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ProductFeedsController } from "../../service";

export const deleteFeed = createAdminEndpoint(
	"/admin/product-feeds/:id/delete",
	{
		method: "POST",
		params: z.object({ id: z.string().max(200) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.productFeeds as ProductFeedsController;

		const deleted = await controller.deleteFeed(ctx.params.id);
		if (!deleted) {
			return { error: "Feed not found" };
		}

		return { success: true };
	},
);
