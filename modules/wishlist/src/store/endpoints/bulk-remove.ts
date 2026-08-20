import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { WishlistController } from "../../service";

export const bulkRemoveFromWishlist = createStoreEndpoint(
	"/wishlist/bulk-remove",
	{
		method: "POST",
		body: z.object({
			itemIds: z.array(z.string().max(200)).min(1).max(50),
		}),
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) {
			return { error: "Unauthorized", status: 401 };
		}
		const controller = ctx.context.controllers.wishlist as WishlistController;
		const removed = await controller.bulkRemove(customerId, ctx.body.itemIds);
		return { removed };
	},
);
