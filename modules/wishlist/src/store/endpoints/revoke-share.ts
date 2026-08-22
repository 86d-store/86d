import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { WishlistController } from "../../service";

export const revokeWishlistShare = createStoreEndpoint(
	"/wishlist/share/:id/revoke",
	{
		method: "POST",
		params: z.object({ id: z.string().max(128) }),
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) {
			return { error: "Unauthorized", status: 401 };
		}
		const controller = ctx.context.controllers.wishlist as WishlistController;
		const revoked = await controller.revokeShareToken(
			customerId,
			ctx.params.id,
		);
		if (!revoked) {
			return { error: "Share token not found", status: 404 };
		}
		return { revoked };
	},
);
