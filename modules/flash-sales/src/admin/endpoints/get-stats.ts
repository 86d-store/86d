import { createAdminEndpoint } from "@86d-app/core/api";
import type { FlashSaleController } from "../../service";

export const getStats = createAdminEndpoint(
	"/admin/flash-sales/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.flashSales as FlashSaleController;

		const stats = await controller.getStats();

		return { stats };
	},
);
