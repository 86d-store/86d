import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AbandonedCartController } from "../../service";

export const deleteAbandoned = createAdminEndpoint(
	"/admin/abandoned-carts/:id/delete",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.abandonedCarts as AbandonedCartController;
		const result = await controller.delete(ctx.params.id);
		if (!result) return { error: "Abandoned cart not found", status: 404 };
		return { deleted: true };
	},
);
