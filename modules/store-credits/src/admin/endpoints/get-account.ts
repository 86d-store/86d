import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { StoreCreditController } from "../../service";

export const getAccount = createAdminEndpoint(
	"/admin/store-credits/accounts/:customerId",
	{
		method: "GET",
		params: z.object({
			customerId: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"store-credits"
		] as StoreCreditController;
		const account = await controller.getAccount(ctx.params.customerId);
		if (!account) {
			return { account: null, transactions: [] };
		}
		const transactions = await controller.listTransactions(account.id, {
			take: 20,
		});
		return { account, transactions };
	},
);
