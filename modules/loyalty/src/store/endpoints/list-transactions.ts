import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { LoyaltyController } from "../../service";

export const listTransactions = createStoreEndpoint(
	"/loyalty/transactions",
	{
		method: "GET",
		query: z.object({
			type: z.enum(["earn", "redeem", "adjust", "expire"]).optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const session = ctx.context.session;
		if (!session) {
			return { error: "Authentication required", status: 401 };
		}

		const controller = ctx.context.controllers.loyalty as LoyaltyController;
		const account = await controller.getAccount(session.user.id);
		if (!account) {
			return { transactions: [], total: 0 };
		}
		const transactions = await controller.listTransactions(account.id, {
			type: ctx.query.type,
			take: ctx.query.take ?? 50,
			skip: ctx.query.skip ?? 0,
		});
		return { transactions, total: transactions.length };
	},
);
