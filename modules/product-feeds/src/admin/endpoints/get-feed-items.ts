import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ProductFeedsController } from "../../service";

export const getFeedItems = createAdminEndpoint(
	"/admin/product-feeds/:id/items",
	{
		method: "GET",
		params: z.object({ id: z.string().max(200) }),
		query: z.object({
			status: z.string().optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.productFeeds as ProductFeedsController;

		const take = ctx.query.take ?? 50;
		const skip = ctx.query.skip ?? 0;
		const all = await controller.getFeedItems(ctx.params.id, {
			status: ctx.query.status as
				| "valid"
				| "warning"
				| "error"
				| "excluded"
				| undefined,
		});
		const total = all.length;
		const items = all.slice(skip, skip + take);

		return { items, total };
	},
);
