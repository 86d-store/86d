import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { FlashSaleController } from "../../service";

export const getProductDealParamsSchema = z.object({
	productId: z
		.string()
		.transform(sanitizeText)
		.pipe(z.string().min(1).max(200)),
});

export const getProductDeal = createStoreEndpoint(
	"/flash-sales/product/:productId",
	{
		method: "GET",
		params: getProductDealParamsSchema,
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.flashSales as FlashSaleController;

		const deal = await controller.getActiveProductDeal(ctx.params.productId);

		return { deal };
	},
);
