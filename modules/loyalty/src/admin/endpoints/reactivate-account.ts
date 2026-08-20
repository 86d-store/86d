import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { LoyaltyController } from "../../service";

export const reactivateAccount = createAdminEndpoint(
	"/admin/loyalty/accounts/:customerId/reactivate",
	{
		method: "POST",
		params: z.object({
			customerId: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.loyalty as LoyaltyController;
		const account = await controller.reactivateAccount(ctx.params.customerId);
		return { account };
	},
);
