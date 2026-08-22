import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AbandonedCartController } from "../../service";

export const recoverCart = createStoreEndpoint(
	"/abandoned-carts/recover/:token",
	{
		method: "GET",
		params: z.object({
			token: z.string().min(1).max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.abandonedCarts as AbandonedCartController;
		const cart = await controller.getByToken(ctx.params.token);
		if (!cart) return { error: "Recovery link not found", status: 404 };
		if (cart.status !== "active") {
			return {
				error: "This cart has already been recovered or expired",
				status: 410,
			};
		}
		return { cart };
	},
);
