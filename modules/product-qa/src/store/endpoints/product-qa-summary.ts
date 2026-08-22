import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ProductQaController } from "../../service";

export const productQaSummary = createStoreEndpoint(
	"/product-qa/products/:productId/summary",
	{
		method: "GET",
		params: z.object({
			productId: z.string().max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.productQa as ProductQaController;
		const summary = await controller.getProductQaSummary(ctx.params.productId);
		return { summary };
	},
);
