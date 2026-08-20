import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import { listRevenueIntents } from "../../payment-source";
import { aggregateStats } from "../../service-impl";

export const getStats = createAdminEndpoint(
	"/admin/revenue/stats",
	{
		method: "GET",
		query: z.object({
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
				error: "Authoritative revenue statistics are unavailable.",
				status: 503,
			};
		}
		const from = ctx.query.from ? new Date(ctx.query.from) : null;
		const to = ctx.query.to ? new Date(ctx.query.to) : null;

		return aggregateStats(source.intents, from, to);
	},
);
