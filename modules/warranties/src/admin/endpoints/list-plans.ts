import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { WarrantyController } from "../../service";

export const listPlans = createAdminEndpoint(
	"/admin/warranties/plans",
	{
		method: "GET",
		query: z.object({
			type: z
				.enum(["manufacturer", "extended", "accidental_damage"])
				.optional(),
			productId: z.string().optional(),
			activeOnly: z.coerce.boolean().optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.warranties as WarrantyController;
		const plans = await controller.listPlans({
			type: ctx.query.type,
			productId: ctx.query.productId,
			activeOnly: ctx.query.activeOnly,
			take: ctx.query.take,
			skip: ctx.query.skip,
		});
		return { plans };
	},
);
