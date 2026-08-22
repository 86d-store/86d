import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { BackordersController } from "../../service";

export const allocateStock = createAdminEndpoint(
	"/admin/backorders/allocate",
	{
		method: "POST",
		body: z.object({
			productId: z.string(),
			quantity: z.number().int().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.backorders as BackordersController;
		const result = await controller.allocateStock(
			ctx.body.productId,
			ctx.body.quantity,
		);
		return result;
	},
);
