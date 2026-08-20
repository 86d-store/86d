import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { WishController } from "../../service";

export const createProductEndpoint = createAdminEndpoint(
	"/admin/wish/products/create",
	{
		method: "POST",
		body: z.object({
			localProductId: z.string().min(1).max(200),
			title: z.string().min(1).max(500).transform(sanitizeText),
			price: z.number().min(0),
			shippingPrice: z.number().min(0),
			quantity: z.number().int().min(0).optional(),
			parentSku: z.string().max(200).transform(sanitizeText).optional(),
			tags: z.array(z.string().max(100).transform(sanitizeText)).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.wish as WishController;
		const product = await controller.createProduct({
			localProductId: ctx.body.localProductId,
			title: ctx.body.title,
			price: ctx.body.price,
			shippingPrice: ctx.body.shippingPrice,
			quantity: ctx.body.quantity,
			parentSku: ctx.body.parentSku,
			tags: ctx.body.tags,
		});
		return { product };
	},
);
