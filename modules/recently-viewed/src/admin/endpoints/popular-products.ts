import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { RecentlyViewedController } from "../../service";

export const popularProducts = createAdminEndpoint(
	"/admin/recently-viewed/popular",
	{
		method: "GET",
		query: z.object({
			take: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.recentlyViewed as RecentlyViewedController;

		const products = await controller.getPopularProducts({
			take: ctx.query.take ?? 10,
		});

		return { products };
	},
);
