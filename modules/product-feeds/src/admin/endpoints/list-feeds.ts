import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ProductFeedsController } from "../../service";

export const listFeeds = createAdminEndpoint(
	"/admin/product-feeds",
	{
		method: "GET",
		query: z.object({
			status: z.string().optional(),
			channel: z.string().optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.productFeeds as ProductFeedsController;
		const take = ctx.query.take ?? 50;
		const skip = ctx.query.skip ?? 0;
		const all = await controller.listFeeds({
			status: ctx.query.status as
				| "active"
				| "paused"
				| "error"
				| "draft"
				| undefined,
			channel: ctx.query.channel as
				| "google-shopping"
				| "facebook"
				| "microsoft"
				| "pinterest"
				| "tiktok"
				| "custom"
				| undefined,
		});
		const total = all.length;
		const feeds = all.slice(skip, skip + take);
		return { feeds, total };
	},
);
