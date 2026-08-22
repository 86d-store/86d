import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { PriceListController } from "../../service";

export const setEntry = createAdminEndpoint(
	"/admin/price-lists/:id/entries/set",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1),
		}),
		body: z.object({
			productId: z.string().min(1),
			price: z.number().min(0),
			compareAtPrice: z.number().min(0).optional(),
			minQuantity: z.number().int().min(1).optional(),
			maxQuantity: z.number().int().min(1).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.priceLists as PriceListController;

		const priceList = await controller.getPriceList(ctx.params.id);
		if (!priceList) {
			return { error: "Price list not found", status: 404 };
		}

		const params: Parameters<typeof controller.setPrice>[0] = {
			priceListId: ctx.params.id,
			productId: ctx.body.productId,
			price: ctx.body.price,
		};
		if (ctx.body.compareAtPrice != null)
			params.compareAtPrice = ctx.body.compareAtPrice;
		if (ctx.body.minQuantity != null) params.minQuantity = ctx.body.minQuantity;
		if (ctx.body.maxQuantity != null) params.maxQuantity = ctx.body.maxQuantity;

		const entry = await controller.setPrice(params);

		return { entry };
	},
);
