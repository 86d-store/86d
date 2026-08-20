import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { RecentlyViewedController } from "../../service";

export const mergeHistory = createStoreEndpoint(
	"/recently-viewed/merge",
	{
		method: "POST",
		body: z.object({
			sessionId: z.string().max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.recentlyViewed as RecentlyViewedController;
		const customerId = ctx.context.session?.user.id;

		if (!customerId) {
			return { error: "Authentication required", status: 401 };
		}

		const merged = await controller.mergeHistory({
			sessionId: ctx.body.sessionId,
			customerId,
		});

		return { merged };
	},
);
