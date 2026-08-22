import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AbandonedCartController } from "../../service";

export const getAbandoned = createAdminEndpoint(
	"/admin/abandoned-carts/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.abandonedCarts as AbandonedCartController;
		const cart = await controller.getWithAttempts(ctx.params.id);
		if (!cart) return { error: "Abandoned cart not found", status: 404 };
		return { cart };
	},
);
