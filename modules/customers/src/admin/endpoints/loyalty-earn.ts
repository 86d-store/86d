import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { CustomerController } from "../../service";

export const adminEarnPoints = createAdminEndpoint(
	"/admin/customers/:id/loyalty/earn",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
		body: z.object({
			points: z.number().int().positive(),
			reason: z.string().min(1).max(500),
			orderId: z.string().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.customer as CustomerController;
		const transaction = await controller.earnPoints({
			customerId: ctx.params.id,
			points: ctx.body.points,
			reason: ctx.body.reason,
			orderId: ctx.body.orderId,
		});
		return { transaction };
	},
);
