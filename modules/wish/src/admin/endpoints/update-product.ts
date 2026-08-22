import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { WishController } from "../../service";

export const updateProductEndpoint = createAdminEndpoint(
	"/admin/wish/products/:id/update",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			title: z.string().min(1).max(500).transform(sanitizeText).optional(),
			price: z.number().min(0).optional(),
			shippingPrice: z.number().min(0).optional(),
			quantity: z.number().int().min(0).optional(),
			parentSku: z.string().max(200).transform(sanitizeText).optional(),
			tags: z.array(z.string().max(100).transform(sanitizeText)).optional(),
			wishProductId: z.string().max(200).optional(),
			status: z
				.enum(["active", "disabled", "pending-review", "rejected"])
				.optional(),
			reviewStatus: z.string().max(200).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.wish as WishController;
		const product = await controller.updateProduct(ctx.params.id, {
			title: ctx.body.title,
			price: ctx.body.price,
			shippingPrice: ctx.body.shippingPrice,
			quantity: ctx.body.quantity,
			parentSku: ctx.body.parentSku,
			tags: ctx.body.tags,
			wishProductId: ctx.body.wishProductId,
			status: ctx.body.status,
			reviewStatus: ctx.body.reviewStatus,
		});
		return { product };
	},
);
