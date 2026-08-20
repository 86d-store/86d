import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import { listRevenueIntents } from "../../payment-source";
import type { PaymentIntentStatus } from "../../service";
import { filterAndPageTransactions } from "../../service-impl";

export const listTransactions = createAdminEndpoint(
	"/admin/revenue/transactions",
	{
		method: "GET",
		query: z.object({
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
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
			search: z.string().max(200).optional(),
			from: z.string().datetime().optional(),
			to: z.string().datetime().optional(),
		}),
	},
	async (ctx) => {
		const source = await listRevenueIntents(ctx.context.capabilities, {
			take: 10000,
		});
		if (!source.ok) {
			return {
				code: source.code,
				error: "Authoritative payment history is unavailable.",
				status: 503,
			};
		}

		return filterAndPageTransactions(source.intents, {
			from: ctx.query.from ? new Date(ctx.query.from) : null,
			to: ctx.query.to ? new Date(ctx.query.to) : null,
			status: ctx.query.status as PaymentIntentStatus | undefined,
			search: ctx.query.search,
			page: ctx.query.page ?? 1,
			limit: ctx.query.limit ?? 20,
		});
	},
);
