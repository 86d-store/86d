import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { WishlistController } from "../../service";

export const deleteWishlistItem = createAdminEndpoint(
	"/admin/wishlist/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.wishlist as WishlistController;
		const existing = await controller.getItem(ctx.params.id);
		if (!existing) return { error: "Wishlist item not found", status: 404 };
		const deleted = await controller.removeItem(ctx.params.id);
		return { deleted };
	},
);
