import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { DiscountController } from "../../service";

export const adminDeleteDiscount = createAdminEndpoint(
	"/admin/discounts/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.discount as DiscountController;
		const existing = await controller.getById(ctx.params.id);
		if (!existing) {
			return { error: "Discount not found", status: 404 };
		}
		await controller.delete(ctx.params.id);
		return { success: true };
	},
);
