import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { BulkPricingController, ResolvePriceParams } from "../../service";

export const resolvePrice = createStoreEndpoint(
	"/bulk-pricing/resolve",
	{
		method: "POST",
		body: z.object({
			productId: z.string().min(1).max(200),
			variantId: z.string().min(1).max(200).optional(),
			collectionIds: z.array(z.string().min(1).max(200)).max(100).optional(),
			quantity: z.number().int().min(1),
			basePrice: z.number().min(0),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.bulkPricing as BulkPricingController;
		const params: ResolvePriceParams = {
			productId: ctx.body.productId,
			quantity: ctx.body.quantity,
			basePrice: ctx.body.basePrice,
		};
		if (ctx.body.variantId != null) params.variantId = ctx.body.variantId;
		if (ctx.body.collectionIds != null)
			params.collectionIds = ctx.body.collectionIds;
		const result = await controller.resolvePrice(params);
		return { price: result };
	},
);
