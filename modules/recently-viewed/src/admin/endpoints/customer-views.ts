import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { RecentlyViewedController } from "../../service";

export const customerViews = createAdminEndpoint(
	"/admin/recently-viewed/customer/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string(),
		}),
		query: z.object({
			take: z.coerce.number().int().min(1).max(200).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.recentlyViewed as RecentlyViewedController;

		const [views, total] = await Promise.all([
			controller.getRecentViews({
				customerId: ctx.params.id,
				take: ctx.query.take ?? 50,
				skip: ctx.query.skip ?? 0,
			}),
			controller.countViews({ customerId: ctx.params.id }),
		]);

		return { views, total };
	},
);
