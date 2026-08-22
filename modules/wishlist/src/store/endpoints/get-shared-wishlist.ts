import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { WishlistController } from "../../service";

export const getSharedWishlist = createStoreEndpoint(
	"/wishlist/shared/:token",
	{
		method: "GET",
		params: z.object({ token: z.string().max(200) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.wishlist as WishlistController;
		const items = await controller.getSharedWishlist(ctx.params.token);
		if (items === null) {
			return { error: "Shared wishlist not found or expired", status: 404 };
		}
		return { items };
	},
);
