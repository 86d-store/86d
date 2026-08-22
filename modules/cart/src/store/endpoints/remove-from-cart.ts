import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { CartController } from "../../service";
import { resolveGuestId } from "./_guest";

export const removeFromCart = createStoreEndpoint(
	"/cart/items/:id/remove",
	{
		method: "DELETE",
		params: z.object({
			id: z.string().max(200),
		}),
	},
	async (ctx) => {
		const { params } = ctx;
		const context = ctx.context;
		const cartController = context.controllers.cart as CartController;

		// Resolve the current user's cart to scope the lookup
		const customerId = context.session?.user.id;
		const cart = await cartController.getOrCreateCart(
			customerId ? { customerId } : { guestId: resolveGuestId(ctx) },
		);

		// Only look for the item within the user's own cart
		const cartItems = await cartController.getCartItems(cart.id);
		const existingItem =
			cartItems.find((i) => i.id === params.id) ??
			cartItems.find(
				(i) =>
					`${i.cartId}_${i.productId}` === params.id ||
					(i.variantId &&
						`${i.cartId}_${i.productId}_${i.variantId}` === params.id),
			) ??
			null;

		if (!existingItem) {
			return { error: "Cart item not found", status: 404 };
		}

		await cartController.removeItem(existingItem.id);

		const items = await cartController.getCartItems(cart.id);

		return {
			cart,
			items,
			itemCount: items.length,
			subtotal: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
		};
	},
);
