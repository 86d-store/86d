import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { Cart, CartItem } from "../../service";

export const getCartDetails = createAdminEndpoint(
	"/admin/carts/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const { params } = ctx;
		const context = ctx.context;

		const cart = (await context.data.get("cart", params.id)) as Cart | null;

		if (!cart) {
			return { error: "Cart not found", status: 404 };
		}

		const items = (await context.data.findMany("cartItem", {
			where: { cartId: params.id },
		})) as CartItem[];

		return {
			cart,
			items,
			itemCount: items.length,
			subtotal: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
		};
	},
);
