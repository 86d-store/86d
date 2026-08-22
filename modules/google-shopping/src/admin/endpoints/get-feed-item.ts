import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { GoogleShoppingController } from "../../service";

export const getFeedItemEndpoint = createAdminEndpoint(
	"/admin/google-shopping/feed-items/:id",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"google-shopping"
		] as GoogleShoppingController;
		const item = await controller.getFeedItem(ctx.params.id);
		return { item };
	},
);
