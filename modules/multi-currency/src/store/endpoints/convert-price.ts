import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { MultiCurrencyController } from "../../service";

export const convertPrice = createStoreEndpoint(
	"/currencies/convert",
	{
		method: "POST",
		body: z.object({
			amount: z.number().nonnegative(),
			to: z.string().min(3).max(3),
			from: z.string().min(3).max(3).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.multiCurrency as MultiCurrencyController;
		const result = await controller.convert({
			amount: ctx.body.amount,
			to: ctx.body.to,
			...(ctx.body.from ? { from: ctx.body.from } : {}),
		});

		if (!result) {
			return { error: "Currency not found", status: 404 };
		}

		return {
			amount: result.amount,
			formatted: result.formatted,
			currency: result.currency.code,
		};
	},
);
