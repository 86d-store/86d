import { createStoreEndpoint } from "@86d-app/core/api";
import type { CartController } from "../../service";
import { resolveGuestId } from "./_guest";

export const getCart = createStoreEndpoint(
	"/cart/get",
	{
		method: "GET",
	},
	async (ctx) => {
		const context = ctx.context;
		const cartController = context.controllers.cart as CartController;

		const customerId = context.session?.user.id;
		const cart = await cartController.getOrCreateCart(
			customerId ? { customerId } : { guestId: resolveGuestId(ctx) },
		);

		const rawItems = await cartController.getCartItems(cart.id);

		// Shape items with nested product/variant for frontend consumption
		const items = rawItems.map((item) => ({
			id: item.id,
			productId: item.productId,
			variantId: item.variantId ?? null,
			quantity: item.quantity,
			price: item.price,
			product: {
				name: item.productName,
				price: item.price,
				images: item.productImage ? [item.productImage] : [],
				slug: item.productSlug,
			},
			variant: item.variantName
				? {
						name: item.variantName,
						options: item.variantOptions ?? {},
					}
				: null,
		}));

		return {
			id: cart.id,
			items,
			itemCount: items.length,
			subtotal: rawItems.reduce(
				(sum, item) => sum + item.price * item.quantity,
				0,
			),
		};
	},
);
