import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { CustomerController } from "../../service";

export const adminAdjustPoints = createAdminEndpoint(
	"/admin/customers/:id/loyalty/adjust",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
		body: z.object({
			points: z.number().int(),
			reason: z.string().min(1).max(500),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.customer as CustomerController;
		const transaction = await controller.adjustPoints({
			customerId: ctx.params.id,
			points: ctx.body.points,
			reason: ctx.body.reason,
		});
		return { transaction };
	},
);
