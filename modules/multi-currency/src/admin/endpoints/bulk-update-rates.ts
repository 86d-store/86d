import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { MultiCurrencyController } from "../../service";

export const adminBulkUpdateRates = createAdminEndpoint(
	"/admin/currencies/bulk-update-rates",
	{
		method: "POST",
		body: z.object({
			rates: z.array(
				z.object({
					currencyCode: z.string().min(3).max(3),
					rate: z.number().positive(),
					source: z.string().max(100).optional(),
				}),
			),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.multiCurrency as MultiCurrencyController;
		const result = await controller.bulkUpdateRates(ctx.body.rates);
		return result;
	},
);
