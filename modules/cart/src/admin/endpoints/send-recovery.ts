import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { Cart, CartItem } from "../../service";
import { createCartControllers } from "../../service-impl";

export const sendRecoveryEmail = createAdminEndpoint(
	"/admin/carts/:id/send-recovery",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
		body: z.object({
			email: z.string().email(),
			customerName: z.string().min(1),
			recoveryUrl: z.string().url(),
			storeName: z.string().optional(),
		}),
	},
	async (ctx) => {
		const { params, body } = ctx;
		const context = ctx.context;
		const controller = createCartControllers(context.data);

		const cart = (await context.data.get("cart", params.id)) as Cart | null;
		if (!cart) {
			return { error: "Cart not found", status: 404 };
		}

		const items = (await context.data.findMany("cartItem", {
			where: { cartId: params.id },
		})) as CartItem[];

		if (items.length === 0) {
			return { error: "Cart has no items", status: 400 };
		}

		const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

		// Mark the recovery email as sent in cart metadata
		const updated = await controller.markRecoveryEmailSent(params.id);

		return {
			success: true,
			cart: updated,
			emailPayload: {
				to: body.email,
				customerName: body.customerName,
				items: items.map((item) => ({
					name: item.productName,
					quantity: item.quantity,
					price: item.price,
					variantName: item.variantName,
					image: item.productImage,
				})),
				subtotal,
				currency: "USD",
				recoveryUrl: body.recoveryUrl,
				storeName: body.storeName ?? "Our Store",
			},
		};
	},
);
