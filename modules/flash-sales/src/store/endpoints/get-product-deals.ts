import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { FlashSaleController } from "../../service";

export const getProductDealsBodySchema = z.object({
	productIds: z
		.array(z.string().transform(sanitizeText).pipe(z.string().min(1).max(200)))
		.min(1)
		.max(100),
});

export const getProductDeals = createStoreEndpoint(
	"/flash-sales/products",
	{
		method: "POST",
		body: getProductDealsBodySchema,
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.flashSales as FlashSaleController;

		const deals = await controller.getActiveProductDeals(ctx.body.productIds);

		return { deals };
	},
);
