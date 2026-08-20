import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ProductLabelController } from "../../service";

export const getProductLabels = createStoreEndpoint(
	"/product-labels/products/:productId",
	{
		method: "GET",
		params: z.object({
			productId: z.string().max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.productLabels as ProductLabelController;

		const labels = await controller.getActiveLabelsForProduct(
			ctx.params.productId,
		);
		return { labels };
	},
);
