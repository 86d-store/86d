import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { PriceListController } from "../../service";

export const deletePriceList = createAdminEndpoint(
	"/admin/price-lists/:id/delete",
	{
		method: "DELETE",
		params: z.object({
			id: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.priceLists as PriceListController;

		const deleted = await controller.deletePriceList(ctx.params.id);
		if (!deleted) {
			return { error: "Price list not found", status: 404 };
		}

		return { success: true };
	},
);
