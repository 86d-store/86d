import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { DiscountController } from "../../service";

export const adminCodeStats = createAdminEndpoint(
	"/admin/discounts/:id/code-stats",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.discount as DiscountController;

		const discount = await controller.getById(ctx.params.id);
		if (!discount) {
			return { error: "Discount not found", status: 404 };
		}

		const stats = await controller.getCodeStats(ctx.params.id);
		return stats;
	},
);
