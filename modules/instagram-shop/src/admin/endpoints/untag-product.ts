import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { InstagramShopController } from "../../service";

export const untagProductEndpoint = createAdminEndpoint(
	"/admin/instagram-shop/listings/:id/untag",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1).max(200),
		}),
		body: z.object({
			mediaId: z.string().min(1).max(200).transform(sanitizeText),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.instagramShop as InstagramShopController;
		const listing = await controller.untagProduct(
			ctx.params.id,
			ctx.body.mediaId,
		);
		if (!listing) {
			return { error: "Listing not found" };
		}
		return { listing };
	},
);
