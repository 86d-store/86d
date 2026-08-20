import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AuctionController } from "../../service";

export const getAuction = createAdminEndpoint(
	"/admin/auctions/:id",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.auctions as AuctionController;
		const auction = await controller.getAuction(ctx.params.id);
		if (!auction) {
			return { error: "Auction not found", status: 404 };
		}

		const bids = await controller.listBids(ctx.params.id, { take: 10 });
		const watchers = await controller.getWatchers(ctx.params.id);

		return { auction, recentBids: bids, watcherCount: watchers.length };
	},
);
