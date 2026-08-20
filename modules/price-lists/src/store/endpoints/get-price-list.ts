import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { PriceListController } from "../../service";

export const getPriceList = createStoreEndpoint(
	"/price-lists/:slug",
	{
		method: "GET",
		params: z.object({
			slug: z.string().min(1).max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.priceLists as PriceListController;

		const priceList = await controller.getPriceListBySlug(ctx.params.slug);
		if (!priceList || priceList.status !== "active") {
			return { error: "Price list not found", status: 404 };
		}

		const entries = await controller.listPrices(priceList.id, {
			take: 100,
		});

		return { priceList, entries };
	},
);
