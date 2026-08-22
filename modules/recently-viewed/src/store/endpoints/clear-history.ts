import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { RecentlyViewedController } from "../../service";

export const clearHistory = createStoreEndpoint(
	"/recently-viewed/clear",
	{
		method: "POST",
		body: z.object({
			sessionId: z.string().max(200).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.recentlyViewed as RecentlyViewedController;
		const customerId = ctx.context.session?.user.id;

		const cleared = await controller.clearHistory({
			customerId,
			sessionId: !customerId ? ctx.body.sessionId : undefined,
		});

		return { cleared };
	},
);
