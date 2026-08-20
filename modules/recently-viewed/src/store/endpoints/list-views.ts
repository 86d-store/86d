import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { RecentlyViewedController } from "../../service";

export const listViews = createStoreEndpoint(
	"/recently-viewed",
	{
		method: "GET",
		query: z.object({
			sessionId: z.string().max(200).optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.recentlyViewed as RecentlyViewedController;
		const customerId = ctx.context.session?.user.id;

		const views = await controller.getRecentViews({
			customerId,
			sessionId: !customerId ? ctx.query.sessionId : undefined,
			take: ctx.query.take ?? 20,
			skip: ctx.query.skip ?? 0,
		});

		return { views, total: views.length };
	},
);
