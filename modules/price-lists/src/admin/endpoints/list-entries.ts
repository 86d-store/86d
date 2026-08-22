import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { PriceListController } from "../../service";

export const listEntries = createAdminEndpoint(
	"/admin/price-lists/:id/entries",
	{
		method: "GET",
		params: z.object({
			id: z.string().min(1),
		}),
		query: z.object({
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.priceLists as PriceListController;

		const priceList = await controller.getPriceList(ctx.params.id);
		if (!priceList) {
			return { error: "Price list not found", status: 404 };
		}

		const [entries, total] = await Promise.all([
			controller.listPrices(ctx.params.id, {
				take: ctx.query.take ?? 50,
				skip: ctx.query.skip ?? 0,
			}),
			controller.countPrices(ctx.params.id),
		]);

		return { entries, total };
	},
);
