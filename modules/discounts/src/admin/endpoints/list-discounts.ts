import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { DiscountController } from "../../service";

export const adminListDiscounts = createAdminEndpoint(
	"/admin/discounts",
	{
		method: "GET",
		query: z.object({
			page: z.coerce.number().int().positive().optional().default(1),
			limit: z.coerce.number().int().positive().max(100).optional().default(20),
			isActive: z
				.string()
				.transform((v) => v === "true")
				.optional(),
		}),
	},
	async (ctx) => {
		const { page, limit, isActive } = ctx.query;
		const offset = (page - 1) * limit;

		const controller = ctx.context.controllers.discount as DiscountController;
		const { discounts, total } = await controller.list({
			limit,
			offset,
			...(isActive !== undefined ? { isActive } : {}),
		});

		return {
			discounts,
			total,
			page,
			limit,
			pages: Math.ceil(total / limit),
		};
	},
);
