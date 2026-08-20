import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { CreditTransaction, StoreCreditController } from "../../service";

export const listAllTransactions = createAdminEndpoint(
	"/admin/store-credits/transactions",
	{
		method: "GET",
		query: z.object({
			accountId: z.string().optional(),
			type: z.enum(["credit", "debit"]).optional(),
			reason: z
				.enum([
					"return_refund",
					"order_payment",
					"admin_adjustment",
					"referral_reward",
					"gift_card_conversion",
					"promotional",
					"other",
				])
				.optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"store-credits"
		] as StoreCreditController;

		if (ctx.query.accountId) {
			const transactions = await controller.listTransactions(
				ctx.query.accountId,
				{
					type: ctx.query.type,
					reason: ctx.query.reason,
					take: ctx.query.take,
					skip: ctx.query.skip,
				},
			);
			return { transactions };
		}

		// List all accounts and gather recent transactions
		const accounts = await controller.listAccounts({ take: 100 });
		const allTransactions: CreditTransaction[] = [];
		for (const account of accounts) {
			const txns = await controller.listTransactions(account.id, {
				type: ctx.query.type,
				reason: ctx.query.reason,
			});
			allTransactions.push(...txns);
		}

		// Sort by date descending and apply pagination
		allTransactions.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		);

		const skip = ctx.query.skip ?? 0;
		const take = ctx.query.take ?? 50;
		return { transactions: allTransactions.slice(skip, skip + take) };
	},
);
