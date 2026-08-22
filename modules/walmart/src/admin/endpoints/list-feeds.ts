import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { FeedStatus, FeedType, WalmartController } from "../../service";

export const listFeedsEndpoint = createAdminEndpoint(
	"/admin/walmart/feeds",
	{
		method: "GET",
		query: z.object({
			feedType: z.enum(["item", "inventory", "price", "order"]).optional(),
			status: z
				.enum(["pending", "processing", "completed", "error"])
				.optional(),
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.walmart as WalmartController;
		const limit = ctx.query.limit ?? 50;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;
		const all = await controller.listFeeds({
			feedType: ctx.query.feedType as FeedType | undefined,
			status: ctx.query.status as FeedStatus | undefined,
		});
		const total = all.length;
		const feeds = all.slice(skip, skip + limit);
		return { feeds, total };
	},
);
