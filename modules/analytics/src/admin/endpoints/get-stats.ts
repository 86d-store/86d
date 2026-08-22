import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AnalyticsController } from "../../service";

export const getStatsEndpoint = createAdminEndpoint(
	"/admin/analytics/stats",
	{
		method: "GET",
		query: z.object({
			since: z.string().optional(),
			until: z.string().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.analytics as AnalyticsController;
		const stats = await controller.getStats({
			since: ctx.query.since ? new Date(ctx.query.since) : undefined,
			until: ctx.query.until ? new Date(ctx.query.until) : undefined,
		});
		return { stats };
	},
);
