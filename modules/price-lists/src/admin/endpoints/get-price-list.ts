import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { PriceListController } from "../../service";

export const getPriceList = createAdminEndpoint(
	"/admin/price-lists/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.priceLists as PriceListController;

		const priceList = await controller.getPriceList(ctx.params.id);
		if (!priceList) {
			return { error: "Price list not found", status: 404 };
		}

		const entries = await controller.listPrices(priceList.id);
		const entryCount = await controller.countPrices(priceList.id);

		return { priceList, entries, entryCount };
	},
);
