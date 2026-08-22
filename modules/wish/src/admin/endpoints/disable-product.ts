import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { WishController } from "../../service";

export const disableProductEndpoint = createAdminEndpoint(
	"/admin/wish/products/:id/disable",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.wish as WishController;
		const product = await controller.disableProduct(ctx.params.id);
		return { product };
	},
);
