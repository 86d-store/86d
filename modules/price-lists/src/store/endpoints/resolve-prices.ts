import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { PriceListController } from "../../service";

export const resolvePricesBodySchema = z.object({
	productIds: z
		.array(z.string().transform(sanitizeText).pipe(z.string().min(1).max(200)))
		.min(1)
		.max(100),
	customerGroupId: z
		.string()
		.transform(sanitizeText)
		.pipe(z.string().max(200))
		.optional(),
	quantity: z.number().int().min(1).optional(),
	currency: z
		.string()
		.transform(sanitizeText)
		.pipe(z.string().max(3))
		.optional(),
});

export const resolvePrices = createStoreEndpoint(
	"/prices/products",
	{
		method: "POST",
		body: resolvePricesBodySchema,
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.priceLists as PriceListController;

		const resolved = await controller.resolvePrices(ctx.body.productIds, {
			...(ctx.body.customerGroupId != null && {
				customerGroupId: ctx.body.customerGroupId,
			}),
			...(ctx.body.quantity != null && { quantity: ctx.body.quantity }),
			...(ctx.body.currency != null && { currency: ctx.body.currency }),
		});

		return { prices: resolved };
	},
);
