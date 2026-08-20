import { createAdminEndpoint } from "@86d-app/core/api";
import type { XShopController } from "../../service";

export const statsEndpoint = createAdminEndpoint(
	"/admin/x-shop/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.xShop as XShopController;
		const stats = await controller.getChannelStats();
		return { stats };
	},
);
