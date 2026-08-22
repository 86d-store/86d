import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { GoogleShoppingController } from "../../service";

export const deleteFeedItemEndpoint = createAdminEndpoint(
	"/admin/google-shopping/feed-items/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"google-shopping"
		] as GoogleShoppingController;
		const deleted = await controller.deleteFeedItem(ctx.params.id);
		return { deleted };
	},
);
