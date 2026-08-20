import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import { listRevenueIntents } from "../../payment-source";
import type { PaymentIntentStatus } from "../../service";
import { buildCSV } from "../../service-impl";

export const exportTransactions = createAdminEndpoint(
	"/admin/revenue/export",
	{
		method: "GET",
		query: z.object({
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
				error: "Authoritative payment export is unavailable.",
				status: 503,
			};
		}

		const from = ctx.query.from ? new Date(ctx.query.from) : null;
		const to = ctx.query.to ? new Date(ctx.query.to) : null;
		const statusFilter = ctx.query.status as PaymentIntentStatus | undefined;

		const filtered = source.intents.filter((i) => {
			const t = new Date(i.createdAt);
			if (from && t < from) return false;
			if (to && t > to) return false;
			if (statusFilter && i.status !== statusFilter) return false;
			return true;
		});

		filtered.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		);

		const csv = buildCSV(filtered);
		return { csv, count: filtered.length };
	},
);
