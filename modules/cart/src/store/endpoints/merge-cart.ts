import { createStoreEndpoint } from "@86d-app/core/api";
import type { CartController } from "../../service";

/**
 * Merges the guest cart into the signed-in customer's cart.
 * Call this immediately after a user signs in or creates an account so their
 * pre-authentication cart items are preserved.
 */
export const mergeCart = createStoreEndpoint(
	"/cart/merge",
	{
		method: "POST",
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) {
			return { error: "Must be signed in to merge cart", status: 401 };
		}

		const guestId = ctx.getCookie("cart_guest_id");
		if (!guestId) {
			// No guest cart cookie — nothing to merge
			return { merged: 0 };
		}

		const cartController = ctx.context.controllers.cart as CartController;
		const result = await cartController.mergeGuestCart({ guestId, customerId });

		// Clear the guest cart cookie now that it has been merged
		ctx.setCookie("cart_guest_id", "", {
			httpOnly: true,
			sameSite: "lax" as const,
			path: "/",
			maxAge: 0,
		});

		return result;
	},
);
