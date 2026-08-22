import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { DiscountController } from "../../service";

export const adminGetPriceRule = createAdminEndpoint(
	"/admin/discounts/price-rules/:id",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.discount as DiscountController;
		const rule = await controller.getPriceRule(ctx.params.id);
		if (!rule) {
			return { error: "Price rule not found", status: 404 };
		}
		return { rule };
	},
);
