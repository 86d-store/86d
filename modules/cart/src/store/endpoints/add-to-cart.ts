import { createStoreEndpoint } from "@86d-app/core/api";
import { productResolveCapability } from "@86d-app/core/commerce-capabilities";
import { z } from "@86d-app/core/zod";
import type { CartController } from "../../service";
import { resolveGuestId } from "./_guest";

export const addToCart = createStoreEndpoint(
	"/cart",
	{
		method: "POST",
		body: z.object({
			productId: z.string().max(200),
			variantId: z.string().max(200).optional(),
			quantity: z.number().positive().int().max(999),
		}),
	},
	async (ctx) => {
		const { body } = ctx;
		const context = ctx.context;
		const cartController = context.controllers.cart as CartController;

		const resolved = await context.capabilities.invoke(
			productResolveCapability,
			{
				productId: body.productId,
				...(body.variantId ? { variantId: body.variantId } : {}),
			},
		);
		if (!resolved.ok) {
			if (resolved.failure.code === "not_found") {
				return { error: "Product not found", status: 404 };
			}
			if (resolved.failure.code === "not_active") {
				return { error: "Product is not available", status: 400 };
			}
			if (
				resolved.failure.code === "variant_not_found" ||
				resolved.failure.code === "variant_mismatch"
			) {
				return { error: "Product variant is not available", status: 400 };
			}
			return {
				code: "CART_CATALOG_UNAVAILABLE",
				error: "Authoritative product information is unavailable.",
				status: 503,
			};
		}
		const authoritativeProduct = resolved.decision.product;
		const authoritativeVariant = resolved.decision.variant;
		const price = authoritativeVariant?.price ?? authoritativeProduct.price;
		const productImage =
			authoritativeVariant?.images[0] ?? authoritativeProduct.images[0];

		const customerId = context.session?.user.id;
		const cart = await cartController.getOrCreateCart(
			customerId ? { customerId } : { guestId: resolveGuestId(ctx) },
		);

		const item = await cartController.addItem({
			cartId: cart.id,
			productId: body.productId,
			...(body.variantId ? { variantId: body.variantId } : {}),
			quantity: body.quantity,
			price,
			productName: authoritativeProduct.name,
			productSlug: authoritativeProduct.slug,
			...(productImage ? { productImage } : {}),
			...(authoritativeVariant
				? { variantName: authoritativeVariant.name }
				: {}),
		});

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
