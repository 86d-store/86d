import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { XShopController } from "../../service";

export const cancelDropEndpoint = createAdminEndpoint(
	"/admin/x-shop/drops/:id/cancel",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1).max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.xShop as XShopController;
		const drop = await controller.cancelDrop(ctx.params.id);
		if (!drop) {
			return { error: "Drop not found" };
		}
		return { drop };
	},
);
