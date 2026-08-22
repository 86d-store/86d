import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import { listRevenueIntents } from "../../payment-source";
import type { PaymentIntentStatus } from "../../service";
import { filterAndPageTransactions } from "../../service-impl";

export const listCustomerTransactions = createStoreEndpoint(
	"/revenue/transactions",
	{
		method: "GET",
		query: z.object({
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(50).optional(),
			status: z
				.enum([
					"pending",
					"processing",
					"succeeded",
					"failed",
					"cancelled",
					"refunded",
				])
				.optional(),
		}),
	},
	async (ctx) => {
		const session = ctx.context.session;
		if (!session) {
			return { error: "Unauthorized", status: 401 };
		}

		const source = await listRevenueIntents(ctx.context.capabilities, {
			customerId: session.user.id,
			take: 1000,
		});
		if (!source.ok) {
			return {
				code: source.code,
				error: "Authoritative payment history is unavailable.",
				status: 503,
			};
		}

		return filterAndPageTransactions(source.intents, {
			from: null,
			to: null,
			status: ctx.query.status as PaymentIntentStatus | undefined,
			page: ctx.query.page ?? 1,
			limit: ctx.query.limit ?? 10,
		});
	},
);
