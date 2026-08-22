import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ProductFeedsController } from "../../service";

export const deleteCategoryMapping = createAdminEndpoint(
	"/admin/product-feeds/:id/mappings/:mappingId/delete",
	{
		method: "POST",
		params: z.object({
			id: z.string().max(200),
			mappingId: z.string().max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.productFeeds as ProductFeedsController;

		const deleted = await controller.deleteCategoryMapping(
			ctx.params.mappingId,
		);
		if (!deleted) {
			return { error: "Mapping not found" };
		}

		return { success: true };
	},
);
