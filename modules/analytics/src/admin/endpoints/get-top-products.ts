import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AnalyticsController } from "../../service";

export const getTopProductsEndpoint = createAdminEndpoint(
	"/admin/analytics/top-products",
	{
		method: "GET",
		query: z.object({
			limit: z.coerce.number().int().min(1).max(100).optional(),
			since: z.string().optional(),
			until: z.string().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.analytics as AnalyticsController;
		const products = await controller.getTopProducts({
			limit: ctx.query.limit,
			since: ctx.query.since ? new Date(ctx.query.since) : undefined,
			until: ctx.query.until ? new Date(ctx.query.until) : undefined,
		});
		return { products };
	},
);
