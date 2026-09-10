import { createAdminEndpoint } from "@86d-store/core/api";
import { z } from "zod";
import type { ProductLabelController } from "../../service";

export const adminProductLabels = createAdminEndpoint(
	"/admin/product-labels/products/:productId",
	{
		method: "GET",
		params: z.object({
			productId: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.productLabels as ProductLabelController;

		const result = await controller.getProductLabels(ctx.params.productId);
		return result;
	},
);
