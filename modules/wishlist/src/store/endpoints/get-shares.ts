import { createStoreEndpoint } from "@86d-app/core/api";
import type { WishlistController } from "../../service";

export const getWishlistShares = createStoreEndpoint(
	"/wishlist/shares",
	{
		method: "GET",
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) {
			return { error: "Unauthorized", status: 401 };
		}
		const controller = ctx.context.controllers.wishlist as WishlistController;
		const shares = await controller.getShareTokens(customerId);
		return { shares };
	},
);
