import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { AbandonedCartController, CartItemSnapshot } from "../../service";

const cartItemSchema = z.object({
	productId: z.string().min(1).max(200),
	variantId: z.string().max(200).optional(),
	name: z.string().min(1).max(200).transform(sanitizeText),
	sku: z
		.string()
		.max(100)
		.optional()
		.transform((s) => (s === undefined ? undefined : sanitizeText(s))),
	price: z.number().min(0),
	quantity: z.number().int().min(1),
	imageUrl: z
		.string()
		.max(2000)
		.optional()
		.transform((s) => (s === undefined ? undefined : sanitizeText(s))),
});

export const trackAbandoned = createStoreEndpoint(
	"/abandoned-carts/track",
	{
		method: "POST",
		body: z.object({
			cartId: z.string().min(1).max(200),
			email: z.string().email().max(320).optional(),
			items: z.array(cartItemSchema).min(1).max(100),
			cartTotal: z.number().min(0),
			currency: z.string().length(3).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.abandonedCarts as AbandonedCartController;

		// Check if this cart is already tracked
		const existing = await controller.getByCartId(ctx.body.cartId);
		if (existing && existing.status === "active") {
			// Already tracked and active — no-op
			return { tracked: true, id: existing.id };
		}

		const customerId = ctx.context.session?.user.id;
		// Authenticated users must use session email — never fall back to body
		const email = customerId ? ctx.context.session?.user.email : ctx.body.email;
		const cart = await controller.create({
			cartId: ctx.body.cartId,
			customerId,
			email,
			items: ctx.body.items as CartItemSnapshot[],
			cartTotal: ctx.body.cartTotal,
			currency: ctx.body.currency,
		});

		await ctx.context.events?.emit("cart.abandoned", {
			cartId: cart.id,
			email: cart.email,
			cartTotal: cart.cartTotal,
			currency: cart.currency,
			itemCount: cart.items.length,
		});

		return { tracked: true, id: cart.id };
	},
);
