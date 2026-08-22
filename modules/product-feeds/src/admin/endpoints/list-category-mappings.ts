import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ProductFeedsController } from "../../service";

export const listCategoryMappings = createAdminEndpoint(
	"/admin/product-feeds/:id/mappings",
	{
		method: "GET",
		params: z.object({ id: z.string().max(200) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.productFeeds as ProductFeedsController;
		const mappings = await controller.listCategoryMappings(ctx.params.id);
		return { mappings, total: mappings.length };
	},
);
