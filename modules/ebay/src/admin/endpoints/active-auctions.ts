import { createAdminEndpoint } from "@86d-app/core/api";
import type { EbayController } from "../../service";

export const activeAuctionsEndpoint = createAdminEndpoint(
	"/admin/ebay/auctions",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.ebay as EbayController;
		const auctions = await controller.getActiveAuctions();
		return { auctions };
	},
);
