import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AnalyticsController } from "../../service";

export const listEventsEndpoint = createAdminEndpoint(
	"/admin/analytics/events",
	{
		method: "GET",
		query: z.object({
			type: z.string().optional(),
			productId: z.string().optional(),
			customerId: z.string().optional(),
			sessionId: z.string().optional(),
			since: z.string().optional(),
			until: z.string().optional(),
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(500).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.analytics as AnalyticsController;
		const limit = ctx.query.limit ?? 100;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;
		const all = await controller.listEvents({
			type: ctx.query.type,
			productId: ctx.query.productId,
			customerId: ctx.query.customerId,
			sessionId: ctx.query.sessionId,
			since: ctx.query.since ? new Date(ctx.query.since) : undefined,
			until: ctx.query.until ? new Date(ctx.query.until) : undefined,
		});
		const total = all.length;
		const events = all.slice(skip, skip + limit);
		return { events, total };
	},
);
