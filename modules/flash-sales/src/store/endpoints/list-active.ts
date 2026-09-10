import { createStoreEndpoint } from "@86d-store/core/api";
import type { FlashSaleController } from "../../service";

export const listActive = createStoreEndpoint(
	"/flash-sales",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.flashSales as FlashSaleController;

		const sales = await controller.getActiveSales();

		return { sales };
	},
);
