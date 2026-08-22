import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { WalmartController } from "../../service";

export const submitFeedEndpoint = createAdminEndpoint(
	"/admin/walmart/feeds/submit",
	{
		method: "POST",
		body: z.object({
			feedType: z.enum(["item", "inventory", "price", "order"]),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.walmart as WalmartController;
		const feed = await controller.submitFeed(ctx.body.feedType);
		return { feed };
	},
);
