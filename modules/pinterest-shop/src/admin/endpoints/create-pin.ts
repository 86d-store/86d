import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { PinterestShopController } from "../../service";

export const createPinEndpoint = createAdminEndpoint(
	"/admin/pinterest-shop/pins/create",
	{
		method: "POST",
		body: z.object({
			catalogItemId: z.string().min(1).max(500),
			boardId: z.string().max(500).transform(sanitizeText).optional(),
			title: z.string().min(1).max(500).transform(sanitizeText),
			description: z.string().max(5000).transform(sanitizeText).optional(),
			link: z.string().url().max(2000),
			imageUrl: z.string().url().max(2000),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.pinterestShop as PinterestShopController;
		const pin = await controller.createPin({
			catalogItemId: ctx.body.catalogItemId,
			boardId: ctx.body.boardId,
			title: ctx.body.title,
			description: ctx.body.description,
			link: ctx.body.link,
			imageUrl: ctx.body.imageUrl,
		});
		return { pin };
	},
);
