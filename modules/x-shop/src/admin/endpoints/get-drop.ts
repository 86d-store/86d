import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { XShopController } from "../../service";

export const getDropEndpoint = createAdminEndpoint(
	"/admin/x-shop/drops/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string().min(1).max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.xShop as XShopController;
		const drop = await controller.getDrop(ctx.params.id);
		if (!drop) {
			return { error: "Drop not found" };
		}
		return { drop };
	},
);
