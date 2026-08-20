import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { DiscountController } from "../../service";

export const adminDeletePriceRule = createAdminEndpoint(
	"/admin/discounts/price-rules/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.discount as DiscountController;
		const existing = await controller.getPriceRule(ctx.params.id);
		if (!existing) {
			return { error: "Price rule not found", status: 404 };
		}
		await controller.deletePriceRule(ctx.params.id);
		return { success: true };
	},
);
