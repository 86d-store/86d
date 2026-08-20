import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { XShopController } from "../../service";

export const createDropEndpoint = createAdminEndpoint(
	"/admin/x-shop/drops/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText),
			description: z.string().max(1000).transform(sanitizeText).optional(),
			productIds: z.array(z.string().max(200)).max(100),
			launchDate: z.coerce.date(),
			endDate: z.coerce.date().optional(),
			tweetId: z.string().max(200).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.xShop as XShopController;
		const drop = await controller.createDrop({
			name: ctx.body.name,
			description: ctx.body.description,
			productIds: ctx.body.productIds,
			launchDate: ctx.body.launchDate,
			endDate: ctx.body.endDate,
			tweetId: ctx.body.tweetId,
		});
		return { drop };
	},
);
