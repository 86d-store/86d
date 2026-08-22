import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { MultiCurrencyController } from "../../service";

export const adminSetPriceOverride = createAdminEndpoint(
	"/admin/currencies/price-override",
	{
		method: "POST",
		body: z.object({
			productId: z.string().min(1),
			currencyCode: z.string().min(3).max(3),
			price: z.number().int().nonnegative(),
			compareAtPrice: z.number().int().nonnegative().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.multiCurrency as MultiCurrencyController;
		const override = await controller.setPriceOverride(ctx.body);
		return { override };
	},
);
