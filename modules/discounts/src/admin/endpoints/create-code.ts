import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { DiscountController } from "../../service";

export const adminCreateCode = createAdminEndpoint(
	"/admin/discounts/:id/codes",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
		body: z.object({
			code: z.string().min(1).max(50),
			maximumUses: z.number().int().positive().optional(),
			isActive: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.discount as DiscountController;

		const discount = await controller.getById(ctx.params.id);
		if (!discount) {
			return { error: "Discount not found", status: 404 };
		}

		// Check code uniqueness
		const existing = await controller.getCodeByValue(ctx.body.code);
		if (existing) {
			return {
				error: "A promo code with this value already exists",
				status: 400,
			};
		}

		const code = await controller.createCode({
			discountId: ctx.params.id,
			code: ctx.body.code,
			...(ctx.body.maximumUses !== undefined
				? { maximumUses: ctx.body.maximumUses }
				: {}),
			...(ctx.body.isActive !== undefined
				? { isActive: ctx.body.isActive }
				: {}),
		});

		return { code };
	},
);
