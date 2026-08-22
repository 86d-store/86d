import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { PriceListController } from "../../service";

export const bulkSetEntries = createAdminEndpoint(
	"/admin/price-lists/:id/entries/bulk",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1),
		}),
		body: z.object({
			entries: z
				.array(
					z.object({
						productId: z.string().min(1),
						price: z.number().min(0),
						compareAtPrice: z.number().min(0).optional(),
						minQuantity: z.number().int().min(1).optional(),
						maxQuantity: z.number().int().min(1).optional(),
					}),
				)
				.min(1)
				.max(500),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.priceLists as PriceListController;

		const priceList = await controller.getPriceList(ctx.params.id);
		if (!priceList) {
			return { error: "Price list not found", status: 404 };
		}

		const entries = await controller.bulkSetPrices(
			ctx.params.id,
			ctx.body.entries as Parameters<PriceListController["bulkSetPrices"]>[1],
		);

		return { entries, count: entries.length };
	},
);
