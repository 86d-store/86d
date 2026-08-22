import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { WishlistController } from "../../service";

export const removeFromWishlist = createStoreEndpoint(
	"/wishlist/remove/:id",
	{
		method: "DELETE",
		params: z.object({ id: z.string().max(128) }),
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) {
			return { error: "Unauthorized", status: 401 };
		}
		const controller = ctx.context.controllers.wishlist as WishlistController;
		const item = await controller.getItem(ctx.params.id);
		if (!item || item.customerId !== customerId) {
			return { error: "Wishlist item not found", status: 404 };
		}
		const removed = await controller.removeItem(ctx.params.id);
		if (!removed) return { error: "Wishlist item not found", status: 404 };

		if (ctx.context.events) {
			await ctx.context.events.emit("wishlist.itemRemoved", {
				customerId,
				productId: item.productId,
				productName: item.productName,
				itemId: item.id,
			});
		}

		return { removed };
	},
);
