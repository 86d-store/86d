import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { FlashSaleController } from "../../service";

export const getSale = createStoreEndpoint(
	"/flash-sales/:slug",
	{
		method: "GET",
		params: z.object({
			slug: z.string().min(1).max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.flashSales as FlashSaleController;

		const sale = await controller.getFlashSaleBySlug(ctx.params.slug);
		if (sale?.status !== "active") {
			return { error: "Flash sale not found", status: 404 };
		}

		const now = new Date();
		if (now < sale.startsAt || now > sale.endsAt) {
			return { error: "Flash sale not found", status: 404 };
		}

		const products = await controller.listProducts(sale.id);

		return { sale, products };
	},
);
