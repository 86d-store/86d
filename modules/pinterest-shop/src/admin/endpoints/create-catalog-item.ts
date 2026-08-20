import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { PinterestShopController } from "../../service";

export const createCatalogItemEndpoint = createAdminEndpoint(
	"/admin/pinterest-shop/items/create",
	{
		method: "POST",
		body: z.object({
			localProductId: z.string().min(1).max(500).transform(sanitizeText),
			title: z.string().min(1).max(500).transform(sanitizeText),
			description: z.string().max(5000).transform(sanitizeText).optional(),
			link: z.string().url().max(2000),
			imageUrl: z.string().url().max(2000),
			price: z.number().min(0),
			salePrice: z.number().min(0).optional(),
			availability: z.enum(["in-stock", "out-of-stock", "preorder"]).optional(),
			googleCategory: z.string().max(500).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.pinterestShop as PinterestShopController;
		const item = await controller.createCatalogItem({
			localProductId: ctx.body.localProductId,
			title: ctx.body.title,
			description: ctx.body.description,
			link: ctx.body.link,
			imageUrl: ctx.body.imageUrl,
			price: ctx.body.price,
			salePrice: ctx.body.salePrice,
			availability: ctx.body.availability,
			googleCategory: ctx.body.googleCategory,
		});
		return { item };
	},
);
