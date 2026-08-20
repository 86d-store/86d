import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { PriceListController } from "../../service";

export const resolvePriceParamsSchema = z.object({
	productId: z
		.string()
		.transform(sanitizeText)
		.pipe(z.string().min(1).max(200)),
});

export const resolvePriceQuerySchema = z.object({
	customerGroupId: z
		.string()
		.transform(sanitizeText)
		.pipe(z.string().max(200))
		.optional(),
	quantity: z.coerce.number().int().min(1).optional(),
	currency: z
		.string()
		.transform(sanitizeText)
		.pipe(z.string().max(3))
		.optional(),
});

export const resolvePrice = createStoreEndpoint(
	"/prices/product/:productId",
	{
		method: "GET",
		params: resolvePriceParamsSchema,
		query: resolvePriceQuerySchema,
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.priceLists as PriceListController;

		const resolved = await controller.resolvePrice(ctx.params.productId, {
			...(ctx.query.customerGroupId != null && {
				customerGroupId: ctx.query.customerGroupId,
			}),
			...(ctx.query.quantity != null && { quantity: ctx.query.quantity }),
			...(ctx.query.currency != null && { currency: ctx.query.currency }),
		});

		return { price: resolved };
	},
);
