import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { LoyaltyController } from "../../service";

export const suspendAccount = createAdminEndpoint(
	"/admin/loyalty/accounts/:customerId/suspend",
	{
		method: "POST",
		params: z.object({
			customerId: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.loyalty as LoyaltyController;
		const account = await controller.suspendAccount(ctx.params.customerId);
		return { account };
	},
);
