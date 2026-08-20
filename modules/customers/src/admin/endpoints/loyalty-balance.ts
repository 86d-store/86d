import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { CustomerController } from "../../service";

export const adminGetLoyaltyBalance = createAdminEndpoint(
	"/admin/customers/:id/loyalty",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.customer as CustomerController;
		const balance = await controller.getLoyaltyBalance(ctx.params.id);
		return { balance };
	},
);

export const adminGetLoyaltyHistory = createAdminEndpoint(
	"/admin/customers/:id/loyalty/history",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
		query: z.object({
			limit: z.coerce.number().min(1).max(100).optional(),
			offset: z.coerce.number().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.customer as CustomerController;
		const result = await controller.getLoyaltyHistory(ctx.params.id, {
			limit: ctx.query.limit,
			offset: ctx.query.offset,
		});
		return result;
	},
);
