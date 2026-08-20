import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { DiscountController } from "../../service";

export const adminGenerateCodes = createAdminEndpoint(
	"/admin/discounts/:id/generate-codes",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
		body: z.object({
			count: z.number().int().min(1).max(500),
			prefix: z.string().max(20).optional(),
			maximumUses: z.number().int().positive().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.discount as DiscountController;

		const discount = await controller.getById(ctx.params.id);
		if (!discount) {
			return { error: "Discount not found", status: 404 };
		}

		const result = await controller.generateBulkCodes({
			discountId: ctx.params.id,
			count: ctx.body.count,
			prefix: ctx.body.prefix,
			maximumUses: ctx.body.maximumUses,
		});

		return result;
	},
);
