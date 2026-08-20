import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { WishController } from "../../service";

export const getProductEndpoint = createAdminEndpoint(
	"/admin/wish/products/:id",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.wish as WishController;
		const product = await controller.getProduct(ctx.params.id);
		return { product };
	},
);
