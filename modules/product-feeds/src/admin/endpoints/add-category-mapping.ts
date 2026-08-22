import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ProductFeedsController } from "../../service";

export const addCategoryMapping = createAdminEndpoint(
	"/admin/product-feeds/:id/mappings/create",
	{
		method: "POST",
		params: z.object({ id: z.string().max(200) }),
		body: z.object({
			storeCategory: z.string().min(1),
			channelCategory: z.string().min(1),
			channelCategoryId: z.string().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.productFeeds as ProductFeedsController;

		const mapping = await controller.addCategoryMapping(ctx.params.id, {
			storeCategory: ctx.body.storeCategory,
			channelCategory: ctx.body.channelCategory,
			channelCategoryId: ctx.body.channelCategoryId,
		});

		return { mapping };
	},
);
