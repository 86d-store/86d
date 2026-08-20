import { createAdminEndpoint } from "@86d-app/core/api";
import type { EbayController } from "../../service";

export const statsEndpoint = createAdminEndpoint(
	"/admin/ebay/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.ebay as EbayController;
		const stats = await controller.getChannelStats();
		return { stats };
	},
);
