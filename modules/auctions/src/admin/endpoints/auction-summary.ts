import { createAdminEndpoint } from "@86d-app/core/api";
import type { AuctionController } from "../../service";

export const auctionSummary = createAdminEndpoint(
	"/admin/auctions/summary",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers.auctions as AuctionController;
		const summary = await controller.getAuctionSummary();
		return { summary };
	},
);
