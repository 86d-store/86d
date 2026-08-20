import { createAdminEndpoint } from "@86d-app/core/api";
import type { WishlistController } from "../../service";

export const wishlistSummary = createAdminEndpoint(
	"/admin/wishlist/summary",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.wishlist as WishlistController;
		const summary = await controller.getSummary();
		return { summary };
	},
);
