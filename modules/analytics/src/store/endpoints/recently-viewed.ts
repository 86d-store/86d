import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AnalyticsController } from "../../service";

export const recentlyViewedEndpoint = createStoreEndpoint(
	"/analytics/recently-viewed",
	{
		method: "GET",
		query: z.object({
			sessionId: z.string().max(200).optional(),
			excludeProductId: z.string().max(200).optional(),
			limit: z.coerce.number().int().min(1).max(20).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.analytics as AnalyticsController;
		const customerId = ctx.context.session?.user.id;
		const items = await controller.getRecentlyViewed({
			sessionId: !customerId ? ctx.query.sessionId : undefined,
			customerId,
			excludeProductId: ctx.query.excludeProductId,
			limit: ctx.query.limit,
		});
		return { items };
	},
);
