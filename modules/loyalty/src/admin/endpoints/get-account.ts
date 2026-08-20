import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { LoyaltyController } from "../../service";

export const getAccount = createAdminEndpoint(
	"/admin/loyalty/accounts/:customerId",
	{
		method: "GET",
		params: z.object({
			customerId: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.loyalty as LoyaltyController;
		const account = await controller.getAccount(ctx.params.customerId);
		if (!account) {
			return { error: "Account not found" };
		}
		const transactions = await controller.listTransactions(account.id, {
			take: 20,
		});
		return { account, transactions };
	},
);
