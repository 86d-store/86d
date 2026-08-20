import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { DiscountController } from "../../service";

export const validateCode = createStoreEndpoint(
	"/discounts/validate",
	{
		method: "POST",
		body: z.object({
			code: z.string().min(1).max(50).transform(sanitizeText),
			subtotal: z.number().int().nonnegative(),
			productIds: z.array(z.string().max(200)).max(100).optional(),
			categoryIds: z.array(z.string().max(200)).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.discount as DiscountController;
		const result = await controller.validateCode({
			code: ctx.body.code,
			subtotal: ctx.body.subtotal,
			...(ctx.body.productIds ? { productIds: ctx.body.productIds } : {}),
			...(ctx.body.categoryIds ? { categoryIds: ctx.body.categoryIds } : {}),
		});

		return {
			valid: result.valid,
			discountAmount: result.discountAmount,
			freeShipping: result.freeShipping,
			...(result.error ? { error: result.error } : {}),
		};
	},
);
