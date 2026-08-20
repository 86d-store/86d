import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AuctionController } from "../../service";

export const closeAuction = createAdminEndpoint(
	"/admin/auctions/:id/close",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.auctions as AuctionController;
		const auction = await controller.closeAuction(ctx.params.id);
		if (!auction) {
			return { error: "Auction not found", status: 404 };
		}
		void ctx.context.events?.emit("auction.ended", {
			auctionId: auction.id,
			title: auction.title,
			winnerId: auction.winnerId,
			winningBid: auction.currentBid,
		});
		if (auction.winnerId) {
			void ctx.context.events?.emit("auction.sold", {
				auctionId: auction.id,
				title: auction.title,
				winnerId: auction.winnerId,
				salePrice: auction.currentBid,
			});
		}
		return { auction };
	},
);
