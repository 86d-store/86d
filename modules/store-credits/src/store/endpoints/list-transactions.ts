import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { StoreCreditController } from "../../service";

export const listTransactions = createStoreEndpoint(
	"/store-credits/transactions",
	{
		method: "GET",
		query: z.object({
			type: z.enum(["credit", "debit"]).optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const session = ctx.context.session;
		if (!session) {
			return { error: "Authentication required", status: 401 };
		}

		const controller = ctx.context.controllers[
			"store-credits"
		] as StoreCreditController;
		const account = await controller.getAccount(session.user.id);
		if (!account) {
			return { transactions: [] };
		}
		const transactions = await controller.listTransactions(account.id, {
			type: ctx.query.type,
			take: ctx.query.take,
			skip: ctx.query.skip,
		});
		return { transactions };
	},
);
