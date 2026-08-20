import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { FlashSaleController } from "../../service";

export const listProducts = createAdminEndpoint(
	"/admin/flash-sales/:id/products",
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
			.flashSales as FlashSaleController;

		const [products, total] = await Promise.all([
			controller.listProducts(ctx.params.id, {
				take: ctx.query.take ?? 50,
				skip: ctx.query.skip ?? 0,
			}),
			controller.countProducts(ctx.params.id),
		]);

		return { products, total };
	},
);
