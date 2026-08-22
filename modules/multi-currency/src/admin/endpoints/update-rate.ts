import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { MultiCurrencyController } from "../../service";

export const adminUpdateRate = createAdminEndpoint(
	"/admin/currencies/update-rate",
	{
		method: "POST",
		body: z.object({
			currencyCode: z.string().min(3).max(3),
			rate: z.number().positive(),
			source: z.string().max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.multiCurrency as MultiCurrencyController;
		const currency = await controller.updateRate({
			currencyCode: ctx.body.currencyCode,
			rate: ctx.body.rate,
			...(ctx.body.source ? { source: ctx.body.source } : {}),
		});
		if (!currency) {
			return { error: "Currency not found", status: 404 };
		}
		return { currency };
	},
);
