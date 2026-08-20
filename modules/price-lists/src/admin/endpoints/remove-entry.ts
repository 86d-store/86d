import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { PriceListController } from "../../service";

export const removeEntry = createAdminEndpoint(
	"/admin/price-lists/:id/entries/:productId/remove",
	{
		method: "DELETE",
		params: z.object({
			id: z.string().min(1),
			productId: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.priceLists as PriceListController;

		const removed = await controller.removePrice(
			ctx.params.id,
			ctx.params.productId,
		);
		if (!removed) {
			return { error: "Price entry not found", status: 404 };
		}

		return { success: true };
	},
);
