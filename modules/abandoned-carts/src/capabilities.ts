import { provideCapability } from "@86d-app/core/capabilities";
import { abandonedCartRecoveryResolveCapability } from "@86d-app/core/commerce-capabilities";
import { createAbandonedCartController } from "./service-impl";
export const abandonedCartRecoveryResolveProvider = provideCapability(
	abandonedCartRecoveryResolveCapability,
	async (ctx, request) => {
		try {
			const cart = await createAbandonedCartController(ctx.data).get(
				request.cartId,
			);
			if (!cart) {
				return { ok: false, failure: { code: "cart_not_found" as const } };
			}
			return {
				ok: true,
				decision: {
					items: cart.items.map((item) => ({
						name: item.name,
						quantity: item.quantity,
						price: item.price,
						...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
					})),
					cartTotal: cart.cartTotal,
					currency: cart.currency,
					recoveryToken: cart.recoveryToken,
				},
			};
		} catch {
			return { ok: false, failure: { code: "lookup_failed" as const } };
		}
	},
);
