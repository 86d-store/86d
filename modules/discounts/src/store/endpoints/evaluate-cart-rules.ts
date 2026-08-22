import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { DiscountController } from "../../service";

export const evaluateCartRules = createStoreEndpoint(
	"/discounts/cart-rules/evaluate",
	{
		method: "POST",
		body: z.object({
			subtotal: z.number().int().nonnegative(),
			itemCount: z.number().int().nonnegative(),
			productIds: z.array(z.string().max(100)).max(1000).optional(),
			categoryIds: z.array(z.string().max(100)).max(1000).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.discount as DiscountController;
		return controller.evaluateCartRules({
			subtotal: ctx.body.subtotal,
			itemCount: ctx.body.itemCount,
			...(ctx.body.productIds ? { productIds: ctx.body.productIds } : {}),
			...(ctx.body.categoryIds ? { categoryIds: ctx.body.categoryIds } : {}),
		});
	},
);
