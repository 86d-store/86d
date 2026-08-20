import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { CartController } from "../../service";
import { resolveGuestId } from "./_guest";

export const updateCartItem = createStoreEndpoint(
	"/cart/items/:id/update",
	{
		method: "PATCH",
		params: z.object({
			id: z.string().max(200),
		}),
		body: z.object({
			quantity: z.number().positive().int().max(999),
		}),
	},
	async (ctx) => {
		const { params, body } = ctx;
		const context = ctx.context;
		const cartController = context.controllers.cart as CartController;

		// Resolve the current user's cart to verify ownership
		const customerId = context.session?.user.id;
		const cart = await cartController.getOrCreateCart(
			customerId ? { customerId } : { guestId: resolveGuestId(ctx) },
		);

		// Verify the item belongs to this user's cart
		const cartItems = await cartController.getCartItems(cart.id);
		const ownedItem = cartItems.find((i) => i.id === params.id);
		if (!ownedItem) {
			return { error: "Cart item not found", status: 404 };
		}

		const item = await cartController.updateItem(params.id, body.quantity);
		const items = await cartController.getCartItems(cart.id);

		return {
			cart,
			item,
			items,
			itemCount: items.length,
			subtotal: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
		};
	},
);
