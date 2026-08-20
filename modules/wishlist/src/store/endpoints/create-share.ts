import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { WishlistController } from "../../service";

export const createWishlistShare = createStoreEndpoint(
	"/wishlist/share",
	{
		method: "POST",
		body: z.object({
			/** Expiry in days from now. Optional — defaults to no expiry. */
			expiresInDays: z.coerce.number().int().min(1).max(365).optional(),
		}),
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) {
			return { error: "Unauthorized", status: 401 };
		}
		const controller = ctx.context.controllers.wishlist as WishlistController;

		let expiresAt: Date | undefined;
		if (ctx.body.expiresInDays) {
			expiresAt = new Date(
				Date.now() + ctx.body.expiresInDays * 24 * 60 * 60 * 1000,
			);
		}

		const share = await controller.createShareToken(customerId, expiresAt);

		if (ctx.context.events) {
			await ctx.context.events.emit("wishlist.shared", {
				customerId,
				shareId: share.id,
				token: share.token,
			});
		}

		return { share };
	},
);
