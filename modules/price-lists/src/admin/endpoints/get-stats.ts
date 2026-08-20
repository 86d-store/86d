import { createAdminEndpoint } from "@86d-app/core/api";
import type { PriceListController } from "../../service";

export const getStats = createAdminEndpoint(
	"/admin/price-lists/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.priceLists as PriceListController;

		const stats = await controller.getStats();

		return { stats };
	},
);
