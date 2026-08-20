import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AbandonedCartController } from "../../service";

export const dismissCart = createAdminEndpoint(
	"/admin/abandoned-carts/:id/dismiss",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.abandonedCarts as AbandonedCartController;
		const cart = await controller.dismiss(ctx.params.id);
		if (!cart) return { error: "Abandoned cart not found", status: 404 };
		return { cart };
	},
);
