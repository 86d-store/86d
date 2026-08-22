import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AnalyticsController } from "../../service";

export const getSearchAnalyticsEndpoint = createAdminEndpoint(
	"/admin/analytics/search",
	{
		method: "GET",
		query: z.object({
			since: z.string().optional(),
			until: z.string().optional(),
			limit: z.string().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.analytics as AnalyticsController;
		const analytics = await controller.getSearchAnalytics({
			since: ctx.query.since ? new Date(ctx.query.since) : undefined,
			until: ctx.query.until ? new Date(ctx.query.until) : undefined,
			limit: ctx.query.limit ? Number(ctx.query.limit) : undefined,
		});
		return { analytics };
	},
);
