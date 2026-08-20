import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { MultiCurrencyController } from "../../service";

export const getProductPrice = createStoreEndpoint(
	"/currencies/product-price",
	{
		method: "POST",
		body: z.object({
			productId: z.string().min(1).max(100),
			basePriceInCents: z.number().int().nonnegative(),
			currencyCode: z.string().min(3).max(3),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.multiCurrency as MultiCurrencyController;
		const result = await controller.getProductPrice({
			productId: ctx.body.productId,
			basePriceInCents: ctx.body.basePriceInCents,
			currencyCode: ctx.body.currencyCode,
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
