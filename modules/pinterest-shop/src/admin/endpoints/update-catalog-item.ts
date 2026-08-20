import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { PinterestShopController } from "../../service";

export const updateCatalogItemEndpoint = createAdminEndpoint(
	"/admin/pinterest-shop/items/:id/update",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			title: z.string().min(1).max(500).transform(sanitizeText).optional(),
			description: z.string().max(5000).transform(sanitizeText).optional(),
			link: z.string().url().max(2000).optional(),
			imageUrl: z.string().url().max(2000).optional(),
			price: z.number().min(0).optional(),
			salePrice: z.number().min(0).optional(),
			availability: z.enum(["in-stock", "out-of-stock", "preorder"]).optional(),
			googleCategory: z.string().max(500).transform(sanitizeText).optional(),
			status: z.enum(["active", "inactive", "disapproved"]).optional(),
			pinterestItemId: z.string().max(500).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.pinterestShop as PinterestShopController;
		const item = await controller.updateCatalogItem(ctx.params.id, {
			title: ctx.body.title,
			description: ctx.body.description,
			link: ctx.body.link,
			imageUrl: ctx.body.imageUrl,
			price: ctx.body.price,
			salePrice: ctx.body.salePrice,
			availability: ctx.body.availability,
			googleCategory: ctx.body.googleCategory,
			status: ctx.body.status,
			pinterestItemId: ctx.body.pinterestItemId,
		});
		return { item };
	},
);
