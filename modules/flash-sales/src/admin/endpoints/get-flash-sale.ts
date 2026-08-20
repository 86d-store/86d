import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { FlashSaleController } from "../../service";

export const getFlashSale = createAdminEndpoint(
	"/admin/flash-sales/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.flashSales as FlashSaleController;

		const sale = await controller.getFlashSale(ctx.params.id);
		if (!sale) {
			return { error: "Flash sale not found", status: 404 };
		}

		const [products, productCount] = await Promise.all([
			controller.listProducts(sale.id, { take: 100 }),
			controller.countProducts(sale.id),
		]);

		return { sale, products, productCount };
	},
);
