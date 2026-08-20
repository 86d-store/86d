import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { MultiCurrencyController } from "../../service";

export const adminRateHistory = createAdminEndpoint(
	"/admin/currencies/rate-history",
	{
		method: "POST",
		body: z.object({
			currencyCode: z.string().min(3).max(3),
			limit: z.number().int().positive().max(200).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.multiCurrency as MultiCurrencyController;
		const history = await controller.getRateHistory({
			currencyCode: ctx.body.currencyCode,
			...(ctx.body.limit ? { limit: ctx.body.limit } : {}),
		});
		return { history };
	},
);
