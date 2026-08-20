import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { BackordersController } from "../../service";

export const checkEligibility = createStoreEndpoint(
	"/backorders/check/:productId",
	{
		method: "GET",
		params: z.object({ productId: z.string().max(200) }),
		query: z.object({
			quantity: z.coerce.number().int().min(1).max(9999).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.backorders as BackordersController;
		const result = await controller.checkEligibility(
			ctx.params.productId,
			ctx.query.quantity ?? 1,
		);
		return result;
	},
);
