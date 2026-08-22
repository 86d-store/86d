import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { WishlistController } from "../../service";

export const addToWishlist = createStoreEndpoint(
	"/wishlist/add",
	{
		method: "POST",
		body: z.object({
			productId: z.string().max(200),
			productName: z.string().max(500).transform(sanitizeText),
			productImage: z
				.string()
				.max(2000)
				.optional()
				.transform((s) => (s === undefined ? undefined : sanitizeText(s))),
			note: z.string().max(1000).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) {
			return { error: "Unauthorized", status: 401 };
		}
		const controller = ctx.context.controllers.wishlist as WishlistController;
		try {
			const item = await controller.addItem({
				customerId,
				customerEmail: ctx.context.session?.user.email,
				productId: ctx.body.productId,
				productName: ctx.body.productName,
				productImage: ctx.body.productImage,
				note: ctx.body.note,
			});

			if (ctx.context.events) {
				await ctx.context.events.emit("wishlist.itemAdded", {
					customerId,
					productId: item.productId,
					productName: item.productName,
					itemId: item.id,
				});
			}

			return { item };
		} catch (err) {
			if (
				err instanceof Error &&
				err.message.includes("Wishlist limit reached")
			) {
				return { error: err.message, status: 422 };
			}
			return { error: "Internal server error", status: 500 };
		}
	},
);
